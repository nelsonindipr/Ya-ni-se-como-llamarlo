import type { Player, PlayerRatings, Position, SimplifiedPlayerRatings } from './types';

const clampRating = (value: number): number => Math.max(25, Math.min(99, value));
const roundRating = (value: number): number => Math.round(clampRating(value));

const avg = (...values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

type PositionOverallWeights = Record<Position, Partial<Record<keyof Player['ratings'], number>>>;

export const POSITION_OVERALL_WEIGHTS: PositionOverallWeights = {
  PG: {
    closeShot: 0.015,
    drivingLayup: 0.05,
    drivingDunk: 0.005,
    standingDunk: 0.002,
    postControl: 0.003,
    drawFoul: 0.035,
    midRange: 0.03,
    threePoint: 0.07,
    freeThrow: 0.03,
    shotCreation: 0.065,
    offBallMovement: 0.015,
    passAccuracy: 0.11,
    ballHandle: 0.11,
    speedWithBall: 0.075,
    interiorDefense: 0.01,
    perimeterDefense: 0.06,
    steal: 0.045,
    block: 0.005,
    offensiveRebound: 0.005,
    defensiveRebound: 0.015,
    speed: 0.045,
    acceleration: 0.045,
    strength: 0.015,
    vertical: 0.01,
    stamina: 0.025,
    offensiveIQ: 0.075,
    defensiveIQ: 0.03,
  },
  SG: {
    closeShot: 0.015,
    drivingLayup: 0.07,
    drivingDunk: 0.005,
    standingDunk: 0.002,
    postControl: 0.003,
    drawFoul: 0.045,
    midRange: 0.07,
    threePoint: 0.104,
    freeThrow: 0.045,
    shotCreation: 0.094,
    offBallMovement: 0.07,
    passAccuracy: 0.045,
    ballHandle: 0.06,
    speedWithBall: 0.055,
    interiorDefense: 0.01,
    perimeterDefense: 0.07,
    steal: 0.035,
    block: 0.005,
    offensiveRebound: 0.005,
    defensiveRebound: 0.015,
    speed: 0.035,
    acceleration: 0.03,
    strength: 0.015,
    vertical: 0.015,
    stamina: 0.002,
    offensiveIQ: 0.055,
    defensiveIQ: 0.025,
  },
  SF: {
    closeShot: 0.02,
    drivingLayup: 0.06,
    drivingDunk: 0.015,
    standingDunk: 0.005,
    postControl: 0.005,
    drawFoul: 0.04,
    midRange: 0.06,
    threePoint: 0.074,
    freeThrow: 0.03,
    shotCreation: 0.065,
    offBallMovement: 0.065,
    passAccuracy: 0.025,
    ballHandle: 0.045,
    speedWithBall: 0.001,
    interiorDefense: 0.02,
    perimeterDefense: 0.074,
    steal: 0.035,
    block: 0.01,
    offensiveRebound: 0.015,
    defensiveRebound: 0.04,
    speed: 0.055,
    acceleration: 0.045,
    strength: 0.055,
    vertical: 0.025,
    stamina: 0.001,
    offensiveIQ: 0.055,
    defensiveIQ: 0.06,
  },
  PF: {
    closeShot: 0.08,
    drivingLayup: 0.04,
    drivingDunk: 0.01,
    standingDunk: 0.045,
    postControl: 0.055,
    drawFoul: 0.04,
    midRange: 0.055,
    threePoint: 0.045,
    freeThrow: 0.02,
    shotCreation: 0.005,
    offBallMovement: 0.015,
    passAccuracy: 0.015,
    ballHandle: 0.01,
    speedWithBall: 0.01,
    interiorDefense: 0.07,
    perimeterDefense: 0.03,
    steal: 0.01,
    block: 0.045,
    offensiveRebound: 0.07,
    defensiveRebound: 0.065,
    speed: 0.02,
    acceleration: 0.015,
    strength: 0.075,
    vertical: 0.035,
    stamina: 0.025,
    offensiveIQ: 0.04,
    defensiveIQ: 0.055,
  },
  C: {
    closeShot: 0.09,
    drivingLayup: 0.01,
    drivingDunk: 0.005,
    standingDunk: 0.06,
    postControl: 0.055,
    drawFoul: 0.045,
    midRange: 0.02,
    threePoint: 0.015,
    freeThrow: 0.02,
    shotCreation: 0.005,
    offBallMovement: 0.01,
    passAccuracy: 0.015,
    ballHandle: 0.005,
    speedWithBall: 0.005,
    interiorDefense: 0.11,
    perimeterDefense: 0.015,
    steal: 0.005,
    block: 0.08,
    offensiveRebound: 0.07,
    defensiveRebound: 0.105,
    speed: 0.015,
    acceleration: 0.01,
    strength: 0.08,
    vertical: 0.035,
    stamina: 0.02,
    offensiveIQ: 0.035,
    defensiveIQ: 0.06,
  },
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
