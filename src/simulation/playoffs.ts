import type { Conference, PlayoffBracket, PlayoffSeries, StandingRow, Team } from '../domain/types';
import type { Player } from '../domain/types';
import { leagueRules } from '../domain/rules';
import { simulateGame } from './engine';

const winsNeeded = (bestOf: number): number => Math.floor(bestOf / 2) + 1;

const homeByGameNumber = (gameNumber: number): 'higher' | 'lower' => {
  const pattern: Array<'higher' | 'lower'> = ['higher', 'higher', 'lower', 'lower', 'higher', 'lower', 'higher'];
  return pattern[gameNumber - 1] ?? 'higher';
};

const sortRows = (rows: StandingRow[]): StandingRow[] =>
  [...rows].sort((a, b) => b.winPct - a.winPct || b.pointDiff - a.pointDiff || b.pointsFor - a.pointsFor || a.id.localeCompare(b.id));

const conferenceSeeds = (rows: StandingRow[], conference: Conference): Array<{ seed: number; teamId: string }> =>
  sortRows(rows)
    .filter((row) => row.conference === conference)
    .slice(0, leagueRules.playoffs.playoffsNumTeamsPerConf)
    .map((row, index) => ({ seed: index + 1, teamId: row.id }));

const createSeries = (
  id: string,
  round: PlayoffSeries['round'],
  higherSeed: number,
  lowerSeed: number,
  conference?: Conference,
  higherSeedTeamId?: string,
  lowerSeedTeamId?: string
): PlayoffSeries => ({
  id,
  round,
  conference,
  bestOf: leagueRules.playoffs.numGamesPlayoffSeries[round === 'conference_semifinals' ? 0 : round === 'conference_finals' ? 1 : 2],
  higherSeed,
  lowerSeed,
  higherSeedTeamId,
  lowerSeedTeamId,
  winsByTeamId: {},
  games: []
});

export const generatePlayoffBracket = (rows: StandingRow[]): PlayoffBracket => {
  const aSeeds = conferenceSeeds(rows, 'A');
  const bSeeds = conferenceSeeds(rows, 'B');

  if (aSeeds.length < 4 || bSeeds.length < 4) {
    throw new Error('Cannot generate playoffs without top 4 teams in each conference.');
  }

  return {
    generated: true,
    conferenceSemifinals: {
      a1v4: createSeries('A-SF-1v4', 'conference_semifinals', 1, 4, 'A', aSeeds[0].teamId, aSeeds[3].teamId),
      a2v3: createSeries('A-SF-2v3', 'conference_semifinals', 2, 3, 'A', aSeeds[1].teamId, aSeeds[2].teamId),
      b1v4: createSeries('B-SF-1v4', 'conference_semifinals', 1, 4, 'B', bSeeds[0].teamId, bSeeds[3].teamId),
      b2v3: createSeries('B-SF-2v3', 'conference_semifinals', 2, 3, 'B', bSeeds[1].teamId, bSeeds[2].teamId)
    },
    conferenceFinals: {
      a: createSeries('A-FINAL', 'conference_finals', 1, 2, 'A'),
      b: createSeries('B-FINAL', 'conference_finals', 1, 2, 'B')
    },
    bsnFinal: createSeries('BSN-FINAL', 'bsn_final', 1, 2),
    championTeamId: undefined
  };
};

const seedMapFromBracket = (bracket: PlayoffBracket): Map<string, number> => {
  const map = new Map<string, number>();
  const semifinals = Object.values(bracket.conferenceSemifinals);
  for (const series of semifinals) {
    if (series.higherSeedTeamId) map.set(series.higherSeedTeamId, series.higherSeed);
    if (series.lowerSeedTeamId) map.set(series.lowerSeedTeamId, series.lowerSeed);
  }
  return map;
};

const setRoundMatchups = (bracket: PlayoffBracket): PlayoffBracket => {
  const next = structuredClone(bracket);
  const seeds = seedMapFromBracket(next);

  const aLeftWinner = next.conferenceSemifinals.a1v4.winnerTeamId;
  const aRightWinner = next.conferenceSemifinals.a2v3.winnerTeamId;
  if (aLeftWinner && aRightWinner && !next.conferenceFinals.a.higherSeedTeamId && !next.conferenceFinals.a.lowerSeedTeamId) {
    const leftSeed = seeds.get(aLeftWinner) ?? 99;
    const rightSeed = seeds.get(aRightWinner) ?? 99;
    if (leftSeed <= rightSeed) {
      next.conferenceFinals.a.higherSeedTeamId = aLeftWinner;
      next.conferenceFinals.a.lowerSeedTeamId = aRightWinner;
      next.conferenceFinals.a.higherSeed = leftSeed;
      next.conferenceFinals.a.lowerSeed = rightSeed;
    } else {
      next.conferenceFinals.a.higherSeedTeamId = aRightWinner;
      next.conferenceFinals.a.lowerSeedTeamId = aLeftWinner;
      next.conferenceFinals.a.higherSeed = rightSeed;
      next.conferenceFinals.a.lowerSeed = leftSeed;
    }
  }

  const bLeftWinner = next.conferenceSemifinals.b1v4.winnerTeamId;
  const bRightWinner = next.conferenceSemifinals.b2v3.winnerTeamId;
  if (bLeftWinner && bRightWinner && !next.conferenceFinals.b.higherSeedTeamId && !next.conferenceFinals.b.lowerSeedTeamId) {
    const leftSeed = seeds.get(bLeftWinner) ?? 99;
    const rightSeed = seeds.get(bRightWinner) ?? 99;
    if (leftSeed <= rightSeed) {
      next.conferenceFinals.b.higherSeedTeamId = bLeftWinner;
      next.conferenceFinals.b.lowerSeedTeamId = bRightWinner;
      next.conferenceFinals.b.higherSeed = leftSeed;
      next.conferenceFinals.b.lowerSeed = rightSeed;
    } else {
      next.conferenceFinals.b.higherSeedTeamId = bRightWinner;
      next.conferenceFinals.b.lowerSeedTeamId = bLeftWinner;
      next.conferenceFinals.b.higherSeed = rightSeed;
      next.conferenceFinals.b.lowerSeed = leftSeed;
    }
  }

  const aChampion = next.conferenceFinals.a.winnerTeamId;
  const bChampion = next.conferenceFinals.b.winnerTeamId;
  if (aChampion && bChampion && !next.bsnFinal.higherSeedTeamId && !next.bsnFinal.lowerSeedTeamId) {
    const aSeed = seeds.get(aChampion) ?? 99;
    const bSeed = seeds.get(bChampion) ?? 99;
    if (aSeed <= bSeed) {
      next.bsnFinal.higherSeedTeamId = aChampion;
      next.bsnFinal.lowerSeedTeamId = bChampion;
      next.bsnFinal.higherSeed = aSeed;
      next.bsnFinal.lowerSeed = bSeed;
    } else {
      next.bsnFinal.higherSeedTeamId = bChampion;
      next.bsnFinal.lowerSeedTeamId = aChampion;
      next.bsnFinal.higherSeed = bSeed;
      next.bsnFinal.lowerSeed = aSeed;
    }
  }

  if (next.bsnFinal.winnerTeamId) next.championTeamId = next.bsnFinal.winnerTeamId;
  return next;
};

const teamById = (teams: Team[], id: string | undefined): Team | undefined => teams.find((team) => team.id === id);

const playGameInSeries = (series: PlayoffSeries, teams: Team[], players: Player[], gameSeed: number): PlayoffSeries => {
  if (series.winnerTeamId) return series;
  const higher = teamById(teams, series.higherSeedTeamId);
  const lower = teamById(teams, series.lowerSeedTeamId);
  if (!higher || !lower) return series;

  const nextGameNumber = series.games.length + 1;
  const higherAtHome = homeByGameNumber(nextGameNumber) === 'higher';
  const home = higherAtHome ? higher : lower;
  const away = higherAtHome ? lower : higher;

  const result = simulateGame(home, away, players, gameSeed);
  const winnerWins = (series.winsByTeamId[result.winnerTeamId] ?? 0) + 1;
  const winsByTeamId = { ...series.winsByTeamId, [result.winnerTeamId]: winnerWins };
  const needed = winsNeeded(series.bestOf);

  return {
    ...series,
    winsByTeamId,
    games: [
      ...series.games,
      {
        gameNumber: nextGameNumber,
        homeTeamId: home.id,
        awayTeamId: away.id,
        seed: gameSeed,
        resultId: result.id,
        homeScore: result.home.score,
        awayScore: result.away.score,
        winnerTeamId: result.winnerTeamId
      }
    ],
    winnerTeamId: winnerWins >= needed ? result.winnerTeamId : series.winnerTeamId
  };
};

const seriesList = (bracket: PlayoffBracket): PlayoffSeries[] => [
  bracket.conferenceSemifinals.a1v4,
  bracket.conferenceSemifinals.a2v3,
  bracket.conferenceSemifinals.b1v4,
  bracket.conferenceSemifinals.b2v3,
  bracket.conferenceFinals.a,
  bracket.conferenceFinals.b,
  bracket.bsnFinal
];

const hasParticipants = (series: PlayoffSeries): boolean => Boolean(series.higherSeedTeamId && series.lowerSeedTeamId);

export const simulateNextPlayoffSeries = (
  bracket: PlayoffBracket,
  teams: Team[],
  players: Player[],
  baseSeed: number
): PlayoffBracket => {
  let next = setRoundMatchups(bracket);
  const order = seriesList(next);
  const target = order.find((series) => hasParticipants(series) && !series.winnerTeamId);
  if (!target) return next;

  const targetIndex = order.findIndex((s) => s.id === target.id);
  let mutableSeries = target;
  while (!mutableSeries.winnerTeamId && hasParticipants(mutableSeries)) {
    const gameSeed = baseSeed * 1_000_000 + (targetIndex + 1) * 1_000 + mutableSeries.games.length + 1;
    mutableSeries = playGameInSeries(mutableSeries, teams, players, gameSeed);
  }

  next = {
    ...next,
    conferenceSemifinals: {
      ...next.conferenceSemifinals,
      a1v4: target.id === next.conferenceSemifinals.a1v4.id ? mutableSeries : next.conferenceSemifinals.a1v4,
      a2v3: target.id === next.conferenceSemifinals.a2v3.id ? mutableSeries : next.conferenceSemifinals.a2v3,
      b1v4: target.id === next.conferenceSemifinals.b1v4.id ? mutableSeries : next.conferenceSemifinals.b1v4,
      b2v3: target.id === next.conferenceSemifinals.b2v3.id ? mutableSeries : next.conferenceSemifinals.b2v3
    },
    conferenceFinals: {
      ...next.conferenceFinals,
      a: target.id === next.conferenceFinals.a.id ? mutableSeries : next.conferenceFinals.a,
      b: target.id === next.conferenceFinals.b.id ? mutableSeries : next.conferenceFinals.b
    },
    bsnFinal: target.id === next.bsnFinal.id ? mutableSeries : next.bsnFinal
  };

  return setRoundMatchups(next);
};

export const simulateEntirePlayoffs = (
  bracket: PlayoffBracket,
  teams: Team[],
  players: Player[],
  baseSeed: number
): PlayoffBracket => {
  let next = bracket;
  for (let i = 0; i < 7; i += 1) {
    const updated = simulateNextPlayoffSeries(next, teams, players, baseSeed);
    if (updated.championTeamId || JSON.stringify(updated) === JSON.stringify(next)) {
      next = updated;
      break;
    }
    next = updated;
  }
  return next;
};
