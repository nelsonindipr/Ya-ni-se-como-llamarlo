import type { Player, PlayerRatings, Position, SimplifiedPlayerRatings } from './types';

const clampRating = (value: number): number => Math.max(25, Math.min(99, value));
const roundRating = (value: number): number => Math.round(clampRating(value));

const avg = (...values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

type PositionOverallWeights = Record<Position, Partial<Record<keyof Player['ratings'], number>>>;

export const POSITION_OVERALL_WEIGHTS: PositionOverallWeights = {
  PG: {
    passAccuracy: 0.14,
    ballHandle: 0.13,
    speedWithBall: 0.09,
    offensiveIQ: 0.09,
    threePoint: 0.08,
    shotCreation: 0.06,
    drivingLayup: 0.05,
    drawFoul: 0.04,
    perimeterDefense: 0.07,
    steal: 0.05,
    speed: 0.05,
    acceleration: 0.05,
    freeThrow: 0.03,
    midRange: 0.03,
    defensiveIQ: 0.03,
    stamina: 0.01
  },
  SG: {
    threePoint: 0.14,
    shotCreation: 0.10,
    drivingLayup: 0.07,
    drawFoul: 0.05,
    midRange: 0.08,
    offBallMovement: 0.08,
    perimeterDefense: 0.08,
    ballHandle: 0.07,
    speedWithBall: 0.06,
    offensiveIQ: 0.06,
    passAccuracy: 0.05,
    freeThrow: 0.05,
    steal: 0.04,
    speed: 0.04,
    acceleration: 0.02,
    defensiveIQ: 0.01
  },
  SF: {
    perimeterDefense: 0.1,
    threePoint: 0.1,
    drivingLayup: 0.06,
    drawFoul: 0.04,
    shotCreation: 0.07,
    offBallMovement: 0.07,
    midRange: 0.07,
    defensiveIQ: 0.07,
    offensiveIQ: 0.06,
    strength: 0.06,
    speed: 0.06,
    acceleration: 0.05,
    ballHandle: 0.05,
    defensiveRebound: 0.04,
    steal: 0.04,
    freeThrow: 0.03,
    vertical: 0.02,
    passAccuracy: 0.01
  },
  PF: {
    interiorDefense: 0.11,
    defensiveRebound: 0.1,
    closeShot: 0.09,
    strength: 0.08,
    offensiveRebound: 0.08,
    postControl: 0.06,
    standingDunk: 0.05,
    drawFoul: 0.04,
    defensiveIQ: 0.06,
    midRange: 0.06,
    threePoint: 0.05,
    drivingLayup: 0.04,
    block: 0.05,
    offensiveIQ: 0.03,
    vertical: 0.04,
    perimeterDefense: 0.03,
    stamina: 0.02,
    freeThrow: 0.01
  },
  C: {
    interiorDefense: 0.14,
    defensiveRebound: 0.12,
    closeShot: 0.1,
    strength: 0.09,
    block: 0.09,
    offensiveRebound: 0.08,
    standingDunk: 0.07,
    postControl: 0.06,
    defensiveIQ: 0.05,
    offensiveIQ: 0.04,
    vertical: 0.04,
    freeThrow: 0.02,
    stamina: 0.02,
    midRange: 0.01,
    perimeterDefense: 0.01,
    threePoint: 0.01,
    drawFoul: 0.05
  }
};

export const simplifiedRatingsFromDetailed = (player: Player): SimplifiedPlayerRatings => ({
  insideScoring: roundRating(avg(player.ratings.closeShot, player.ratings.drivingLayup, player.ratings.standingDunk, player.ratings.postControl)),
  midRangeScoring: roundRating(avg(player.ratings.midRange, player.ratings.shotCreation)),
  threePointScoring: roundRating(avg(player.ratings.threePoint, player.ratings.offBallMovement)),
  playmaking: roundRating(avg(player.ratings.passAccuracy, player.ratings.ballHandle, player.ratings.offensiveIQ)),
  perimeterDefense: roundRating(player.ratings.perimeterDefense),
  interiorDefense: roundRating(player.ratings.interiorDefense),
  rebounding: roundRating(avg(player.ratings.offensiveRebound, player.ratings.defensiveRebound)),
  stamina: roundRating(player.ratings.stamina)
});

export const calculatePositionOverall = (player: Player, position: Position): number => {
  const weights = POSITION_OVERALL_WEIGHTS[position];
  const rawOverall = Object.entries(weights).reduce((total, [attribute, weight]) => {
    return total + player.ratings[attribute as keyof Player['ratings']] * (weight ?? 0);
  }, 0);

  return rawOverall;
};

const calculatePositionOverallFromRatings = (ratings: PlayerRatings, position: Position): number => {
  const weights = POSITION_OVERALL_WEIGHTS[position];
  return Object.entries(weights).reduce((total, [attribute, weight]) => {
    return total + ratings[attribute as keyof PlayerRatings] * (weight ?? 0);
  }, 0);
};

export const calculateOverall = (player: Player): number => {
  const primaryOverall = calculatePositionOverall(player, player.position);

  if (player.secondaryPositions.length === 0) {
    return roundRating(primaryOverall);
  }

  const bestSecondaryOverall = Math.max(...player.secondaryPositions.map((position) => calculatePositionOverall(player, position)));
  const blendedOverall = primaryOverall * 0.75 + bestSecondaryOverall * 0.25;

  return roundRating(blendedOverall);
};

// Backwards-compatible export.
export const calculateBsnOverallFromRatings = (ratings: PlayerRatings, position: Position): number =>
  roundRating(calculatePositionOverallFromRatings(ratings, position));

export const calculatePlayerOverall = (player: Player): number => calculateOverall(player);

export const bsnOverallBand = (overall: number): string => {
  if (overall >= 90) return 'BSN superstar / elite import';
  if (overall >= 85) return 'BSN star / top native / top import';
  if (overall >= 80) return 'Strong starter';
  if (overall >= 75) return 'Average starter / strong sixth man';
  if (overall >= 70) return 'Normal rotation player';
  if (overall >= 65) return 'Deep bench / situational player';
  if (overall >= 60) return 'Reserve / prospect';
  return 'Emergency / non-rotation';
};

export const legacyTendenciesFromPlayer = (player: Player) => ({
  shot3Rate: player.tendencies.threePointTendency,
  driveRate: player.tendencies.driveTendency,
  postUpRate: player.tendencies.postUpTendency,
  passRate: player.tendencies.passTendency,
  foulDrawRate: player.tendencies.drawFoulTendency
});
