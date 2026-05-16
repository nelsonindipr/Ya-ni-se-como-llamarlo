import type { Player, PlayerRatings, Position, SimplifiedPlayerRatings } from './types';

const clampRating = (value: number): number => Math.max(25, Math.min(99, value));
const roundRating = (value: number): number => Math.round(clampRating(value));
const avg = (...values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

export const speedWithBallProxyFromRatings = (ratings: PlayerRatings): number => ratings.speed * 0.55 + ratings.acceleration * 0.3 + ratings.ballHandle * 0.15;

type PositionOverallWeights = Record<Position, Record<keyof Player['ratings'], number>>;
type ScoringBlocks = Record<
  | 'perimeterShooting' | 'movementShooting' | 'shotCreationBlock' | 'rimPressure'
  | 'guardPlaymaking' | 'wingPlaymaking' | 'bigPlaymaking'
  | 'guardDefense' | 'wingDefense' | 'bigDefense'
  | 'rebounding' | 'athleticism' | 'interiorScoring' | 'stretchScoring' | 'iqClutch',
  number
>;
type PositionArchetypeScores = Record<Position, Record<string, number>>;

const ELITE_THRESHOLD_1 = 85;
const PREMIUM_PER_POINT_ABOVE_THRESHOLD_1 = 0.25;
const ELITE_THRESHOLD_2 = 93;
const PREMIUM_PER_POINT_ABOVE_THRESHOLD_2 = 0.35;
const ADJUSTED_ATTRIBUTE_CAP = 99;
const FINAL_CURVE_FACTOR = 0;

export const POSITION_OVERALL_WEIGHTS: PositionOverallWeights = {
  PG: { closeShot: 0.015, drivingLayup: 0.055, drivingDunk: 0.005, standingDunk: 0.002, postControl: 0.002, drawFoul: 0.04, midRange: 0.03, threePoint: 0.065, freeThrow: 0.03, shotCreation: 0.07, offBallMovement: 0.015, passAccuracy: 0.115, ballHandle: 0.12, interiorDefense: 0.008, perimeterDefense: 0.055, steal: 0.04, block: 0.003, offensiveRebound: 0.005, defensiveRebound: 0.012, speed: 0.065, acceleration: 0.055, strength: 0.012, vertical: 0.008, stamina: 0.025, offensiveIQ: 0.075, defensiveIQ: 0.03, clutch: 0.028, hustle: 0.015 },
  SG: { closeShot: 0.015, drivingLayup: 0.07, drivingDunk: 0.005, standingDunk: 0.002, postControl: 0.003, drawFoul: 0.05, midRange: 0.065, threePoint: 0.11, freeThrow: 0.04, shotCreation: 0.09, offBallMovement: 0.06, passAccuracy: 0.045, ballHandle: 0.06, interiorDefense: 0.01, perimeterDefense: 0.06, steal: 0.035, block: 0.005, offensiveRebound: 0.005, defensiveRebound: 0.015, speed: 0.04, acceleration: 0.035, strength: 0.015, vertical: 0.015, stamina: 0.02, offensiveIQ: 0.05, defensiveIQ: 0.025, clutch: 0.035, hustle: 0.02 },
  SF: { closeShot: 0.02, drivingLayup: 0.055, drivingDunk: 0.015, standingDunk: 0.007, postControl: 0.008, drawFoul: 0.04, midRange: 0.05, threePoint: 0.075, freeThrow: 0.03, shotCreation: 0.055, offBallMovement: 0.055, passAccuracy: 0.025, ballHandle: 0.04, interiorDefense: 0.02, perimeterDefense: 0.075, steal: 0.035, block: 0.01, offensiveRebound: 0.015, defensiveRebound: 0.04, speed: 0.045, acceleration: 0.04, strength: 0.045, vertical: 0.025, stamina: 0.025, offensiveIQ: 0.05, defensiveIQ: 0.05, clutch: 0.025, hustle: 0.025 },
  PF: { closeShot: 0.07, drivingLayup: 0.04, drivingDunk: 0.015, standingDunk: 0.04, postControl: 0.045, drawFoul: 0.04, midRange: 0.045, threePoint: 0.04, freeThrow: 0.02, shotCreation: 0.01, offBallMovement: 0.015, passAccuracy: 0.015, ballHandle: 0.01, interiorDefense: 0.08, perimeterDefense: 0.03, steal: 0.01, block: 0.04, offensiveRebound: 0.06, defensiveRebound: 0.075, speed: 0.02, acceleration: 0.015, strength: 0.065, vertical: 0.035, stamina: 0.025, offensiveIQ: 0.04, defensiveIQ: 0.045, clutch: 0.015, hustle: 0.04 },
  C: { closeShot: 0.08, drivingLayup: 0.01, drivingDunk: 0.01, standingDunk: 0.055, postControl: 0.05, drawFoul: 0.045, midRange: 0.02, threePoint: 0.015, freeThrow: 0.02, shotCreation: 0.005, offBallMovement: 0.01, passAccuracy: 0.015, ballHandle: 0.005, interiorDefense: 0.11, perimeterDefense: 0.015, steal: 0.005, block: 0.075, offensiveRebound: 0.065, defensiveRebound: 0.1, speed: 0.015, acceleration: 0.01, strength: 0.075, vertical: 0.035, stamina: 0.02, offensiveIQ: 0.035, defensiveIQ: 0.055, clutch: 0.01, hustle: 0.035 }
};

export const simplifiedRatingsFromDetailed = (player: Player): SimplifiedPlayerRatings => ({
  insideScoring: roundRating(avg(player.ratings.closeShot, player.ratings.drivingLayup, player.ratings.standingDunk, player.ratings.postControl)),
  midRangeScoring: roundRating(avg(player.ratings.midRange, player.ratings.shotCreation)),
  threePointScoring: roundRating(avg(player.ratings.threePoint, player.ratings.offBallMovement)),
  playmaking: roundRating(avg(player.ratings.passAccuracy, player.ratings.ballHandle, player.ratings.offensiveIQ)),
  perimeterDefense: roundRating(player.ratings.perimeterDefense), interiorDefense: roundRating(player.ratings.interiorDefense),
  rebounding: roundRating(avg(player.ratings.offensiveRebound, player.ratings.defensiveRebound)), stamina: roundRating(player.ratings.stamina)
});

export const calculatePositionOverall = (player: Player, position: Position): number =>
  calculatePositionOverallFromRatings(player.ratings, position);

const calculatePositionOverallFromRatings = (ratings: PlayerRatings, position: Position): number =>
  Object.entries(POSITION_OVERALL_WEIGHTS[position]).reduce((total, [attribute, weight]) => total + ratings[attribute as keyof PlayerRatings] * weight, 0);

const adjustedAttribute = (attribute: number): number => Math.min(
  ADJUSTED_ATTRIBUTE_CAP,
  attribute
    + Math.max(0, attribute - ELITE_THRESHOLD_1) * PREMIUM_PER_POINT_ABOVE_THRESHOLD_1
    + Math.max(0, attribute - ELITE_THRESHOLD_2) * PREMIUM_PER_POINT_ABOVE_THRESHOLD_2
);

const adjustedRatingsFromRatings = (ratings: PlayerRatings): PlayerRatings => Object.fromEntries(
  Object.entries(ratings).map(([key, value]) => [key, adjustedAttribute(value as number)])
) as PlayerRatings;

const scoringBlocksFromRatings = (ratings: PlayerRatings): ScoringBlocks => ({
  perimeterShooting: ratings.threePoint * 0.45 + ratings.midRange * 0.2 + ratings.freeThrow * 0.15 + ratings.offBallMovement * 0.1 + ratings.shotCreation * 0.1,
  movementShooting: ratings.offBallMovement * 0.35 + ratings.threePoint * 0.35 + ratings.midRange * 0.15 + ratings.stamina * 0.1 + ratings.offensiveIQ * 0.05,
  shotCreationBlock: ratings.shotCreation * 0.45 + ratings.ballHandle * 0.2 + ratings.midRange * 0.15 + ratings.threePoint * 0.1 + ratings.offensiveIQ * 0.1,
  rimPressure: ratings.drivingLayup * 0.35 + ratings.drawFoul * 0.2 + ratings.speed * 0.15 + ratings.acceleration * 0.15 + ratings.drivingDunk * 0.15,
  guardPlaymaking: ratings.passAccuracy * 0.45 + ratings.ballHandle * 0.3 + ratings.offensiveIQ * 0.2 + ratings.acceleration * 0.05,
  wingPlaymaking: ratings.passAccuracy * 0.35 + ratings.ballHandle * 0.2 + ratings.offensiveIQ * 0.3 + ratings.strength * 0.05 + ratings.shotCreation * 0.1,
  bigPlaymaking: ratings.passAccuracy * 0.42 + ratings.offensiveIQ * 0.35 + ratings.postControl * 0.13 + ratings.ballHandle * 0.1,
  guardDefense: ratings.perimeterDefense * 0.4 + ratings.steal * 0.2 + ratings.defensiveIQ * 0.25 + ratings.acceleration * 0.08 + ratings.hustle * 0.07,
  wingDefense: ratings.perimeterDefense * 0.28 + ratings.interiorDefense * 0.15 + ratings.steal * 0.12 + ratings.block * 0.08 + ratings.defensiveIQ * 0.2 + ratings.strength * 0.1 + ratings.hustle * 0.07,
  bigDefense: ratings.interiorDefense * 0.38 + ratings.block * 0.24 + ratings.defensiveRebound * 0.1 + ratings.defensiveIQ * 0.18 + ratings.strength * 0.1,
  rebounding: ratings.offensiveRebound * 0.4 + ratings.defensiveRebound * 0.4 + ratings.vertical * 0.1 + ratings.strength * 0.1,
  athleticism: ratings.speed * 0.3 + ratings.acceleration * 0.25 + ratings.vertical * 0.2 + ratings.strength * 0.15 + ratings.stamina * 0.1,
  interiorScoring: ratings.closeShot * 0.3 + ratings.postControl * 0.28 + ratings.standingDunk * 0.15 + ratings.drivingLayup * 0.12 + ratings.drawFoul * 0.15,
  stretchScoring: ratings.threePoint * 0.45 + ratings.midRange * 0.22 + ratings.freeThrow * 0.13 + ratings.offBallMovement * 0.1 + ratings.offensiveIQ * 0.1,
  iqClutch: ratings.offensiveIQ * 0.38 + ratings.defensiveIQ * 0.25 + ratings.clutch * 0.22 + ratings.hustle * 0.15
});

const archetypeScoresForPosition = (ratings: PlayerRatings, position: Position): Record<string, number> => {
  const b = scoringBlocksFromRatings(ratings);
  const scores: PositionArchetypeScores = {
    PG: {
      floor_general: b.guardPlaymaking * 0.5 + b.perimeterShooting * 0.15 + b.iqClutch * 0.2 + b.guardDefense * 0.15,
      scoring_pg: b.shotCreationBlock * 0.35 + b.perimeterShooting * 0.25 + b.rimPressure * 0.2 + b.guardPlaymaking * 0.1 + b.iqClutch * 0.1,
      defensive_pg: b.guardDefense * 0.55 + b.guardPlaymaking * 0.15 + b.athleticism * 0.15 + b.iqClutch * 0.15,
      rebounding_pg: b.rebounding * 0.45 + b.guardDefense * 0.2 + b.athleticism * 0.2 + b.guardPlaymaking * 0.15,
      off_ball_pg: b.movementShooting * 0.5 + b.perimeterShooting * 0.2 + b.guardPlaymaking * 0.15 + b.iqClutch * 0.15
    },
    SG: {
      offscreen_shooter: b.movementShooting * 0.5 + b.perimeterShooting * 0.25 + b.shotCreationBlock * 0.1 + b.iqClutch * 0.15,
      shot_creator_sg: b.shotCreationBlock * 0.45 + b.perimeterShooting * 0.2 + b.rimPressure * 0.15 + b.guardPlaymaking * 0.1 + b.iqClutch * 0.1,
      slasher_sg: b.rimPressure * 0.45 + b.athleticism * 0.25 + b.shotCreationBlock * 0.15 + b.guardDefense * 0.15,
      three_and_d_sg: b.perimeterShooting * 0.35 + b.guardDefense * 0.4 + b.iqClutch * 0.15 + b.athleticism * 0.1,
      combo_guard_sg: b.guardPlaymaking * 0.35 + b.shotCreationBlock * 0.25 + b.perimeterShooting * 0.2 + b.guardDefense * 0.2,
      rebounding_sg: b.rebounding * 0.5 + b.guardDefense * 0.2 + b.athleticism * 0.2 + b.perimeterShooting * 0.1
    },
    SF: {
      wing_scorer: b.shotCreationBlock * 0.35 + b.perimeterShooting * 0.2 + b.rimPressure * 0.2 + b.wingPlaymaking * 0.15 + b.iqClutch * 0.1,
      three_and_d_wing: b.perimeterShooting * 0.28 + b.wingDefense * 0.42 + b.iqClutch * 0.2 + b.athleticism * 0.1,
      point_forward: b.wingPlaymaking * 0.45 + b.shotCreationBlock * 0.15 + b.wingDefense * 0.15 + b.iqClutch * 0.25,
      slashing_wing: b.rimPressure * 0.35 + b.athleticism * 0.25 + b.wingDefense * 0.2 + b.shotCreationBlock * 0.2,
      rebounding_wing: b.rebounding * 0.45 + b.wingDefense * 0.3 + b.athleticism * 0.15 + b.perimeterShooting * 0.1,
      off_ball_wing: b.movementShooting * 0.4 + b.perimeterShooting * 0.25 + b.wingDefense * 0.2 + b.iqClutch * 0.15
    },
    PF: {
      stretch_four: b.stretchScoring * 0.45 + b.rebounding * 0.15 + b.wingDefense * 0.1 + b.bigDefense * 0.15 + b.iqClutch * 0.15,
      interior_pf: b.interiorScoring * 0.35 + b.rebounding * 0.25 + b.bigDefense * 0.2 + b.athleticism * 0.1 + b.iqClutch * 0.1,
      defensive_rebounder_pf: b.rebounding * 0.42 + b.bigDefense * 0.33 + b.athleticism * 0.1 + b.interiorScoring * 0.05 + b.iqClutch * 0.1,
      point_big_pf: b.bigPlaymaking * 0.38 + b.stretchScoring * 0.2 + b.interiorScoring * 0.12 + b.bigDefense * 0.1 + b.iqClutch * 0.2,
      rim_runner_pf: b.rimPressure * 0.3 + b.athleticism * 0.3 + b.rebounding * 0.2 + b.bigDefense * 0.2,
      smallBallBig: b.wingDefense * 0.25 + b.bigDefense * 0.2 + b.stretchScoring * 0.2 + b.rebounding * 0.15 + b.athleticism * 0.2
    },
    C: {
      rim_protector: b.bigDefense * 0.5 + b.rebounding * 0.25 + b.athleticism * 0.15 + b.interiorScoring * 0.1,
      rebounder_c: b.rebounding * 0.5 + b.bigDefense * 0.25 + b.interiorScoring * 0.15 + b.athleticism * 0.1,
      post_scorer_c: b.interiorScoring * 0.45 + b.bigDefense * 0.2 + b.rebounding * 0.15 + b.iqClutch * 0.2,
      stretch_five: b.stretchScoring * 0.5 + b.bigPlaymaking * 0.15 + b.bigDefense * 0.15 + b.rebounding * 0.1 + b.iqClutch * 0.1,
      passing_hub_c: b.bigPlaymaking * 0.45 + b.iqClutch * 0.25 + b.interiorScoring * 0.1 + b.rebounding * 0.1 + b.bigDefense * 0.1,
      rim_runner_c: b.rimPressure * 0.3 + b.athleticism * 0.25 + b.bigDefense * 0.2 + b.rebounding * 0.2 + b.interiorScoring * 0.05,
      mobile_switch_c: b.athleticism * 0.25 + b.wingDefense * 0.2 + b.bigDefense * 0.25 + b.rebounding * 0.15 + b.stretchScoring * 0.15
    }
  };
  return scores[position];
};

export const calculatePositionOverallDiagnosticsFromRatings = (ratings: PlayerRatings, position: Position) => {
  const adjustedRatings = adjustedRatingsFromRatings(ratings);
  const baseAdjustedScore = calculatePositionOverallFromRatings(adjustedRatings, position);
  const archetypeScores = archetypeScoresForPosition(adjustedRatings, position);
  const [bestArchetypeName, bestArchetypeScore] = Object.entries(archetypeScores).sort((a, b) => b[1] - a[1])[0];
  const archetypeWeight = bestArchetypeScore >= 95 ? 0.45 : bestArchetypeScore >= 90 ? 0.4 : 0.35;
  const rawBlend = baseAdjustedScore * (1 - archetypeWeight) + bestArchetypeScore * archetypeWeight;
  const curvedBlend = rawBlend + Math.max(0, rawBlend - 88) * FINAL_CURVE_FACTOR;
  const dynamicCap = baseAdjustedScore + (bestArchetypeScore >= 95 ? 9 : bestArchetypeScore >= 90 ? 7 : 5);
  const baseFloor = baseAdjustedScore - 2;
  const cappedScore = Math.min(dynamicCap, Math.max(baseFloor, curvedBlend));
  const finalRoundedOverall = roundRating(cappedScore);
  return { baseAdjustedScore, bestArchetypeName, bestArchetypeScore, archetypeWeight, rawBlend, curvedBlend, dynamicCap, baseFloor, cappedScore, finalRoundedOverall, archetypeScores };
};

export const calculateBasePositionOverallFromRatings = (ratings: PlayerRatings, position: Position): number =>
  calculatePositionOverallFromRatings(adjustedRatingsFromRatings(ratings), position);

const POSITION_INDEX: Record<Position, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

const OUT_OF_POSITION_DISTANCE_PENALTY: Record<number, number> = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16
};

const closestDistanceToNaturalPosition = (player: Player, assignedPosition: Position): number => {
  const naturalPositions = [player.position, ...player.secondaryPositions];
  const assignedIndex = POSITION_INDEX[assignedPosition];
  return naturalPositions.reduce((closest, position) => Math.min(closest, Math.abs(POSITION_INDEX[position] - assignedIndex)), Number.POSITIVE_INFINITY);
};

export const calculateOverall = (player: Player): number => roundRating(calculatePositionOverall(player, player.position));

export const calculateEffectiveOverall = (player: Player, assignedPosition: Position): number => {
  const assignedOverall = calculatePositionOverall(player, assignedPosition);
  if (assignedPosition === player.position || player.secondaryPositions.includes(assignedPosition)) return roundRating(assignedOverall);

  const distance = closestDistanceToNaturalPosition(player, assignedPosition);
  const penalty = OUT_OF_POSITION_DISTANCE_PENALTY[Math.min(4, distance)] ?? OUT_OF_POSITION_DISTANCE_PENALTY[4];
  return roundRating(assignedOverall - penalty);
};

export const calculateAllPositionOveralls = (player: Player): Record<Position, number> => ({
  PG: roundRating(calculatePositionOverall(player, 'PG')),
  SG: roundRating(calculatePositionOverall(player, 'SG')),
  SF: roundRating(calculatePositionOverall(player, 'SF')),
  PF: roundRating(calculatePositionOverall(player, 'PF')),
  C: roundRating(calculatePositionOverall(player, 'C'))
});

export const calculateBsnOverallFromRatings = (ratings: PlayerRatings, position: Position): number => calculatePositionOverallDiagnosticsFromRatings(ratings, position).finalRoundedOverall;
export const calculatePlayerOverall = (player: Player): number => calculateOverall(player);
export const bsnOverallBand = (overall: number): string => { if (overall >= 90) return 'BSN superstar / elite import'; if (overall >= 85) return 'BSN star / top native / top import'; if (overall >= 80) return 'Strong starter'; if (overall >= 75) return 'Average starter / strong sixth man'; if (overall >= 70) return 'Normal rotation player'; if (overall >= 65) return 'Deep bench / situational player'; if (overall >= 60) return 'Reserve / prospect'; return 'Emergency / non-rotation'; };
export const legacyTendenciesFromPlayer = (player: Player) => ({ shot3Rate: player.tendencies.threePointTendency, driveRate: player.tendencies.driveTendency, postUpRate: player.tendencies.postUpTendency, passRate: player.tendencies.passTendency, foulDrawRate: player.tendencies.drawFoulTendency });
