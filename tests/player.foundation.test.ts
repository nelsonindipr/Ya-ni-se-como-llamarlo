import { describe, expect, it } from 'vitest';
import { initialPlayers } from '../src/data/players';
import { initialTeams } from '../src/data/teams';
import { simplifiedRatingsFromDetailed } from '../src/domain/playerRatings';
import { validatePlayers } from '../src/domain/playerValidation';
import { simulateGame } from '../src/simulation/engine';

describe('player data foundation', () => {
  it('validates seeded player data', () => {
    const result = validatePlayers(initialPlayers, initialTeams);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('ensures all ratings are in 25-99', () => {
    for (const player of initialPlayers) {
      for (const value of Object.values(player.ratings)) {
        expect(value).toBeGreaterThanOrEqual(25);
        expect(value).toBeLessThanOrEqual(99);
      }
    }
  });

  it('ensures tendencies are valid style ranges', () => {
    for (const player of initialPlayers) {
      for (const value of Object.values(player.tendencies)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('validates import limit enforcement', () => {
    const overflow = [
      ...initialPlayers,
      {
        ...initialPlayers.find((player) => player.teamId === initialTeams[0].id && player.isImport)!,
        id: `${initialTeams[0].id}-extra-import`,
        importSlot: 3 as 3,
        playerType: 'import' as const,
        isImport: true
      }
    ];

    const result = validatePlayers(overflow, initialTeams);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('max is 3'))).toBe(true);
  });

  it('maps detailed ratings to simplified engine ratings', () => {
    const player = initialPlayers[0];
    const simplified = simplifiedRatingsFromDetailed(player);

    expect(simplified.insideScoring).toBe(
      Math.round((player.ratings.closeShot + player.ratings.drivingLayup + player.ratings.standingDunk + player.ratings.postControl) / 4)
    );
    expect(simplified.playmaking).toBe(
      Math.round((player.ratings.passAccuracy + player.ratings.ballHandle + player.ratings.offensiveIQ) / 3)
    );
    expect(simplified.stamina).toBe(player.ratings.stamina);
  });

  it('current simulation still runs with mapped ratings', () => {
    const result = simulateGame(initialTeams[0], initialTeams[1], initialPlayers, 20260423);

    expect(result.home.score).toBeGreaterThan(0);
    expect(result.away.score).toBeGreaterThan(0);
    expect(result.home.players.length).toBeGreaterThanOrEqual(12);
  });
});
