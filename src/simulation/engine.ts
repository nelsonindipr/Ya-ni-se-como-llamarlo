import type { GameResult, Player, PlayerBoxScore, Team } from '../domain/types';
import { createSeededRandom, randomInt, type RandomSource } from './random';

type TeamContext = {
  team: Team;
  players: Player[];
  offense: number;
  defense: number;
  pace: number;
};

type PlayerState = {
  player: Player;
  rotationSlot: number;
  overall: number;
  fatigue: number; // 0..1
  fouls: number;
  secondsPlayed: number;
  stintSeconds: number;
};

type TeamSimState = {
  context: TeamContext;
  states: PlayerState[];
  lineup: string[];
  box: PlayerBoxScore[];
};

const calcOverall = (player: Player): number =>
  Math.round(
    player.ratings.insideScoring * 0.14 +
      player.ratings.midRangeScoring * 0.1 +
      player.ratings.threePointScoring * 0.14 +
      player.ratings.playmaking * 0.12 +
      player.ratings.perimeterDefense * 0.14 +
      player.ratings.interiorDefense * 0.14 +
      player.ratings.rebounding * 0.12 +
      player.ratings.stamina * 0.1
  );

const calcTeamProfile = (team: Team, allPlayers: Player[]): TeamContext => {
  const players = allPlayers.filter((p) => p.teamId === team.id);
  const weighted = players.reduce(
    (acc, player) => {
      const m = player.minutesTarget;
      acc.off +=
        m *
        (player.ratings.insideScoring * 0.27 +
          player.ratings.midRangeScoring * 0.17 +
          player.ratings.threePointScoring * 0.24 +
          player.ratings.playmaking * 0.22 +
          player.ratings.stamina * 0.1);
      acc.def +=
        m *
        (player.ratings.perimeterDefense * 0.36 +
          player.ratings.interiorDefense * 0.34 +
          player.ratings.rebounding * 0.2 +
          player.ratings.stamina * 0.1);
      acc.pace += m * (player.tendencies.driveRate * 0.65 + player.tendencies.shot3Rate * 0.35);
      acc.min += m;
      return acc;
    },
    { off: 0, def: 0, pace: 0, min: 0 }
  );

  return {
    team,
    players,
    offense: weighted.off / weighted.min,
    defense: weighted.def / weighted.min,
    pace: weighted.pace / weighted.min
  };
};

const normalizePossessions = (homePace: number, awayPace: number, rng: RandomSource): number => {
  const meanPace = (homePace + awayPace) / 2;
  const base = 76 + Math.round((meanPace - 0.27) * 35);
  return Math.max(70, Math.min(84, base + randomInt(-2, 2, rng)));
};

const initBox = (players: Player[]): PlayerBoxScore[] =>
  players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    minutes: 0,
    points: 0,
    rebounds: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    fouls: 0,
    turnovers: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0
  }));

const chooseByWeight = <T>(items: T[], weightFn: (item: T) => number, rng: RandomSource): T => {
  const total = items.reduce((sum, item) => sum + Math.max(0.001, weightFn(item)), 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0.001, weightFn(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
};

const toMinute = (seconds: number): number => Math.round((seconds / 60) * 10) / 10;

const roleBand = (player: PlayerState): 'star' | 'starter' | 'sixth' | 'role' | 'bench' => {
  if (player.player.minutesTarget >= 30 || player.overall >= 82) return 'star';
  if (player.player.minutesTarget >= 24 || player.overall >= 78) return 'starter';
  if (player.player.minutesTarget >= 18 || player.overall >= 74) return 'sixth';
  if (player.player.minutesTarget >= 10 || player.overall >= 69) return 'role';
  return 'bench';
};

const targetMinutesForGameState = (
  ps: PlayerState,
  quarter: number,
  secondsLeft: number,
  scoreMargin: number
): number => {
  const base =
    ps.rotationSlot === 0
      ? 32
      : ps.rotationSlot <= 4
        ? 27
        : ps.rotationSlot === 5
          ? 22
          : ps.rotationSlot <= 8
            ? 14
            : 6;
  const band = roleBand(ps);
  let target = base;

  if (quarter === 4 && secondsLeft <= 360 && Math.abs(scoreMargin) <= 8 && (band === 'star' || band === 'starter')) {
    target += band === 'star' ? 3.5 : 2;
  }

  if (quarter === 4 && secondsLeft <= 300 && Math.abs(scoreMargin) >= 15) {
    if (band === 'star' || band === 'starter') target -= 5;
    if (band === 'bench' || band === 'role') target += 3;
  }

  if ((quarter === 1 && ps.fouls >= 2) || (quarter === 2 && ps.fouls >= 3) || (quarter === 3 && ps.fouls >= 4)) {
    target -= 6;
  }
  if (quarter === 4 && ps.fouls >= 5) target -= 7;

  const fatiguePenalty = Math.max(0, ps.fatigue - 0.6) * 10;
  target -= fatiguePenalty;

  return Math.max(0, Math.min(37, target));
};

const lineupHas = (lineup: PlayerState[], predicate: (p: PlayerState) => boolean): boolean => lineup.some(predicate);

const lineupScore = (
  lineup: PlayerState[],
  quarter: number,
  secondsLeft: number,
  scoreMargin: number
): number => {
  let score = 0;
  let guards = 0;
  let bigs = 0;

  for (const ps of lineup) {
    const target = targetMinutesForGameState(ps, quarter, secondsLeft, scoreMargin);
    const currentMin = ps.secondsPlayed / 60;
    const minutePressure = target - currentMin;
    const fatigueHit = ps.fatigue * 18;
    const foulHit = ps.fouls >= 5 ? 35 : ps.fouls * 3;
    const talent = ps.overall + ps.player.ratings.playmaking * 0.12 + ps.player.ratings.rebounding * 0.08;

    score += talent + minutePressure * 2.9 - fatigueHit - foulHit;

    if (['PG', 'SG'].includes(ps.player.position)) guards += 1;
    if (['PF', 'C'].includes(ps.player.position)) bigs += 1;
  }

  const hasHandler = lineupHas(
    lineup,
    (p) => p.player.role === 'primary_ball_handler' || p.player.role === 'secondary_creator' || (p.player.position === 'PG' && p.player.ratings.playmaking >= 72)
  );
  const hasWing = lineupHas(
    lineup,
    (p) => ['SG', 'SF'].includes(p.player.position) || ['wing_scorer', '3_and_d'].includes(p.player.role)
  );
  const hasBig = lineupHas(lineup, (p) => ['PF', 'C'].includes(p.player.position));
  const hasRimReb = lineupHas(
    lineup,
    (p) => p.player.role === 'rim_protector' || p.player.position === 'C' || p.player.ratings.rebounding >= 76 || p.player.ratings.interiorDefense >= 78
  );

  if (!hasHandler) score -= 24;
  if (!hasWing) score -= 16;
  if (!hasBig) score -= 18;
  if (!hasRimReb) score -= 14;

  if (guards >= 5 || bigs >= 5) score -= 40;
  if (guards >= 4 || bigs >= 4) score -= 18;

  return score;
};

const chooseBestLineup = (
  states: PlayerState[],
  quarter: number,
  secondsLeft: number,
  scoreMargin: number,
  rng: RandomSource
): string[] => {
  let bestIds = states.slice(0, 5).map((s) => s.player.id);
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < states.length - 4; i += 1) {
    for (let j = i + 1; j < states.length - 3; j += 1) {
      for (let k = j + 1; k < states.length - 2; k += 1) {
        for (let l = k + 1; l < states.length - 1; l += 1) {
          for (let m = l + 1; m < states.length; m += 1) {
            const lineup = [states[i], states[j], states[k], states[l], states[m]];
            const score = lineupScore(lineup, quarter, secondsLeft, scoreMargin) + rng() * 0.25;
            if (score > bestScore) {
              bestScore = score;
              bestIds = lineup.map((p) => p.player.id);
            }
          }
        }
      }
    }
  }

  return bestIds;
};

const quarterFromElapsed = (elapsedSeconds: number): number => Math.min(4, Math.floor(elapsedSeconds / 600) + 1);

const updateFatigue = (state: TeamSimState, tickSeconds: number): void => {
  const onCourt = new Set(state.lineup);
  for (const ps of state.states) {
    const staminaFactor = (100 - ps.player.ratings.stamina) / 100;
    if (onCourt.has(ps.player.id)) {
      ps.secondsPlayed += tickSeconds;
      ps.stintSeconds += tickSeconds;
      const stintTax = Math.max(0, ps.stintSeconds - 180) / 900;
      ps.fatigue = Math.min(1, ps.fatigue + tickSeconds * (0.0007 + staminaFactor * 0.0015 + stintTax * 0.001));
    } else {
      ps.stintSeconds = 0;
      ps.fatigue = Math.max(0, ps.fatigue - tickSeconds * (0.001 + ps.player.ratings.stamina * 0.00001));
    }
  }
};

const applyPossession = (
  offense: TeamSimState,
  defense: TeamSimState,
  quarter: number,
  secondsLeftInQuarter: number,
  marginForOffense: number,
  rng: RandomSource
): number => {
  const offLineup = offense.states.filter((s) => offense.lineup.includes(s.player.id));
  const defLineup = defense.states.filter((s) => defense.lineup.includes(s.player.id));

  const offMean = offLineup.reduce((sum, p) => sum + p.overall, 0) / offLineup.length;
  const defMean = defLineup.reduce((sum, p) => sum + p.overall, 0) / defLineup.length;
  const teamFatigue = offLineup.reduce((sum, p) => sum + p.fatigue, 0) / offLineup.length;

  const shooter = chooseByWeight(
    offLineup,
    (p) => {
      const creatorBoost = p.player.role === 'primary_ball_handler' || p.player.role === 'wing_scorer' ? 1.18 : 1;
      const shotSkill = p.player.ratings.insideScoring * 0.45 + p.player.ratings.midRangeScoring * 0.25 + p.player.ratings.threePointScoring * 0.3;
      const minuteBandBoost = roleBand(p) === 'star' ? 1.15 : roleBand(p) === 'bench' ? 0.85 : 1;
      return shotSkill * creatorBoost * minuteBandBoost * (1 - p.fatigue * 0.55);
    },
    rng
  );

  const shooterRow = offense.box.find((b) => b.playerId === shooter.player.id);
  if (!shooterRow) return 0;

  const passingValue = offLineup.reduce((sum, p) => sum + p.player.ratings.playmaking * (1 - p.fatigue * 0.45), 0) / offLineup.length;
  const turnoverProb = Math.max(
    0.07,
    Math.min(
      0.19,
      0.125 +
        (defMean - offMean) * 0.0013 +
        (teamFatigue - 0.32) * 0.05 -
        (passingValue - 74) * 0.0012
    )
  );

  if (rng() < turnoverProb) {
    shooterRow.turnovers += 1;
    if (rng() < 0.32) {
      const stealer = chooseByWeight(defLineup, (p) => p.player.ratings.perimeterDefense * (1 - p.fatigue * 0.5), rng);
      const stealerRow = defense.box.find((b) => b.playerId === stealer.player.id);
      if (stealerRow) stealerRow.steals += 1;
    }
    return 0;
  }

  const zoneRoll = rng();
  const shootThree = zoneRoll < shooter.player.tendencies.shot3Rate;
  const shootInside = zoneRoll > 1 - shooter.player.tendencies.driveRate;
  const shotRating = shootThree
    ? shooter.player.ratings.threePointScoring
    : shootInside
      ? shooter.player.ratings.insideScoring
      : shooter.player.ratings.midRangeScoring;

  const defenseRating =
    defLineup.reduce(
      (sum, p) =>
        sum +
        (shootInside ? p.player.ratings.interiorDefense * 1.1 : p.player.ratings.perimeterDefense) * (1 - p.fatigue * 0.35),
      0
    ) / defLineup.length;

  let makeProb = 0.425 + (shotRating - defenseRating) * 0.005;
  makeProb += shootThree ? -0.045 : 0.035;
  makeProb -= shooter.fatigue * 0.09;
  makeProb += Math.max(-0.02, Math.min(0.02, marginForOffense * -0.0012));
  if (quarter === 4 && secondsLeftInQuarter <= 120) makeProb += shootThree ? 0.003 : -0.003;
  makeProb = Math.max(0.2, Math.min(0.69, makeProb));

  shooterRow.fga += 1;
  if (shootThree) shooterRow.tpa += 1;

  if (rng() < makeProb) {
    shooterRow.fgm += 1;
    const points = shootThree ? 3 : 2;
    if (shootThree) shooterRow.tpm += 1;
    shooterRow.points += points;

    if (rng() < 0.62) {
      const assisterPool = offLineup.filter((p) => p.player.id !== shooter.player.id);
      const assister = chooseByWeight(assisterPool, (p) => p.player.ratings.playmaking * (1 - p.fatigue * 0.4), rng);
      const astRow = offense.box.find((b) => b.playerId === assister.player.id);
      if (astRow) astRow.assists += 1;
    }
    return points;
  }

  const foulDraw = shooter.player.tendencies.foulDrawRate * 1.4 * (1 + shooter.fatigue * 0.15);
  if (rng() < foulDraw) {
    const defender = chooseByWeight(defLineup, (p) => p.player.ratings.interiorDefense + p.player.ratings.perimeterDefense, rng);
    const defenderRow = defense.box.find((b) => b.playerId === defender.player.id);
    defender.fouls += 1;
    if (defenderRow) defenderRow.fouls += 1;

    if (defender.fouls >= 6 && defenderRow) {
      // mark severe foul trouble so lineup engine naturally benches out.
      defender.fatigue = Math.max(defender.fatigue, 0.82);
    }

    const attempts = shootThree ? 3 : 2;
    let points = 0;
    for (let i = 0; i < attempts; i += 1) {
      shooterRow.fta += 1;
      const ftProb = Math.max(0.5, Math.min(0.94, 0.62 + shooter.player.ratings.midRangeScoring * 0.0034 - shooter.fatigue * 0.08));
      if (rng() < ftProb) {
        shooterRow.ftm += 1;
        shooterRow.points += 1;
        points += 1;
      }
    }
    return points;
  }

  const offRebStrength =
    offLineup.reduce((sum, p) => sum + p.player.ratings.rebounding * (1 - p.fatigue * 0.35), 0) / offLineup.length;
  const defRebStrength =
    defLineup.reduce((sum, p) => sum + p.player.ratings.rebounding * (1 - p.fatigue * 0.35), 0) / defLineup.length;

  const blockChance = Math.max(0.02, Math.min(0.12, 0.045 + (defRebStrength - offRebStrength) * 0.001));
  if (shootInside && rng() < blockChance) {
    const blocker = chooseByWeight(defLineup, (p) => p.player.ratings.interiorDefense, rng);
    const blockRow = defense.box.find((b) => b.playerId === blocker.player.id);
    if (blockRow) blockRow.blocks += 1;
  }

  const offRebChance = Math.max(0.14, Math.min(0.31, 0.21 + (offRebStrength - defRebStrength) * 0.0018));
  if (rng() < offRebChance) {
    const rebounder = chooseByWeight(offLineup, (p) => p.player.ratings.rebounding * (1 - p.fatigue * 0.4), rng);
    const rebRow = offense.box.find((b) => b.playerId === rebounder.player.id);
    if (rebRow) {
      rebRow.rebounds += 1;
      rebRow.offensiveRebounds += 1;
    }
    return applyPossession(offense, defense, quarter, secondsLeftInQuarter, marginForOffense, rng);
  }

  const defensiveRebounder = chooseByWeight(defLineup, (p) => p.player.ratings.rebounding * (1 - p.fatigue * 0.4), rng);
  const defRebRow = defense.box.find((b) => b.playerId === defensiveRebounder.player.id);
  if (defRebRow) {
    defRebRow.rebounds += 1;
    defRebRow.defensiveRebounds += 1;
  }

  return 0;
};

const createTeamSimState = (context: TeamContext): TeamSimState => {
  const states = context.players.map((player) => ({
    player,
    rotationSlot: 0,
    overall: calcOverall(player),
    fatigue: 0,
    fouls: 0,
    secondsPlayed: 0,
    stintSeconds: 0
  }));

  states.sort((a, b) => b.player.minutesTarget - a.player.minutesTarget || b.overall - a.overall);
  states.forEach((state, index) => {
    state.rotationSlot = index;
  });

  return {
    context,
    states,
    lineup: states.slice(0, 5).map((s) => s.player.id),
    box: initBox(context.players)
  };
};

const scoreByQuarterFromEvents = (events: { home: number; away: number; quarter: number }[]): {
  home: [number, number, number, number];
  away: [number, number, number, number];
} => {
  const home: [number, number, number, number] = [0, 0, 0, 0];
  const away: [number, number, number, number] = [0, 0, 0, 0];
  for (const ev of events) {
    home[ev.quarter - 1] += ev.home;
    away[ev.quarter - 1] += ev.away;
  }
  return { home, away };
};

export const simulateGame = (
  homeTeam: Team,
  awayTeam: Team,
  allPlayers: Player[],
  seed = Date.now()
): GameResult => {
  const rng = createSeededRandom(seed);
  const homeContext = calcTeamProfile(homeTeam, allPlayers);
  const awayContext = calcTeamProfile(awayTeam, allPlayers);

  const home = createTeamSimState(homeContext);
  const away = createTeamSimState(awayContext);

  const possessionsPerTeam = normalizePossessions(homeContext.pace, awayContext.pace, rng);
  const totalPossessions = possessionsPerTeam * 2;

  let homeScore = 0;
  let awayScore = 0;
  let elapsedSeconds = 0;
  const possessionEvents: { home: number; away: number; quarter: number }[] = [];

  let homeOnOffense = rng() < 0.5;

  for (let i = 0; i < totalPossessions; i += 1) {
    const tickSeconds = randomInt(11, 24, rng);
    elapsedSeconds = Math.min(2400, elapsedSeconds + tickSeconds);

    const quarter = quarterFromElapsed(elapsedSeconds);
    const quarterStart = (quarter - 1) * 600;
    const secondsLeftInQuarter = 600 - (elapsedSeconds - quarterStart);

    const margin = homeScore - awayScore;

    if (i % 3 === 0 || quarterStart === elapsedSeconds) {
      home.lineup = chooseBestLineup(home.states, quarter, secondsLeftInQuarter, margin, rng);
      away.lineup = chooseBestLineup(away.states, quarter, secondsLeftInQuarter, -margin, rng);
    }

    updateFatigue(home, tickSeconds);
    updateFatigue(away, tickSeconds);

    if (homeOnOffense) {
      const points = applyPossession(home, away, quarter, secondsLeftInQuarter, margin, rng);
      homeScore += points;
      possessionEvents.push({ home: points, away: 0, quarter });
    } else {
      const points = applyPossession(away, home, quarter, secondsLeftInQuarter, -margin, rng);
      awayScore += points;
      possessionEvents.push({ home: 0, away: points, quarter });
    }

    homeOnOffense = !homeOnOffense;
    if (elapsedSeconds >= 2400) break;
  }

  if (homeScore === awayScore) {
    if (rng() < 0.5) homeScore += randomInt(2, 7, rng);
    else awayScore += randomInt(2, 7, rng);
  }

  for (const row of home.box) {
    const ps = home.states.find((s) => s.player.id === row.playerId);
    if (ps) row.minutes = toMinute(ps.secondsPlayed);
  }
  for (const row of away.box) {
    const ps = away.states.find((s) => s.player.id === row.playerId);
    if (ps) row.minutes = toMinute(ps.secondsPlayed);
  }

  const qScore = scoreByQuarterFromEvents(possessionEvents);

  return {
    id: `game-${seed}`,
    home: {
      teamId: homeContext.team.id,
      teamName: homeContext.team.name,
      score: homeScore,
      byQuarter: qScore.home,
      players: home.box
    },
    away: {
      teamId: awayContext.team.id,
      teamName: awayContext.team.name,
      score: awayScore,
      byQuarter: qScore.away,
      players: away.box
    },
    winnerTeamId: homeScore > awayScore ? homeContext.team.id : awayContext.team.id
  };
};
