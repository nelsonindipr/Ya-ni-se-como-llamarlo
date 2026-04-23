import { initialPlayers } from '../src/data/players';
import { initialTeams } from '../src/data/teams';
import { generateRegularSeasonSchedule, rivalryPairs, validateRegularSeasonSchedule } from '../src/simulation/schedule';
import { simulateGame } from '../src/simulation/engine';

type Sample = {
  points: number;
  possessions: number;
  fga: number;
  fgm: number;
  tpa: number;
  tpm: number;
  fta: number;
  ftm: number;
  turnovers: number;
};

const SEASONS = 12;
const BASE_SEED = 2026;

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

const teamSampleFromBox = (team: { score: number; players: any[] }): Sample => {
  const totals = team.players.reduce(
    (acc, p) => {
      acc.fga += p.fga;
      acc.fgm += p.fgm;
      acc.tpa += p.tpa;
      acc.tpm += p.tpm;
      acc.fta += p.fta;
      acc.ftm += p.ftm;
      acc.turnovers += p.turnovers;
      return acc;
    },
    { fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, turnovers: 0 }
  );

  return {
    points: team.score,
    possessions: totals.fga + 0.44 * totals.fta - team.players.reduce((sum, p) => sum + p.offensiveRebounds, 0) + totals.turnovers,
    ...totals
  };
};

const pct = (made: number, att: number): number => (att > 0 ? (made / att) * 100 : 0);

const countMeetings = (schedule: ReturnType<typeof generateRegularSeasonSchedule>): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const game of schedule) {
    const key = pairKey(game.homeTeamId, game.awayTeamId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const runSeasonPathAudit = () => {
  const teamById = new Map(initialTeams.map((t) => [t.id, t]));
  const samples: Sample[] = [];
  const teamScores: number[] = [];

  const firstSeasonSchedule = generateRegularSeasonSchedule(initialTeams, BASE_SEED);
  const sameSeedSchedule = generateRegularSeasonSchedule(initialTeams, BASE_SEED);
  const differentSeedSchedule = generateRegularSeasonSchedule(initialTeams, BASE_SEED + 1);
  const firstSeasonValidation = validateRegularSeasonSchedule(firstSeasonSchedule, initialTeams);

  const pairCounts = countMeetings(firstSeasonSchedule);
  const rivalrySummary = rivalryPairs.map(([a, b]) => ({ pair: `${a}-${b}`, meetings: pairCounts.get(pairKey(a, b)) ?? 0 }));

  for (let season = 0; season < SEASONS; season += 1) {
    const scheduleSeed = BASE_SEED + season;
    const schedule = generateRegularSeasonSchedule(initialTeams, scheduleSeed);

    for (const game of schedule) {
      const home = teamById.get(game.homeTeamId);
      const away = teamById.get(game.awayTeamId);
      if (!home || !away) continue;

      const result = simulateGame(home, away, initialPlayers, scheduleSeed * 10_000 + game.gameNumber);
      samples.push(teamSampleFromBox(result.home));
      samples.push(teamSampleFromBox(result.away));
      teamScores.push(result.home.score, result.away.score);
    }
  }

  const sums = samples.reduce(
    (acc, s) => {
      acc.points += s.points;
      acc.possessions += s.possessions;
      acc.fga += s.fga;
      acc.fgm += s.fgm;
      acc.tpa += s.tpa;
      acc.tpm += s.tpm;
      acc.fta += s.fta;
      acc.ftm += s.ftm;
      acc.turnovers += s.turnovers;
      return acc;
    },
    { points: 0, possessions: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, turnovers: 0 }
  );

  const dist = teamScores.reduce(
    (acc, score) => {
      if (score < 60) acc.under60 += 1;
      else if (score < 70) acc.sixties += 1;
      else if (score < 78) acc.seventiesLow += 1;
      else if (score < 99) acc.commonRange += 1;
      else acc.hundredPlus += 1;
      return acc;
    },
    { under60: 0, sixties: 0, seventiesLow: 0, commonRange: 0, hundredPlus: 0 }
  );

  const n = samples.length;
  console.log(
    JSON.stringify(
      {
        seasonsSimulated: SEASONS,
        gamesSimulated: SEASONS * 204,
        scheduleValidation: {
          valid: firstSeasonValidation.valid,
          errorCount: firstSeasonValidation.errors.length,
          sampleErrors: firstSeasonValidation.errors.slice(0, 5),
          sameSeedStable: JSON.stringify(firstSeasonSchedule) === JSON.stringify(sameSeedSchedule),
          differentSeedChanges: JSON.stringify(firstSeasonSchedule) !== JSON.stringify(differentSeedSchedule),
          rivalrySummary
        },
        teamSamples: n,
        averages: {
          teamPoints: sums.points / n,
          possessionsPerTeam: sums.possessions / n,
          fgPct: pct(sums.fgm, sums.fga),
          threePct: pct(sums.tpm, sums.tpa),
          ftPct: pct(sums.ftm, sums.fta),
          fta: sums.fta / n,
          turnovers: sums.turnovers / n
        },
        scoringDistribution: {
          ...dist,
          pctUnder70: (dist.under60 + dist.sixties) / n,
          pct100Plus: dist.hundredPlus / n
        }
      },
      null,
      2
    )
  );
};

runSeasonPathAudit();
