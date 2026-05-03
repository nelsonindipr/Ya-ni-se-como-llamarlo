import { describe, expect, it } from 'vitest';
import { evaluateQualityGates, runSeasonMetrics, summarizeMetrics, type SeasonMetrics } from '../scripts/balance-audit-core';

describe('season balance audit', () => {
  it('aggregates metric summary correctly', () => {
    const seasons: SeasonMetrics[] = [
      { teamPpg: 80, pace: 74, threePaRate: 0.3, ftRate: 0.2, turnoverPct: 0.13, offRebPct: 0.29, foulRate: 18, foulOutsPerGame: 0.1, injuryIncidence: 0.02 },
      { teamPpg: 84, pace: 76, threePaRate: 0.34, ftRate: 0.24, turnoverPct: 0.14, offRebPct: 0.31, foulRate: 19, foulOutsPerGame: 0.08, injuryIncidence: 0.01 }
    ];
    const summary = summarizeMetrics(seasons);
    expect(summary.teamPpg.mean).toBe(82);
    expect(summary.teamPpg.median).toBe(82);
    expect(summary.pace.min).toBe(74);
    expect(summary.pace.max).toBe(76);
  });

  it('flags threshold failures', () => {
    const seasons: SeasonMetrics[] = Array.from({ length: 10 }, () => ({
      teamPpg: 95,
      pace: 86,
      threePaRate: 0.5,
      ftRate: 0.4,
      turnoverPct: 0.2,
      offRebPct: 0.4,
      foulRate: 28,
      foulOutsPerGame: 0.8,
      injuryIncidence: 0.2
    }));
    const result = evaluateQualityGates(summarizeMetrics(seasons));
    expect(result.pass).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it('is deterministic with fixed seeds', () => {
    const a = runSeasonMetrics(3, 1234);
    const b = runSeasonMetrics(3, 1234);
    expect(a).toEqual(b);
  });
});
