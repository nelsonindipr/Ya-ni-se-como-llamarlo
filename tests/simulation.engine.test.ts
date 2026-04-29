import { describe, expect, it } from 'vitest';
import { initialPlayers } from '../src/data/players';
import { initialTeams } from '../src/data/teams';
import { simulateGame } from '../src/simulation/engine';

const sumMinutes = (players: { minutes: number }[]): number =>
  players.reduce((sum, p) => sum + p.minutes, 0);

describe('simulateGame', () => {
  it('returns deterministic result for seed and FIBA-like score range', () => {
    const result = simulateGame(initialTeams[0], initialTeams[1], initialPlayers, 42);
    const result2 = simulateGame(initialTeams[0], initialTeams[1], initialPlayers, 42);

    expect(result.home.score).toBe(result2.home.score);
    expect(result.away.score).toBe(result2.away.score);
    expect(result.home.score).toBeGreaterThanOrEqual(55);
    expect(result.home.score).toBeLessThanOrEqual(110);
    expect(result.away.score).toBeGreaterThanOrEqual(55);
    expect(result.away.score).toBeLessThanOrEqual(110);
  });

  it('produces non-uniform rotation minutes and keeps total minutes near 200', () => {
    const result = simulateGame(initialTeams[0], initialTeams[1], initialPlayers, 12026);

    const homeSorted = [...result.home.players].sort((a, b) => b.minutes - a.minutes);
    const awaySorted = [...result.away.players].sort((a, b) => b.minutes - a.minutes);

    expect(sumMinutes(result.home.players)).toBeGreaterThanOrEqual(194);
    expect(sumMinutes(result.home.players)).toBeLessThanOrEqual(201);
    expect(sumMinutes(result.away.players)).toBeGreaterThanOrEqual(194);
    expect(sumMinutes(result.away.players)).toBeLessThanOrEqual(201);

    expect(homeSorted[0].minutes).toBeGreaterThanOrEqual(19);
    expect(awaySorted[0].minutes).toBeGreaterThanOrEqual(19);

    expect(homeSorted[0].minutes - homeSorted[homeSorted.length - 1].minutes).toBeGreaterThanOrEqual(10);
    expect(awaySorted[0].minutes - awaySorted[awaySorted.length - 1].minutes).toBeGreaterThanOrEqual(10);

    const homeBenchHeavy = homeSorted.filter((p) => p.minutes >= 24).length;
    const awayBenchHeavy = awaySorted.filter((p) => p.minutes >= 24).length;
    expect(homeBenchHeavy).toBeLessThanOrEqual(8);
    expect(awayBenchHeavy).toBeLessThanOrEqual(8);
  });
});
