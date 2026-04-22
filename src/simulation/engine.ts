import type { GameResult, Player, PlayerBoxScore, Team } from '../domain/types';
import { createSeededRandom, randomInt, type RandomSource } from './random';

type TeamContext = {
  team: Team;
  players: Player[];
  offense: number;
  defense: number;
  pace: number;
};

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
  const base = 74 + Math.round((meanPace - 0.27) * 35);
  return Math.max(68, Math.min(82, base + randomInt(-2, 2, rng)));
};

const initBox = (players: Player[]): PlayerBoxScore[] =>
  players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    minutes: p.minutesTarget,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0
  }));

const choose = <T>(arr: T[], rng: RandomSource): T => arr[randomInt(0, arr.length - 1, rng)];

const applyTeamPossession = (offense: TeamContext, defense: TeamContext, box: PlayerBoxScore[], rng: RandomSource): number => {
  const shooter = choose(offense.players.slice(0, 10), rng);
  const row = box.find((p) => p.playerId === shooter.id);
  if (!row) return 0;

  const turnoverProb = 0.1 + (defense.defense - offense.offense) * 0.0007;
  if (rng() < turnoverProb) {
    row.turnovers += 1;
    return 0;
  }

  const zoneRoll = rng();
  const shootThree = zoneRoll < shooter.tendencies.shot3Rate;
  const shootInside = zoneRoll > 1 - shooter.tendencies.driveRate;

  const shotRating = shootThree
    ? shooter.ratings.threePointScoring
    : shootInside
      ? shooter.ratings.insideScoring
      : shooter.ratings.midRangeScoring;

  const shotDefense = shootThree ? defense.defense * 0.93 : defense.defense;
  const makeProb = 0.35 + (shotRating - shotDefense) * 0.0042;

  row.fga += 1;
  if (shootThree) row.tpa += 1;

  const madeShot = rng() < Math.max(0.22, Math.min(0.68, makeProb));
  if (madeShot) {
    row.fgm += 1;
    if (shootThree) row.tpm += 1;
    const points = shootThree ? 3 : 2;
    row.points += points;

    if (rng() < 0.58) {
      const assister = choose(offense.players.filter((p) => p.id !== shooter.id).slice(0, 8), rng);
      const astRow = box.find((p) => p.playerId === assister.id);
      if (astRow) astRow.assists += 1;
    }

    return points;
  }

  const drawnFoul = rng() < shooter.tendencies.foulDrawRate * 0.25;
  if (drawnFoul) {
    const attempts = shootThree ? 3 : 2;
    let points = 0;
    for (let i = 0; i < attempts; i += 1) {
      row.fta += 1;
      const ftMade = rng() < (0.62 + shooter.ratings.midRangeScoring * 0.0033);
      if (ftMade) {
        row.ftm += 1;
        row.points += 1;
        points += 1;
      }
    }
    return points;
  }

  const offReb = offense.players[4]?.ratings.rebounding ?? 70;
  const defReb = defense.players[4]?.ratings.rebounding ?? 70;
  if (rng() < 0.26 + (offReb - defReb) * 0.002) {
    const reb = choose(offense.players.slice(2, 10), rng);
    const rebRow = box.find((p) => p.playerId === reb.id);
    if (rebRow) rebRow.rebounds += 1;
    return applyTeamPossession(offense, defense, box, rng);
  }

  return 0;
};

const quartersFromScore = (total: number, rng: RandomSource): [number, number, number, number] => {
  const q1 = Math.round(total * (0.24 + rng() * 0.03));
  const q2 = Math.round(total * (0.24 + rng() * 0.03));
  const q3 = Math.round(total * (0.24 + rng() * 0.03));
  const q4 = total - q1 - q2 - q3;
  return [q1, q2, q3, q4];
};

export const simulateGame = (
  homeTeam: Team,
  awayTeam: Team,
  allPlayers: Player[],
  seed = Date.now()
): GameResult => {
  const rng = createSeededRandom(seed);
  const home = calcTeamProfile(homeTeam, allPlayers);
  const away = calcTeamProfile(awayTeam, allPlayers);
  const homeBox = initBox(home.players);
  const awayBox = initBox(away.players);

  const possessionsPerTeam = normalizePossessions(home.pace, away.pace, rng);

  let homeScore = 0;
  let awayScore = 0;

  for (let i = 0; i < possessionsPerTeam; i += 1) {
    homeScore += applyTeamPossession(home, away, homeBox, rng);
    awayScore += applyTeamPossession(away, home, awayBox, rng);
  }

  if (homeScore === awayScore) {
    if (rng() < 0.5) homeScore += randomInt(2, 7, rng);
    else awayScore += randomInt(2, 7, rng);
  }

  return {
    id: `game-${seed}`,
    home: {
      teamId: home.team.id,
      teamName: home.team.name,
      score: homeScore,
      byQuarter: quartersFromScore(homeScore, rng),
      players: homeBox
    },
    away: {
      teamId: away.team.id,
      teamName: away.team.name,
      score: awayScore,
      byQuarter: quartersFromScore(awayScore, rng),
      players: awayBox
    },
    winnerTeamId: homeScore > awayScore ? home.team.id : away.team.id
  };
};
