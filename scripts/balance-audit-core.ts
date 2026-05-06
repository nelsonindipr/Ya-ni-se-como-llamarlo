import { createNewGameState, simulateByWindow } from '../src/state/gameState';

export type MetricKey =
  | 'teamPpg'
  | 'pace'
  | 'threePaRate'
  | 'ftRate'
  | 'turnoverPct'
  | 'offRebPct'
  | 'foulRate'
  | 'foulOutsPerGame'
  | 'injuryIncidence';

export type MetricTarget = {
  key: MetricKey;
  label: string;
  min: number;
  max: number;
  tolerance: number;
  critical: boolean;
};

export type SeasonMetrics = Record<MetricKey, number>;

export type SummaryStats = {
  mean: number;
  median: number;
  stdev: number;
  min: number;
  max: number;
  outOfRangePercent: number;
};

export const balanceTargets: MetricTarget[] = [
  { key: 'teamPpg', label: 'Team PPG', min: 76, max: 89, tolerance: 2, critical: true },
  { key: 'pace', label: 'Possessions / Team Game', min: 70, max: 80, tolerance: 1.5, critical: true },
  { key: 'threePaRate', label: '3PA rate', min: 0.28, max: 0.44, tolerance: 0.03, critical: true },
  { key: 'ftRate', label: 'FT rate', min: 0.18, max: 0.33, tolerance: 0.03, critical: true },
  { key: 'turnoverPct', label: 'Turnover %', min: 0.11, max: 0.17, tolerance: 0.02, critical: true },
  { key: 'offRebPct', label: 'Offensive rebound %', min: 0.22, max: 0.34, tolerance: 0.025, critical: false },
  { key: 'foulRate', label: 'Fouls / Team Game', min: 14, max: 23, tolerance: 2, critical: false },
  { key: 'foulOutsPerGame', label: 'Foul-outs / Game', min: 0.02, max: 0.35, tolerance: 0.05, critical: false },
  { key: 'injuryIncidence', label: 'Injuries / Team Game', min: 0.005, max: 0.06, tolerance: 0.01, critical: true }
];

const avg = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
const std = (vals: number[]) => {
  const mean = avg(vals);
  return Math.sqrt(avg(vals.map((v) => (v - mean) ** 2)));
};

const percentile50 = (vals: number[]) => {
  const sorted = [...vals].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const inRange = (value: number, target: MetricTarget): boolean => value >= target.min && value <= target.max;

export const seasonMetricsFromState = (state: ReturnType<typeof createNewGameState>): SeasonMetrics => {
  let teamPoints = 0;
  let teamPoss = 0;
  let teamFga = 0;
  let teamTpa = 0;
  let teamFta = 0;
  let teamTov = 0;
  let teamOrb = 0;
  let oppDrb = 0;
  let teamFouls = 0;
  let foulOutPlayers = 0;
  let injuries = 0;

  const games = state.schedule.filter((g) => g.played && g.result);

  for (const g of games) {
    for (const side of [g.result!.home, g.result!.away]) {
      teamPoints += side.score;
      const totals = side.players.reduce(
        (acc, p) => {
          acc.fga += p.fga;
          acc.tpa += p.tpa;
          acc.fta += p.fta;
          acc.tov += p.turnovers;
          acc.orb += p.offensiveRebounds;
          acc.fouls += p.fouls;
          if (p.fouls >= 5) foulOutPlayers += 1;
          return acc;
        },
        { fga: 0, tpa: 0, fta: 0, tov: 0, orb: 0, fouls: 0 }
      );
      teamFga += totals.fga;
      teamTpa += totals.tpa;
      teamFta += totals.fta;
      teamTov += totals.tov;
      teamOrb += totals.orb;
      teamFouls += totals.fouls;
      teamPoss += totals.fga + 0.44 * totals.fta - totals.orb + totals.tov;
    }

    const homeDrb = g.result!.home.players.reduce((s, p) => s + p.defensiveRebounds, 0);
    const awayDrb = g.result!.away.players.reduce((s, p) => s + p.defensiveRebounds, 0);
    oppDrb += homeDrb + awayDrb;
  }

  for (const rp of Object.values(state.runtimePlayers)) {
    if (rp.injury && rp.injury.startedOnGameNumber > 0) injuries += 1;
  }

  const teamGames = games.length * 2;
  const gameCount = games.length;

  return {
    teamPpg: teamPoints / Math.max(1, teamGames),
    pace: teamPoss / Math.max(1, teamGames),
    threePaRate: teamTpa / Math.max(1, teamFga),
    ftRate: teamFta / Math.max(1, teamFga),
    turnoverPct: teamTov / Math.max(1, teamPoss),
    offRebPct: teamOrb / Math.max(1, teamOrb + oppDrb),
    foulRate: teamFouls / Math.max(1, teamGames),
    foulOutsPerGame: foulOutPlayers / Math.max(1, gameCount),
    injuryIncidence: injuries / Math.max(1, teamGames)
  };
};

export const runSeasonMetrics = (seasons: number, seedStart: number): SeasonMetrics[] => {
  const result: SeasonMetrics[] = [];
  for (let i = 0; i < seasons; i += 1) {
    const final = simulateByWindow(createNewGameState(seedStart + i), 'rest_regular_season');
    result.push(seasonMetricsFromState(final));
  }
  return result;
};

export const summarizeMetrics = (seasons: SeasonMetrics[]) => {
  const summary = {} as Record<MetricKey, SummaryStats>;
  for (const target of balanceTargets) {
    const values = seasons.map((s) => s[target.key]);
    const out = values.filter((v) => !inRange(v, target)).length;
    summary[target.key] = {
      mean: avg(values),
      median: percentile50(values),
      stdev: std(values),
      min: Math.min(...values),
      max: Math.max(...values),
      outOfRangePercent: (out / Math.max(1, values.length)) * 100
    };
  }
  return summary;
};

export const evaluateQualityGates = (summary: Record<MetricKey, SummaryStats>) => {
  const failures: string[] = [];
  for (const t of balanceTargets) {
    const s = summary[t.key];
    const outLimit = t.critical ? 12 : 20;
    if (s.outOfRangePercent > outLimit) failures.push(`${t.key} out-of-range ${s.outOfRangePercent.toFixed(1)}% > ${outLimit}%`);
    if (s.mean < t.min - t.tolerance || s.mean > t.max + t.tolerance) {
      failures.push(`${t.key} mean ${s.mean.toFixed(3)} outside tolerance band [${(t.min - t.tolerance).toFixed(3)}, ${(t.max + t.tolerance).toFixed(3)}]`);
    }
  }
  const worst = balanceTargets
    .map((t) => ({ key: t.key, pct: summary[t.key].outOfRangePercent }))
    .sort((a, b) => b.pct - a.pct)[0];

  return { pass: failures.length === 0, failures, worstOffendingMetric: worst.key, worstOffendingPercent: worst.pct };
};
