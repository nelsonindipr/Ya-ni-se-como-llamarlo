import type { Player, PlayerRatings, Position, SimplifiedPlayerRatings } from './types';

const clampRating = (value: number): number => Math.max(25, Math.min(99, value));
const roundRating = (value: number): number => Math.round(clampRating(value));
const avg = (...values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

export const speedWithBallProxyFromRatings = (ratings: PlayerRatings): number => ratings.speed * 0.55 + ratings.acceleration * 0.3 + ratings.ballHandle * 0.15;

type PositionOverallWeights = Record<Position, Record<keyof Player['ratings'], number>>;
type ScoringBlocks = Record<
  | 'perimeterShooting' | 'movementShooting' | 'shotCreation' | 'rimPressure'
  | 'guardPlaymaking' | 'wingPlaymaking' | 'bigPlaymaking'
  | 'guardDefense' | 'wingDefense' | 'bigDefense'
  | 'rebounding' | 'athleticism' | 'interiorScoring' | 'stretchScoring' | 'iqClutch',
  number
>;
type PositionArchetypeScores = Record<Position, Record<string, number>>;

const POSITION_BLEND_WEIGHTS: Record<Position, { base: number; archetype: number }> = {
  PG: { base: 0.6, archetype: 0.4 },
  SG: { base: 0.5, archetype: 0.5 },
  SF: { base: 0.55, archetype: 0.45 },
  PF: { base: 0.6, archetype: 0.4 },
  C: { base: 0.65, archetype: 0.35 }
};
const POSITION_MAX_UPLIFT_FROM_BASE: Record<Position, number> = { PG: 10, SG: 14, SF: 12, PF: 10, C: 9 };
const ARCHETYPE_MAX_UPLIFT_OVERRIDE: Record<string, number> = {
  offScreenShooter: 15,
  shotCreatorSG: 12,
  threeAndDSG: 10,
  stretchFour: 12,
  stretchFive: 12,
  passingHubC: 10,
  rimProtector: 9,
  rebounderC: 9
};
const ARCHETYPE_SCORE_MULTIPLIER: Record<string, number> = {
  offScreenShooter: 1.1,
  shotCreatorSG: 1.12,
  scoringPG: 1.08,
  stretchFour: 1.15,
  stretchFive: 1.15
};
const MAX_DOWNSIDE_FROM_BASE = 2;

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

const scoringBlocksFromRatings = (ratings: PlayerRatings): ScoringBlocks => ({
  perimeterShooting: ratings.threePoint * 0.45 + ratings.midRange * 0.2 + ratings.freeThrow * 0.15 + ratings.offBallMovement * 0.1 + ratings.shotCreation * 0.1,
  movementShooting: ratings.offBallMovement * 0.35 + ratings.threePoint * 0.35 + ratings.midRange * 0.15 + ratings.stamina * 0.1 + ratings.offensiveIQ * 0.05,
  shotCreation: ratings.shotCreation * 0.45 + ratings.ballHandle * 0.2 + ratings.midRange * 0.15 + ratings.threePoint * 0.1 + ratings.offensiveIQ * 0.1,
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
      floorGeneral: b.guardPlaymaking * 0.5 + b.perimeterShooting * 0.15 + b.iqClutch * 0.2 + b.guardDefense * 0.15,
      scoringPG: b.shotCreation * 0.35 + b.perimeterShooting * 0.25 + b.rimPressure * 0.2 + b.guardPlaymaking * 0.1 + b.iqClutch * 0.1,
      defensivePG: b.guardDefense * 0.55 + b.guardPlaymaking * 0.15 + b.athleticism * 0.15 + b.iqClutch * 0.15,
      reboundingPG: b.rebounding * 0.45 + b.guardDefense * 0.2 + b.athleticism * 0.2 + b.guardPlaymaking * 0.15,
      offBallPG: b.movementShooting * 0.5 + b.perimeterShooting * 0.2 + b.guardPlaymaking * 0.15 + b.iqClutch * 0.15
    },
    SG: {
      offScreenShooter: b.movementShooting * 0.5 + b.perimeterShooting * 0.25 + b.shotCreation * 0.1 + b.iqClutch * 0.15,
      shotCreatorSG: b.shotCreation * 0.45 + b.perimeterShooting * 0.2 + b.rimPressure * 0.15 + b.guardPlaymaking * 0.1 + b.iqClutch * 0.1,
      slasherSG: b.rimPressure * 0.45 + b.athleticism * 0.25 + b.shotCreation * 0.15 + b.guardDefense * 0.15,
      threeAndDSG: b.perimeterShooting * 0.35 + b.guardDefense * 0.4 + b.iqClutch * 0.15 + b.athleticism * 0.1,
      comboGuardSG: b.guardPlaymaking * 0.35 + b.shotCreation * 0.25 + b.perimeterShooting * 0.2 + b.guardDefense * 0.2,
      reboundingSG: b.rebounding * 0.5 + b.guardDefense * 0.2 + b.athleticism * 0.2 + b.perimeterShooting * 0.1
    },
    SF: {
      wingScorer: b.shotCreation * 0.35 + b.perimeterShooting * 0.2 + b.rimPressure * 0.2 + b.wingPlaymaking * 0.15 + b.iqClutch * 0.1,
      threeAndDWing: b.perimeterShooting * 0.28 + b.wingDefense * 0.42 + b.iqClutch * 0.2 + b.athleticism * 0.1,
      pointForward: b.wingPlaymaking * 0.45 + b.shotCreation * 0.15 + b.wingDefense * 0.15 + b.iqClutch * 0.25,
      slashingWing: b.rimPressure * 0.35 + b.athleticism * 0.25 + b.wingDefense * 0.2 + b.shotCreation * 0.2,
      reboundingWing: b.rebounding * 0.45 + b.wingDefense * 0.3 + b.athleticism * 0.15 + b.perimeterShooting * 0.1,
      offBallWing: b.movementShooting * 0.4 + b.perimeterShooting * 0.25 + b.wingDefense * 0.2 + b.iqClutch * 0.15
    },
    PF: {
      stretchFour: b.stretchScoring * 0.45 + b.rebounding * 0.15 + b.wingDefense * 0.1 + b.bigDefense * 0.15 + b.iqClutch * 0.15,
      interiorPF: b.interiorScoring * 0.35 + b.rebounding * 0.25 + b.bigDefense * 0.2 + b.athleticism * 0.1 + b.iqClutch * 0.1,
      defensiveRebounderPF: b.rebounding * 0.42 + b.bigDefense * 0.33 + b.athleticism * 0.1 + b.interiorScoring * 0.05 + b.iqClutch * 0.1,
      pointBigPF: b.bigPlaymaking * 0.38 + b.stretchScoring * 0.2 + b.interiorScoring * 0.12 + b.bigDefense * 0.1 + b.iqClutch * 0.2,
      rimRunnerPF: b.rimPressure * 0.3 + b.athleticism * 0.3 + b.rebounding * 0.2 + b.bigDefense * 0.2,
      smallBallBig: b.wingDefense * 0.25 + b.bigDefense * 0.2 + b.stretchScoring * 0.2 + b.rebounding * 0.15 + b.athleticism * 0.2
    },
    C: {
      rimProtector: b.bigDefense * 0.5 + b.rebounding * 0.25 + b.athleticism * 0.15 + b.interiorScoring * 0.1,
      rebounderC: b.rebounding * 0.5 + b.bigDefense * 0.25 + b.interiorScoring * 0.15 + b.athleticism * 0.1,
      postScorerC: b.interiorScoring * 0.45 + b.bigDefense * 0.2 + b.rebounding * 0.15 + b.iqClutch * 0.2,
      stretchFive: b.stretchScoring * 0.5 + b.bigPlaymaking * 0.15 + b.bigDefense * 0.15 + b.rebounding * 0.1 + b.iqClutch * 0.1,
      passingHubC: b.bigPlaymaking * 0.45 + b.iqClutch * 0.25 + b.interiorScoring * 0.1 + b.rebounding * 0.1 + b.bigDefense * 0.1,
      rimRunnerC: b.rimPressure * 0.3 + b.athleticism * 0.25 + b.bigDefense * 0.2 + b.rebounding * 0.2 + b.interiorScoring * 0.05,
      mobileSwitchC: b.athleticism * 0.25 + b.wingDefense * 0.2 + b.bigDefense * 0.25 + b.rebounding * 0.15 + b.stretchScoring * 0.15
    }
  };
  const shootingGate = Math.max(0.8, Math.min(1.25, (ratings.threePoint * 0.55 + ratings.offBallMovement * 0.45) / 80));
  return Object.fromEntries(
    Object.entries(scores[position]).map(([archetypeName, score]) => {
      const baseMultiplier = ARCHETYPE_SCORE_MULTIPLIER[archetypeName] ?? 1;
      const multiplier = archetypeName === 'offScreenShooter' ? baseMultiplier * shootingGate : baseMultiplier;
      return [archetypeName, score * multiplier];
    })
  );
};

export const calculatePositionOverallDiagnosticsFromRatings = (ratings: PlayerRatings, position: Position) => {
  const basePositionScore = calculatePositionOverallFromRatings(ratings, position);
  const archetypeScores = archetypeScoresForPosition(ratings, position);
  const [bestArchetypeName, bestArchetypeScore] = Object.entries(archetypeScores).sort((a, b) => b[1] - a[1])[0];
  const blend = POSITION_BLEND_WEIGHTS[position];
  const rawBlendedScore = basePositionScore * blend.base + bestArchetypeScore * blend.archetype;
  const maxUplift = ARCHETYPE_MAX_UPLIFT_OVERRIDE[bestArchetypeName] ?? POSITION_MAX_UPLIFT_FROM_BASE[position];
  const cappedFinalScore = Math.max(basePositionScore - MAX_DOWNSIDE_FROM_BASE, Math.min(basePositionScore + maxUplift, rawBlendedScore));
  const finalRoundedOverall = roundRating(cappedFinalScore);
  return { basePositionScore, archetypeScores, bestArchetypeName, bestArchetypeScore, rawBlendedScore, cappedFinalScore, finalRoundedOverall };
};

export const calculateBasePositionOverallFromRatings = (ratings: PlayerRatings, position: Position): number => calculatePositionOverallFromRatings(ratings, position);

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
