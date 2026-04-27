import type { AvailabilityStatus, GameResult, Player, PlayerBoxScore, ScheduledGame, SimplifiedPlayerRatings, Team } from '../domain/types';
import { calculatePlayerOverall, legacyTendenciesFromPlayer, simplifiedRatingsFromDetailed } from '../domain/playerRatings';
import { leagueRules } from '../domain/rules';
import { createSeededRandom, randomInt, type RandomSource } from './random';

type TeamContext = {
  team: Team;
  players: Player[];
  offense: number;
  defense: number;
  pace: number;
};

type RuntimePlayerSource = {
  fatigue: number;
  injury: { gamesRemaining: number } | null;
  availability?: AvailabilityStatus;
  starter?: boolean;
  rotationOrder?: number;
  minutesOverride?: number | null;
};

type SimulationOptions = {
  runtimePlayers?: Record<string, RuntimePlayerSource>;
  schedule?: ScheduledGame[];
  gameDate?: string;
  gameNumber?: number;
};

type PlayerState = {
  player: Player;
  simpleRatings: SimplifiedPlayerRatings;
  tendencies: ReturnType<typeof legacyTendenciesFromPlayer>;
  rotationSlot: number;
  targetMinutes: number;
  overall: number;
  fatigue: number; // 0..1
  availability: AvailabilityStatus;
  canPlay: boolean;
  fouls: number;
  secondsPlayed: number;
  stintSeconds: number;
};

type TeamSimState = {
  context: TeamContext;
  states: PlayerState[];
  lineup: string[];
  box: PlayerBoxScore[];
  teamFoulsByPeriod: number[];
};

const calcOverall = (player: Player): number => calculatePlayerOverall(player);

export const calculateMakeProbability = (params: {
  shotRating: number;
  defenseRating: number;
  shootThree: boolean;
  offenseBoost: number;
  fatigue: number;
  marginForOffense: number;
  quarter: number;
  secondsLeftInQuarter: number;
}): number => {
  const { shotRating, defenseRating, shootThree, offenseBoost, fatigue, marginForOffense, quarter, secondsLeftInQuarter } = params;
  let makeProb = 0.425 + (shotRating - defenseRating) * 0.005;
  makeProb += shootThree ? -0.045 : 0.035;
  makeProb *= shootThree ? leagueRules.simulation.threePointAccuracyFactor : leagueRules.simulation.twoPointAccuracyFactor;
  makeProb *= offenseBoost;
  makeProb -= fatigue * 0.07;
  makeProb += Math.max(-0.02, Math.min(0.02, marginForOffense * -0.0012));
  if (quarter === 4 && secondsLeftInQuarter <= 120) makeProb += shootThree ? 0.003 : -0.003;
  return Math.max(0.2, Math.min(0.69, makeProb));
};

const calcTeamProfile = (team: Team, allPlayers: Player[]): TeamContext => {
  const players = allPlayers.filter((p) => p.teamId === team.id);
  const weighted = players.reduce(
    (acc, player) => {
      const m = player.minutesTarget;
      const simpleRatings = simplifiedRatingsFromDetailed(player);
      const tendencies = legacyTendenciesFromPlayer(player);
      acc.off +=
        m *
        (simpleRatings.insideScoring * 0.27 +
          simpleRatings.midRangeScoring * 0.17 +
          simpleRatings.threePointScoring * 0.24 +
          simpleRatings.playmaking * 0.22 +
          simpleRatings.stamina * 0.1);
      acc.def +=
        m *
        (simpleRatings.perimeterDefense * 0.36 +
          simpleRatings.interiorDefense * 0.34 +
          simpleRatings.rebounding * 0.2 +
          simpleRatings.stamina * 0.1);
      acc.pace += m * (tendencies.driveRate * 0.65 + tendencies.shot3Rate * 0.35);
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

const gameLengthMinutes = leagueRules.game.numPeriods * leagueRules.game.quarterLength;
const totalGameSeconds = gameLengthMinutes * 60;
const perTeamPaceTarget = leagueRules.simulation.paceIsPer48
  ? (leagueRules.simulation.pace * gameLengthMinutes) / 48
  : leagueRules.simulation.pace;

const normalizePossessions = (homePace: number, awayPace: number, rng: RandomSource): number => {
  const meanPace = (homePace + awayPace) / 2;
  const base = perTeamPaceTarget + Math.round((meanPace - 0.27) * 24);
  return Math.max(perTeamPaceTarget - 6, Math.min(perTeamPaceTarget + 6, base + randomInt(-2, 2, rng)));
};

const previousPlayedDate = (schedule: ScheduledGame[] | undefined, teamId: string, gameNumber: number | undefined): string | null => {
  if (!schedule || gameNumber === undefined) return null;
  const prev = schedule
    .filter((g) => g.played && g.gameNumber < gameNumber && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => b.gameNumber - a.gameNumber)[0];
  return prev?.date ?? null;
};

const daysBetween = (aISO: string, bISO: string): number => {
  const a = Date.parse(`${aISO}T00:00:00.000Z`);
  const b = Date.parse(`${bISO}T00:00:00.000Z`);
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
};

const initBox = (players: Player[]): PlayerBoxScore[] =>
  players.map((p) => ({
    playerId: p.id,
    playerName: p.displayName,
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
    ps.targetMinutes > 0
      ? ps.targetMinutes
      : ps.rotationSlot === 0
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
  if (quarter === 4 && ps.fouls >= leagueRules.game.foulsNeededToFoulOut) target -= 7;

  const fatiguePenalty = Math.max(0, ps.fatigue - 0.6) * 10;
  target -= fatiguePenalty;

  return Math.max(0, Math.min(40, target));
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
    if (!ps.canPlay) return -9999;
    const target = targetMinutesForGameState(ps, quarter, secondsLeft, scoreMargin);
    const currentMin = ps.secondsPlayed / 60;
    const minutePressure = target - currentMin;
    const fatigueHit = ps.fatigue * 12;
    const foulHit = ps.fouls >= leagueRules.game.foulsNeededToFoulOut ? 35 : ps.fouls * 3;
    const talent = ps.overall + ps.simpleRatings.playmaking * 0.12 + ps.simpleRatings.rebounding * 0.08;

    score += talent + minutePressure * 6.2 - fatigueHit - foulHit;

    const primary = ps.player.position;
    const secondaries = ps.player.secondaryPositions;
    if (primary === 'PG' || primary === 'SG' || secondaries.includes('PG') || secondaries.includes('SG')) guards += 1;
    if (primary === 'PF' || primary === 'C' || secondaries.includes('PF') || secondaries.includes('C')) bigs += 1;
  }

  const hasHandler = lineupHas(
    lineup,
    (p) => p.player.role === 'primary_ball_handler' || p.player.role === 'secondary_creator' || (p.player.position === 'PG' && p.simpleRatings.playmaking >= 72)
  );
  const hasWing = lineupHas(
    lineup,
    (p) => ['SG', 'SF'].includes(p.player.position) || ['wing_scorer', '3_and_d'].includes(p.player.role)
  );
  const hasBig = lineupHas(lineup, (p) => ['PF', 'C'].includes(p.player.position));
  const hasRimReb = lineupHas(
    lineup,
    (p) => p.player.role === 'rim_protector' || p.player.position === 'C' || p.simpleRatings.rebounding >= 76 || p.simpleRatings.interiorDefense >= 78
  );

  if (!hasHandler) score -= 24;
  if (!hasWing) score -= 16;
  if (!hasBig) score -= 18;
  if (!hasRimReb) score -= 14;

  if (guards >= 5 || bigs >= 5) score -= 40;
  if (guards >= 4 || bigs >= 4) score -= 18;
  if (lineup.filter((p) => p.player.position === 'C').length >= 3) score -= 20;
  if (lineup.filter((p) => p.player.position === 'PG').length >= 3) score -= 16;

  return score;
};

const chooseBestLineup = (
  states: PlayerState[],
  quarter: number,
  secondsLeft: number,
  scoreMargin: number,
  rng: RandomSource
): string[] => {
  if (states.length <= 5) return states.map((s) => s.player.id);
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

const quarterFromElapsed = (elapsedSeconds: number): number =>
  Math.min(leagueRules.game.numPeriods, Math.floor(elapsedSeconds / (leagueRules.game.quarterLength * 60)) + 1);

const updateFatigue = (state: TeamSimState, tickSeconds: number): void => {
  const onCourt = new Set(state.lineup);
  for (const ps of state.states) {
    const staminaFactor = (100 - ps.simpleRatings.stamina) / 100;
    if (onCourt.has(ps.player.id)) {
      ps.secondsPlayed += tickSeconds;
      ps.stintSeconds += tickSeconds;
      const stintTax = Math.max(0, ps.stintSeconds - 180) / 900;
      ps.fatigue = Math.min(1, ps.fatigue + tickSeconds * (0.00045 + staminaFactor * 0.001 + stintTax * 0.0007));
    } else {
      ps.stintSeconds = 0;
      ps.fatigue = Math.max(0, ps.fatigue - tickSeconds * (0.001 + ps.simpleRatings.stamina * 0.00001));
    }
  }
};

const applyPossession = (
  offense: TeamSimState,
  defense: TeamSimState,
  quarter: number,
  secondsLeftInQuarter: number,
  marginForOffense: number,
  offenseBoost: number,
  rng: RandomSource
): number => {
  const offLineup = offense.states.filter((s) => offense.lineup.includes(s.player.id));
  const defLineup = defense.states.filter((s) => defense.lineup.includes(s.player.id));

  const offMean = offLineup.reduce((sum, p) => sum + p.overall, 0) / offLineup.length;
  const defMean = defLineup.reduce((sum, p) => sum + p.overall, 0) / defLineup.length;
  const teamFatigue = offLineup.reduce((sum, p) => sum + p.fatigue, 0) / offLineup.length;
  const defenseFatigue = defLineup.reduce((sum, p) => sum + p.fatigue, 0) / defLineup.length;

  const shooter = chooseByWeight(
    offLineup,
    (p) => {
      const creatorBoost = p.player.role === 'primary_ball_handler' || p.player.role === 'wing_scorer' ? 1.18 : 1;
      const shotSkill = p.simpleRatings.insideScoring * 0.45 + p.simpleRatings.midRangeScoring * 0.25 + p.simpleRatings.threePointScoring * 0.3;
      const minuteBandBoost = roleBand(p) === 'star' ? 1.15 : roleBand(p) === 'bench' ? 0.85 : 1;
      return shotSkill * creatorBoost * minuteBandBoost * (1 - p.fatigue * 0.55);
    },
    rng
  );

  const shooterRow = offense.box.find((b) => b.playerId === shooter.player.id);
  if (!shooterRow) return 0;

  const passingValue = offLineup.reduce((sum, p) => sum + p.simpleRatings.playmaking * (1 - p.fatigue * 0.45), 0) / offLineup.length;
  const passRateValue = offLineup.reduce((sum, p) => sum + p.tendencies.passRate, 0) / offLineup.length;
  const turnoverProb = Math.max(
    0.06,
    Math.min(
      0.17,
      (0.118 +
        (defMean - offMean) * 0.0012 +
        (teamFatigue - 0.32) * 0.045 -
        (passingValue - 74) * 0.0012 -
        (passRateValue - 0.2) * 0.03) *
        leagueRules.simulation.turnoverFactor
    )
  );

  if (rng() < turnoverProb) {
    shooterRow.turnovers += 1;
    if (rng() < 0.32 * leagueRules.simulation.stealFactor) {
      const stealer = chooseByWeight(defLineup, (p) => p.simpleRatings.perimeterDefense * (1 - p.fatigue * 0.5), rng);
      const stealerRow = defense.box.find((b) => b.playerId === stealer.player.id);
      if (stealerRow) stealerRow.steals += 1;
    }
    return 0;
  }

  const foulLimitIdx = Math.min(leagueRules.game.foulsUntilBonus.length - 1, Math.max(0, quarter - 1));
  const foulLimitForBonus = leagueRules.game.foulsUntilBonus[foulLimitIdx];
  const defenseTeamFouls = defense.teamFoulsByPeriod[foulLimitIdx] ?? 0;
  const bonusMultiplier = defenseTeamFouls >= foulLimitForBonus ? 1.18 : 1;

  const nonShootingFoulProb = 0.027 * leagueRules.simulation.foulRateFactor * (1 + teamFatigue * 0.1 + defenseFatigue * 0.16);
  if (rng() < nonShootingFoulProb) {
    const defender = chooseByWeight(defLineup, (p) => p.simpleRatings.interiorDefense + p.simpleRatings.perimeterDefense, rng);
    const defenderRow = defense.box.find((b) => b.playerId === defender.player.id);
    defender.fouls += 1;
    if (defenderRow) defenderRow.fouls += 1;
    defense.teamFoulsByPeriod[foulLimitIdx] = (defense.teamFoulsByPeriod[foulLimitIdx] ?? 0) + 1;
    if (defense.teamFoulsByPeriod[foulLimitIdx] >= foulLimitForBonus) {
      let points = 0;
      let lastFtMissed = false;
      for (let i = 0; i < 2; i += 1) {
        shooterRow.fta += 1;
        const ftProb = Math.max(
          0.5,
          Math.min(
            0.94,
            (0.62 + shooter.simpleRatings.midRangeScoring * 0.0034 - shooter.fatigue * 0.08) * leagueRules.simulation.ftAccuracyFactor
          )
        );
        if (rng() < ftProb) {
          shooterRow.ftm += 1;
          shooterRow.points += 1;
          points += 1;
          lastFtMissed = false;
        } else if (i === 1) {
          lastFtMissed = true;
        }
      }

      if (lastFtMissed) {
        const ftOffRebChance = Math.max(0.08, Math.min(0.2, 0.12 * leagueRules.simulation.orbFactor));
        if (rng() < ftOffRebChance) {
          const offRebounder = chooseByWeight(offLineup, (p) => p.simpleRatings.rebounding * (1 - p.fatigue * 0.35), rng);
          const offRebRow = offense.box.find((b) => b.playerId === offRebounder.player.id);
          if (offRebRow) {
            offRebRow.rebounds += 1;
            offRebRow.offensiveRebounds += 1;
          }
        } else {
          const defRebounder = chooseByWeight(defLineup, (p) => p.simpleRatings.rebounding * (1 - p.fatigue * 0.35), rng);
          const defRebRow = defense.box.find((b) => b.playerId === defRebounder.player.id);
          if (defRebRow) {
            defRebRow.rebounds += 1;
            defRebRow.defensiveRebounds += 1;
          }
        }
      }

      return points;
    }
    return 0;
  }

  const zoneRoll = rng();
  const shot3Rate = Math.min(0.7, shooter.tendencies.shot3Rate * leagueRules.simulation.threePointTendencyFactor);
  const driveRate = Math.min(0.7, shooter.tendencies.driveRate);
  const rawPostRate = Math.min(0.45, shooter.tendencies.postUpRate);
  const postRate =
    ['PF', 'C'].includes(shooter.player.position) || ['stretch_big', 'rim_protector', 'energy_big', 'rebounding_big', 'post_scorer'].includes(shooter.player.archetype)
      ? rawPostRate
      : rawPostRate * 0.35;
  const shootThree = zoneRoll < shot3Rate;
  const shootInside = !shootThree && zoneRoll < shot3Rate + driveRate + postRate;
  const shotRating = shootThree
    ? shooter.simpleRatings.threePointScoring
    : shootInside
      ? shooter.simpleRatings.insideScoring
      : shooter.simpleRatings.midRangeScoring;

  const defenseRating =
    defLineup.reduce(
      (sum, p) =>
        sum +
        (shootInside ? p.simpleRatings.interiorDefense * 1.1 : p.simpleRatings.perimeterDefense) * (1 - p.fatigue * 0.35),
      0
    ) / defLineup.length;

  const makeProb = calculateMakeProbability({
    shotRating,
    defenseRating,
    shootThree,
    offenseBoost,
    fatigue: shooter.fatigue,
    marginForOffense,
    quarter,
    secondsLeftInQuarter
  });

  shooterRow.fga += 1;
  if (shootThree) shooterRow.tpa += 1;

  if (rng() < makeProb) {
    shooterRow.fgm += 1;
    const points = shootThree ? 3 : 2;
    if (shootThree) shooterRow.tpm += 1;
    shooterRow.points += points;

    const lineupPassIntent = offLineup.reduce((sum, p) => sum + p.tendencies.passRate, 0) / offLineup.length;
    if (rng() < Math.min(0.92, (0.58 + lineupPassIntent * 0.32) * leagueRules.simulation.assistFactor)) {
      const assisterPool = offLineup.filter((p) => p.player.id !== shooter.player.id);
      const assister = chooseByWeight(assisterPool, (p) => p.simpleRatings.playmaking * (1 - p.fatigue * 0.4), rng);
      const astRow = offense.box.find((b) => b.playerId === assister.player.id);
      if (astRow) astRow.assists += 1;
    }
    return points;
  }

  const foulDraw =
    shooter.tendencies.foulDrawRate *
    1.4 *
    leagueRules.simulation.foulRateFactor *
    bonusMultiplier *
    (1 + shooter.fatigue * 0.15);

  if (rng() < foulDraw) {
    const defender = chooseByWeight(defLineup, (p) => p.simpleRatings.interiorDefense + p.simpleRatings.perimeterDefense, rng);
    const defenderRow = defense.box.find((b) => b.playerId === defender.player.id);
    defender.fouls += 1;
    if (defenderRow) defenderRow.fouls += 1;
    defense.teamFoulsByPeriod[foulLimitIdx] = (defense.teamFoulsByPeriod[foulLimitIdx] ?? 0) + 1;

    if (defender.fouls >= leagueRules.game.foulsNeededToFoulOut && defenderRow) {
      defender.fatigue = Math.max(defender.fatigue, 0.82);
    }

    const attempts = shootThree ? 3 : 2;
    let points = 0;
    let lastFtMissed = false;

    for (let i = 0; i < attempts; i += 1) {
      shooterRow.fta += 1;
      const ftProb = Math.max(
        0.5,
        Math.min(
          0.94,
          (0.62 + shooter.simpleRatings.midRangeScoring * 0.0034 - shooter.fatigue * 0.08) * leagueRules.simulation.ftAccuracyFactor
        )
      );
      if (rng() < ftProb) {
        shooterRow.ftm += 1;
        shooterRow.points += 1;
        points += 1;
        lastFtMissed = false;
      } else if (i === attempts - 1) {
        lastFtMissed = true;
      }
    }

    if (lastFtMissed) {
      const ftOffRebChance = Math.max(0.08, Math.min(0.2, 0.12 * leagueRules.simulation.orbFactor));
      if (rng() < ftOffRebChance) {
        const offRebounder = chooseByWeight(offLineup, (p) => p.simpleRatings.rebounding * (1 - p.fatigue * 0.35), rng);
        const offRebRow = offense.box.find((b) => b.playerId === offRebounder.player.id);
        if (offRebRow) {
          offRebRow.rebounds += 1;
          offRebRow.offensiveRebounds += 1;
        }
      } else {
        const defRebounder = chooseByWeight(defLineup, (p) => p.simpleRatings.rebounding * (1 - p.fatigue * 0.35), rng);
        const defRebRow = defense.box.find((b) => b.playerId === defRebounder.player.id);
        if (defRebRow) {
          defRebRow.rebounds += 1;
          defRebRow.defensiveRebounds += 1;
        }
      }
    }

    return points;
  }

  const offRebStrength =
    offLineup.reduce((sum, p) => sum + p.simpleRatings.rebounding * (1 - p.fatigue * 0.35), 0) / offLineup.length;
  const defRebStrength =
    defLineup.reduce((sum, p) => sum + p.simpleRatings.rebounding * (1 - p.fatigue * 0.35), 0) / defLineup.length;

  const blockChance = Math.max(
    0.05,
    Math.min(0.32, (0.052 + (defRebStrength - offRebStrength) * 0.0012) * leagueRules.simulation.blockFactor)
  );
  if (shootInside && rng() < blockChance) {
    const blocker = chooseByWeight(defLineup, (p) => p.simpleRatings.interiorDefense, rng);
    const blockRow = defense.box.find((b) => b.playerId === blocker.player.id);
    if (blockRow) blockRow.blocks += 1;
  }

  const offRebChance = Math.max(
    0.16,
    Math.min(0.42, (0.24 + (offRebStrength - defRebStrength) * 0.0022) * leagueRules.simulation.orbFactor)
  );
  if (rng() < offRebChance) {
    const rebounder = chooseByWeight(offLineup, (p) => p.simpleRatings.rebounding * (1 - p.fatigue * 0.4), rng);
    const rebRow = offense.box.find((b) => b.playerId === rebounder.player.id);
    if (rebRow) {
      rebRow.rebounds += 1;
      rebRow.offensiveRebounds += 1;
    }
    return applyPossession(offense, defense, quarter, secondsLeftInQuarter, marginForOffense, offenseBoost, rng);
  }

  const defensiveRebounder = chooseByWeight(defLineup, (p) => p.simpleRatings.rebounding * (1 - p.fatigue * 0.4), rng);
  const defRebRow = defense.box.find((b) => b.playerId === defensiveRebounder.player.id);
  if (defRebRow) {
    defRebRow.rebounds += 1;
    defRebRow.defensiveRebounds += 1;
  }

  return 0;
};

const createTeamSimState = (context: TeamContext, options: SimulationOptions, warnings: string[]): TeamSimState => {
  const prevDate = previousPlayedDate(options.schedule, context.team.id, options.gameNumber);
  const restDays = prevDate && options.gameDate ? Math.max(0, daysBetween(prevDate, options.gameDate) - 1) : 2;
  const shortRestBoost = restDays === 0 ? 0.12 : restDays === 1 ? 0.05 : 0;
  const runtime = options.runtimePlayers ?? {};

  const allStates = context.players.map((player) => {
    const rt = runtime[player.id];
    const availability = rt?.injury ? 'injured' : rt?.availability ?? 'active';
    const severeFatiguePenalty = (rt?.fatigue ?? 0) >= 85 ? 10 : (rt?.fatigue ?? 0) >= 75 ? 5 : 0;
    return {
      player,
      simpleRatings: simplifiedRatingsFromDetailed(player),
      tendencies: legacyTendenciesFromPlayer(player),
      rotationSlot: rt?.rotationOrder ?? 99,
      targetMinutes: Math.max(0, (rt?.minutesOverride ?? player.minutesTarget) - severeFatiguePenalty),
      overall: calcOverall(player),
      fatigue: Math.min(1, Math.max(0, (rt?.fatigue ?? 0) / 100 + shortRestBoost)),
      availability,
      canPlay: availability === 'active' || availability === 'reserve',
      fouls: 0,
      secondsPlayed: 0,
      stintSeconds: 0
    };
  });

  let states = allStates.filter((s) => s.canPlay);
  states.sort((a, b) => {
    const starterA = runtime[a.player.id]?.starter ? 1 : 0;
    const starterB = runtime[b.player.id]?.starter ? 1 : 0;
    return starterB - starterA || a.rotationSlot - b.rotationSlot || b.targetMinutes - a.targetMinutes || b.overall - a.overall;
  });

  if (states.length < 5) {
    const emergency = allStates
      .filter((s) => s.availability !== 'injured')
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 5);
    states = emergency;
    warnings.push(`Emergency lineup for ${context.team.name}: fewer than 5 legal active/reserve players; forced inactive players to dress.`);    
  }

  states.forEach((state, index) => {
    state.rotationSlot = index;
    if (runtime[state.player.id]?.minutesOverride == null) {
      const slotBase = index === 0 ? 33 : index <= 4 ? 28 : index <= 7 ? 16 : 8;
      state.targetMinutes = Math.max(state.targetMinutes, slotBase);
    }
  });

  return {
    context,
    states,
    lineup: states.slice(0, leagueRules.game.numPlayersOnCourt).map((s) => s.player.id),
    box: initBox(states.map((s) => s.player)),
    teamFoulsByPeriod: Array.from({ length: leagueRules.game.numPeriods }, () => 0)
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
  seed = Date.now(),
  options: SimulationOptions = {}
): GameResult => {
  const rng = createSeededRandom(seed);
  const homeContext = calcTeamProfile(homeTeam, allPlayers);
  const awayContext = calcTeamProfile(awayTeam, allPlayers);

  const warnings: string[] = [];
  const home = createTeamSimState(homeContext, options, warnings);
  const away = createTeamSimState(awayContext, options, warnings);

  const possessionsPerTeam = normalizePossessions(homeContext.pace, awayContext.pace, rng);
  const expectedTotalPossessions = possessionsPerTeam * 2;

  let homeScore = 0;
  let awayScore = 0;
  let elapsedSeconds = 0;
  const possessionEvents: { home: number; away: number; quarter: number }[] = [];

  let homeOnOffense = rng() < 0.5;
  const hcaBoost = 1 + (leagueRules.game.homeCourtAdvantage - 1) * 0.25;

  for (let i = 0; elapsedSeconds < totalGameSeconds; i += 1) {
    const remainingTime = totalGameSeconds - elapsedSeconds;
    const remainingPossessions = Math.max(1, expectedTotalPossessions - i);
    const avgTick = remainingTime / remainingPossessions;
    const tickSeconds = Math.max(8, Math.min(24, Math.round(avgTick + randomInt(-4, 4, rng))));
    elapsedSeconds = Math.min(totalGameSeconds, elapsedSeconds + tickSeconds);

    const quarter = quarterFromElapsed(elapsedSeconds);
    const quarterLengthSeconds = leagueRules.game.quarterLength * 60;
    const quarterStart = (quarter - 1) * quarterLengthSeconds;
    const secondsLeftInQuarter = quarterLengthSeconds - (elapsedSeconds - quarterStart);

    const margin = homeScore - awayScore;

    if (i % 8 === 0 || quarterStart === elapsedSeconds) {
      home.lineup = chooseBestLineup(home.states, quarter, secondsLeftInQuarter, margin, rng);
      away.lineup = chooseBestLineup(away.states, quarter, secondsLeftInQuarter, -margin, rng);
    }

    updateFatigue(home, tickSeconds);
    updateFatigue(away, tickSeconds);

    if (homeOnOffense) {
      const points = applyPossession(home, away, quarter, secondsLeftInQuarter, margin, hcaBoost, rng);
      homeScore += points;
      possessionEvents.push({ home: points, away: 0, quarter });
    } else {
      const points = applyPossession(away, home, quarter, secondsLeftInQuarter, -margin, 1, rng);
      awayScore += points;
      possessionEvents.push({ home: 0, away: points, quarter });
    }

    homeOnOffense = !homeOnOffense;
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
    winnerTeamId: homeScore > awayScore ? homeContext.team.id : awayContext.team.id,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};
