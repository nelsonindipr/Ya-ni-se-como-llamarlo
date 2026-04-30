import { describe, expect, it } from 'vitest';
import type { Player, PlayerRatings } from './types';
import { calculateBasePositionOverallFromRatings, calculateBsnOverallFromRatings, calculateEffectiveOverall, calculateOverall, calculatePositionOverallDiagnosticsFromRatings } from './playerRatings';

const baseRatings = (): PlayerRatings => ({
  closeShot: 60, drivingLayup: 60, drivingDunk: 60, standingDunk: 60, postControl: 60, drawFoul: 60, midRange: 60, threePoint: 60, freeThrow: 60, shotCreation: 60, offBallMovement: 60, passAccuracy: 60, ballHandle: 60, interiorDefense: 60, perimeterDefense: 60, steal: 60, block: 60, offensiveRebound: 60, defensiveRebound: 60, speed: 60, acceleration: 60, strength: 60, vertical: 60, stamina: 60, offensiveIQ: 60, defensiveIQ: 60, clutch: 60, hustle: 60
});

const mkPlayer = (overrides: Partial<Player> & { ratings?: Partial<PlayerRatings> }): Player => ({
  id: 'p1', teamId: 't1', name: 'Test', firstName: 'Test', lastName: 'Player', displayName: 'Test Player',
  birthdate: '1998-01-01', age: 28, nationality: 'PR', hometown: 'San Juan', height: 78, weight: 210,
  position: 'SG', secondaryPositions: ['SF'], shootingHand: 'right', jerseyNumber: 1, college: 'N/A', previousTeam: 'N/A',
  yearsPro: 5, role: 'bench_spark', tier: 'rotation', archetype: '3_and_d_wing', tendencies: { threePointTendency: 50, midRangeTendency: 50, driveTendency: 50, postUpTendency: 10, passTendency: 50, drawFoulTendency: 50, crashOffGlassTendency: 50 },
  ratings: { ...baseRatings(), ...(overrides.ratings ?? {}) }, minutesTarget: 20, playerType: 'native',
  isImport: false, importChangeCount: 0, injurySalaryReliefEligible: false, technicalFoulCount: 0, ...overrides
});

describe('archetype-based OVR rollout', () => {
  it('elite off-screen shooter selects offScreenShooter and improves over flat base', () => {
    const ratings = { ...baseRatings(), threePoint: 95, offBallMovement: 95, midRange: 90, freeThrow: 90, shotCreation: 86, stamina: 90, offensiveIQ: 90, clutch: 88, drivingDunk: 35, standingDunk: 35, block: 30, offensiveRebound: 35, defensiveRebound: 38 };
    const diag = calculatePositionOverallDiagnosticsFromRatings(ratings, 'SG');
    expect(diag.bestArchetypeName).toBe('offScreenShooter');
    expect(diag.finalRoundedOverall).toBeGreaterThan(Math.round(diag.basePositionScore));
  });

  it('shot creator guard selects shotCreatorSG or scoringPG', () => {
    const ratings = { ...baseRatings(), shotCreation: 94, ballHandle: 92, passAccuracy: 88, threePoint: 84, midRange: 86, drivingLayup: 86, offensiveIQ: 88, speed: 86, acceleration: 88 };
    const sg = calculatePositionOverallDiagnosticsFromRatings(ratings, 'SG');
    const pg = calculatePositionOverallDiagnosticsFromRatings(ratings, 'PG');
    expect(['shotCreatorSG', 'scoringPG']).toContain(sg.bestArchetypeName === 'shotCreatorSG' ? 'shotCreatorSG' : pg.bestArchetypeName);
  });

  it('defensive guard selects defensivePG or threeAndDSG', () => {
    const ratings = { ...baseRatings(), perimeterDefense: 92, steal: 90, defensiveIQ: 89, hustle: 92, speed: 86, acceleration: 87, threePoint: 76 };
    const sg = calculatePositionOverallDiagnosticsFromRatings(ratings, 'SG');
    const pg = calculatePositionOverallDiagnosticsFromRatings(ratings, 'PG');
    expect(['threeAndDSG', 'defensivePG']).toContain(sg.bestArchetypeName === 'threeAndDSG' ? 'threeAndDSG' : pg.bestArchetypeName);
  });

  it('rebounding guard selects rebounding profile', () => {
    const ratings = { ...baseRatings(), offensiveRebound: 86, defensiveRebound: 90, strength: 82, vertical: 80, hustle: 88, defensiveIQ: 78 };
    const sg = calculatePositionOverallDiagnosticsFromRatings(ratings, 'SG');
    const pg = calculatePositionOverallDiagnosticsFromRatings(ratings, 'PG');
    expect(['reboundingSG', 'reboundingPG']).toContain(sg.bestArchetypeName === 'reboundingSG' ? 'reboundingSG' : pg.bestArchetypeName);
  });

  it('passing center / stretch big / rim protector select expected center archetypes', () => {
    const passingC = calculatePositionOverallDiagnosticsFromRatings({ ...baseRatings(), passAccuracy: 90, offensiveIQ: 90, postControl: 80, closeShot: 82, interiorDefense: 74, defensiveRebound: 82 }, 'C');
    expect(passingC.bestArchetypeName).toBe('passingHubC');
    const stretchC = calculatePositionOverallDiagnosticsFromRatings({ ...baseRatings(), threePoint: 90, midRange: 85, freeThrow: 88, offBallMovement: 82, offensiveIQ: 84 }, 'C');
    expect(stretchC.bestArchetypeName).toBe('stretchFive');
    const rimC = calculatePositionOverallDiagnosticsFromRatings({ ...baseRatings(), interiorDefense: 95, block: 95, defensiveRebound: 92, offensiveRebound: 86, strength: 90, vertical: 84 }, 'C');
    expect(rimC.bestArchetypeName).toBe('rimProtector');
  });

  it('balanced wing remains stable and not over-inflated (+6 cap)', () => {
    const ratings = { ...baseRatings(), threePoint: 82, midRange: 80, drivingLayup: 80, shotCreation: 79, perimeterDefense: 80, defensiveIQ: 80, offensiveIQ: 80, passAccuracy: 76, ballHandle: 77, stamina: 84, hustle: 82, steal: 78, strength: 74, defensiveRebound: 70, offensiveRebound: 62 };
    const diag = calculatePositionOverallDiagnosticsFromRatings(ratings, 'SF');
    expect(diag.finalRoundedOverall - Math.round(diag.basePositionScore)).toBeLessThanOrEqual(6);
  });

  it('final OVR is clamped and rounded 25-99', () => {
    const maxRatings = Object.fromEntries(Object.keys(baseRatings()).map((k) => [k, 99])) as PlayerRatings;
    const minRatings = Object.fromEntries(Object.keys(baseRatings()).map((k) => [k, 25])) as PlayerRatings;
    expect(calculateBsnOverallFromRatings(maxRatings, 'PG')).toBeLessThanOrEqual(99);
    expect(calculateBsnOverallFromRatings(minRatings, 'PG')).toBeGreaterThanOrEqual(25);
  });

  it('OVR independent from non-rating metadata', () => {
    const ratings = { ...baseRatings(), threePoint: 85, offBallMovement: 86 };
    const p1 = mkPlayer({ role: 'bench_spark', tier: 'rotation', archetype: '3_and_d_wing', age: 22, isImport: false, minutesTarget: 8, ratings });
    const p2 = mkPlayer({ role: 'primary_ball_handler', tier: 'superstar', archetype: 'post_scorer', age: 36, isImport: true, minutesTarget: 34, playerType: 'import', ratings });
    expect(calculateOverall(p1)).toBe(calculateOverall(p2));
  });

  it('natural overall uses primary position only and secondaries only affect effective penalty logic', () => {
    const ratings = { ...baseRatings(), passAccuracy: 90, ballHandle: 90, threePoint: 88, perimeterDefense: 85 };
    const sgPrimary = mkPlayer({ position: 'SG', secondaryPositions: ['PG'], ratings });
    const sgNoSecondary = mkPlayer({ position: 'SG', secondaryPositions: [], ratings });
    const pgPrimary = mkPlayer({ position: 'PG', secondaryPositions: ['SG'], ratings });
    expect(calculateOverall(sgPrimary)).not.toBe(calculateOverall(pgPrimary));
    expect(calculateEffectiveOverall(sgPrimary, 'PG')).toBeGreaterThan(calculateEffectiveOverall(sgNoSecondary, 'PG'));
    expect(calculateEffectiveOverall(sgPrimary, 'C')).toBeLessThan(calculateBsnOverallFromRatings(ratings, 'C'));
  });

  it('applies downside floor (-2) and uplift cap (+6)', () => {
    const ratings = { ...baseRatings(), threePoint: 95, offBallMovement: 95, shotCreation: 95, midRange: 92 };
    const base = calculateBasePositionOverallFromRatings(ratings, 'SG');
    const diag = calculatePositionOverallDiagnosticsFromRatings(ratings, 'SG');
    expect(diag.cappedFinalScore).toBeLessThanOrEqual(base + 6);
    expect(diag.cappedFinalScore).toBeGreaterThanOrEqual(base - 2);
  });
});
