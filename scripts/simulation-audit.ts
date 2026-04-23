import { initialPlayers } from '../src/data/players';
import { initialTeams } from '../src/data/teams';
import { leagueRules } from '../src/domain/rules';
import { simulateGame } from '../src/simulation/engine';

const GAMES = 528;

type TeamSample = {
  points: number;
  possessions: number;
  fga: number;
  fgm: number;
  tpa: number;
  tpm: number;
  fta: number;
  ftm: number;
  rebounds: number;
  offensiveRebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  fouls: number;
  minutes: number;
  topPlayerMinutes: number;
  starterMinutes: number;
  benchMinutes: number;
};

const teamSampleFromBox = (team: { score: number; players: any[] }): TeamSample => {
  const sorted = [...team.players].sort((a, b) => b.minutes - a.minutes);
  const starterMinutes = sorted.slice(0, 5).reduce((sum, p) => sum + p.minutes, 0);
  const benchMinutes = sorted.slice(5).reduce((sum, p) => sum + p.minutes, 0);

  const totals = team.players.reduce(
    (acc, p) => {
      acc.fga += p.fga;
      acc.fgm += p.fgm;
      acc.tpa += p.tpa;
      acc.tpm += p.tpm;
      acc.fta += p.fta;
      acc.ftm += p.ftm;
      acc.rebounds += p.rebounds;
      acc.offensiveRebounds += p.offensiveRebounds;
      acc.assists += p.assists;
      acc.turnovers += p.turnovers;
      acc.steals += p.steals;
      acc.blocks += p.blocks;
      acc.fouls += p.fouls;
      acc.minutes += p.minutes;
      return acc;
    },
    {
      fga: 0,
      fgm: 0,
      tpa: 0,
      tpm: 0,
      fta: 0,
      ftm: 0,
      rebounds: 0,
      offensiveRebounds: 0,
      assists: 0,
      turnovers: 0,
      steals: 0,
      blocks: 0,
      fouls: 0,
      minutes: 0
    }
  );

  const possessions = totals.fga + 0.44 * totals.fta - totals.offensiveRebounds + totals.turnovers;

  return {
    points: team.score,
    possessions,
    ...totals,
    topPlayerMinutes: sorted[0]?.minutes ?? 0,
    starterMinutes,
    benchMinutes
  };
};

const pairings = (): [string, string][] => {
  const ids = initialTeams.map((t) => t.id);
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
};

const runAudit = () => {
  const teamById = new Map(initialTeams.map((t) => [t.id, t]));
  const games: TeamSample[] = [];
  const teamScores: number[] = [];
  const schedule = pairings();

  for (let i = 0; i < GAMES; i += 1) {
    const [homeId, awayId] = schedule[i % schedule.length];
    const home = teamById.get(homeId);
    const away = teamById.get(awayId);
    if (!home || !away) continue;
    const result = simulateGame(home, away, initialPlayers, 10000 + i);

    games.push(teamSampleFromBox(result.home));
    games.push(teamSampleFromBox(result.away));
    teamScores.push(result.home.score, result.away.score);
  }

  const sums = games.reduce(
    (acc, g) => {
      Object.keys(acc).forEach((k) => {
        acc[k as keyof TeamSample] += g[k as keyof TeamSample];
      });
      return acc;
    },
    {
      points: 0,
      possessions: 0,
      fga: 0,
      fgm: 0,
      tpa: 0,
      tpm: 0,
      fta: 0,
      ftm: 0,
      rebounds: 0,
      offensiveRebounds: 0,
      assists: 0,
      turnovers: 0,
      steals: 0,
      blocks: 0,
      fouls: 0,
      minutes: 0,
      topPlayerMinutes: 0,
      starterMinutes: 0,
      benchMinutes: 0
    } as TeamSample
  );

  const n = games.length;
  const pct = (made: number, att: number): number => (att > 0 ? (made / att) * 100 : 0);
  const scoreBandCounts = teamScores.reduce(
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

  const output = {
    gamesSimulated: GAMES,
    teamSamples: n,
    activeSettings: {
      game: leagueRules.game,
      simulation: leagueRules.simulation,
      paceInterpretation: leagueRules.simulation.paceIsPer48
        ? `pace is per-48 and converted to per-${leagueRules.game.numPeriods * leagueRules.game.quarterLength} in engine`
        : `pace is per-${leagueRules.game.numPeriods * leagueRules.game.quarterLength}`,
      convertedPaceForGameLength: leagueRules.simulation.paceIsPer48
        ? (leagueRules.simulation.pace * (leagueRules.game.numPeriods * leagueRules.game.quarterLength)) / 48
        : leagueRules.simulation.pace
    },
    averages: {
      teamPoints: sums.points / n,
      possessionsPerTeam: sums.possessions / n,
      fgPct: pct(sums.fgm, sums.fga),
      threePct: pct(sums.tpm, sums.tpa),
      ftPct: pct(sums.ftm, sums.fta),
      fta: sums.fta / n,
      rebounds: sums.rebounds / n,
      offensiveRebounds: sums.offensiveRebounds / n,
      assists: sums.assists / n,
      turnovers: sums.turnovers / n,
      steals: sums.steals / n,
      blocks: sums.blocks / n,
      fouls: sums.fouls / n,
      totalTeamMinutes: sums.minutes / n,
      topPlayerMinutes: sums.topPlayerMinutes / n,
      starterMinutes: sums.starterMinutes / n,
      benchMinutes: sums.benchMinutes / n
    },
    scoringDistribution: {
      ...scoreBandCounts,
      pctUnder70: (scoreBandCounts.under60 + scoreBandCounts.sixties) / n,
      pct100Plus: scoreBandCounts.hundredPlus / n
    }
  };

  console.log(JSON.stringify(output, null, 2));
};

runAudit();
