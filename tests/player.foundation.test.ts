import { describe, expect, it } from 'vitest';
import { initialPlayers } from '../src/data/players';
import { playerRatingOverrides } from '../src/data/playerRatingOverrides';
import { initialTeams } from '../src/data/teams';
import {
  POSITION_OVERALL_WEIGHTS,
  bsnOverallBand,
  calculateOverall,
  calculatePositionOverall,
  simplifiedRatingsFromDetailed
} from '../src/domain/playerRatings';
import { validatePlayers } from '../src/domain/playerValidation';
import { calculateMakeProbability, simulateGame } from '../src/simulation/engine';

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

  it('derives BSN overall from detailed attributes and position weighting', () => {
    const player = initialPlayers[0];
    const derived = calculateOverall(player);
    const manualRaw = calculatePositionOverall(player, player.position);
    const manual = Math.round(manualRaw);
    expect(derived).toBe(manual);

    expect(
      calculatePositionOverall(
        {
          ...player,
          ratings: { ...player.ratings, threePoint: Math.min(99, player.ratings.threePoint + 5) }
        },
        player.position
      )
    ).toBeGreaterThanOrEqual(manualRaw);
  });

  it('uses BSN-relative display bands for overall style', () => {
    expect(bsnOverallBand(92)).toContain('superstar');
    expect(bsnOverallBand(87)).toContain('star');
    expect(bsnOverallBand(82)).toContain('Strong starter');
    expect(bsnOverallBand(77)).toContain('Average starter');
    expect(bsnOverallBand(72)).toContain('Normal rotation');
    expect(bsnOverallBand(67)).toContain('Deep bench');
    expect(bsnOverallBand(62)).toContain('Reserve / prospect');
    expect(bsnOverallBand(58)).toContain('Emergency');
  });

  it('does not change overall when role changes', () => {
    const player = initialPlayers[0];
    const swappedRole = { ...player, role: 'bench_spark' as const };
    expect(calculateOverall(swappedRole)).toBe(calculateOverall(player));
  });

  it('does not change overall when tier changes', () => {
    const player = initialPlayers[0];
    const swappedTier = { ...player, tier: 'bench' as const };
    expect(calculateOverall(swappedTier)).toBe(calculateOverall(player));
  });

  it('does not change overall when archetype changes', () => {
    const player = initialPlayers[0];
    const swappedArchetype = { ...player, archetype: 'rim_protector' as const };
    expect(calculateOverall(swappedArchetype)).toBe(calculateOverall(player));
  });

  it('does not change overall when tendencies change', () => {
    const player = initialPlayers[0];
    const swappedTendencies = {
      ...player,
      tendencies: {
        ...player.tendencies,
        threePointTendency: 0,
        passTendency: 1,
        driveTendency: 1
      }
    };
    expect(calculateOverall(swappedTendencies)).toBe(calculateOverall(player));
  });

  it('does not change overall when age changes', () => {
    const player = initialPlayers[0];
    const older = { ...player, age: player.age + 7, birthdate: '1990-01-01' };
    expect(calculateOverall(older)).toBe(calculateOverall(player));
  });

  it('does not change overall when import/native status changes', () => {
    const player = initialPlayers[0];
    const swappedImportStatus = {
      ...player,
      isImport: !player.isImport,
      playerType: (player.playerType === 'import' ? 'native' : 'import') as 'native' | 'import'
    };
    expect(calculateOverall(swappedImportStatus)).toBe(calculateOverall(player));
  });

  it('blends overall as 75% primary and 25% best secondary position', () => {
    const player = initialPlayers.find((p) => p.secondaryPositions.length >= 2) ?? initialPlayers[0];
    const primaryOverall = calculatePositionOverall(player, player.position);
    const bestSecondaryOverall = Math.max(...player.secondaryPositions.map((position) => calculatePositionOverall(player, position)));
    const expected = Math.round(Math.max(25, Math.min(99, primaryOverall * 0.75 + bestSecondaryOverall * 0.25)));

    expect(calculateOverall(player)).toBe(expected);
  });

  it('uses only primary position overall when no secondary positions are present', () => {
    const source = initialPlayers[0];
    const player = { ...source, secondaryPositions: [] };
    const expected = Math.round(Math.max(25, Math.min(99, calculatePositionOverall(player, player.position))));
    expect(calculateOverall(player)).toBe(expected);
  });

  it('rounds and clamps final overall to 25-99', () => {
    const lowPlayer = {
      ...initialPlayers[0],
      ratings: Object.fromEntries(Object.keys(initialPlayers[0].ratings).map((key) => [key, 1]))
    };
    const highPlayer = {
      ...initialPlayers[0],
      ratings: Object.fromEntries(Object.keys(initialPlayers[0].ratings).map((key) => [key, 140]))
    };

    expect(calculateOverall(lowPlayer as typeof initialPlayers[0])).toBe(25);
    expect(calculateOverall(highPlayer as typeof initialPlayers[0])).toBe(99);
  });

  it('ensures each position weight sum equals 1.0', () => {
    const epsilon = 1e-9;
    for (const position of Object.keys(POSITION_OVERALL_WEIGHTS)) {
      const sum = Object.values(POSITION_OVERALL_WEIGHTS[position as keyof typeof POSITION_OVERALL_WEIGHTS]).reduce((acc, weight) => acc + (weight ?? 0), 0);
      expect(Math.abs(sum - 1)).toBeLessThan(epsilon);
    }
  });

  it('keeps tendencies as frequency controls, not direct make-effectiveness', () => {
    const params = {
      shotRating: 78,
      defenseRating: 75,
      shootThree: true,
      offenseBoost: 1,
      fatigue: 0.2,
      marginForOffense: 0,
      quarter: 2,
      secondsLeftInQuarter: 240
    };
    const probA = calculateMakeProbability(params);
    const probB = calculateMakeProbability(params);
    expect(probA).toBe(probB);
  });

  it('current simulation still runs with mapped ratings', () => {
    const result = simulateGame(initialTeams[0], initialTeams[1], initialPlayers, 20260423);

    expect(result.home.score).toBeGreaterThan(0);
    expect(result.away.score).toBeGreaterThan(0);
    expect(result.home.players.length).toBeGreaterThanOrEqual(12);
  });
});
