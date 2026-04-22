import { describe, expect, it } from 'vitest';
import { initialPlayers } from '../src/data/players';
import { initialTeams } from '../src/data/teams';
import { simulateGame } from '../src/simulation/engine';

describe('simulateGame', () => {
  it('returns deterministic result for seed and FIBA-like score range', () => {
    const result = simulateGame(initialTeams[0], initialTeams[1], initialPlayers, 42);
    const result2 = simulateGame(initialTeams[0], initialTeams[1], initialPlayers, 42);

    expect(result.home.score).toBe(result2.home.score);
    expect(result.away.score).toBe(result2.away.score);
    expect(result.home.score).toBeGreaterThanOrEqual(60);
    expect(result.home.score).toBeLessThanOrEqual(110);
    expect(result.away.score).toBeGreaterThanOrEqual(60);
    expect(result.away.score).toBeLessThanOrEqual(110);
  });
});
