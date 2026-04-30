import type { Player, PlayerRatings, Position, SimplifiedPlayerRatings } from './types';

const clampRating = (value: number): number => Math.max(25, Math.min(99, value));
const roundRating = (value: number): number => Math.round(clampRating(value));
const avg = (...values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

export const speedWithBallProxyFromRatings = (ratings: PlayerRatings): number => ratings.speed * 0.55 + ratings.acceleration * 0.3 + ratings.ballHandle * 0.15;

type PositionOverallWeights = Record<Position, Record<keyof Player['ratings'], number>>;

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
  Object.entries(POSITION_OVERALL_WEIGHTS[position]).reduce((total, [attribute, weight]) => total + player.ratings[attribute as keyof PlayerRatings] * weight, 0);

const calculatePositionOverallFromRatings = (ratings: PlayerRatings, position: Position): number =>
  Object.entries(POSITION_OVERALL_WEIGHTS[position]).reduce((total, [attribute, weight]) => total + ratings[attribute as keyof PlayerRatings] * weight, 0);

export const calculateOverall = (player: Player): number => {
  const primaryOverall = calculatePositionOverall(player, player.position);
  if (player.secondaryPositions.length === 0) return roundRating(primaryOverall);
  const bestSecondaryOverall = Math.max(...player.secondaryPositions.map((position) => calculatePositionOverall(player, position)));
  return roundRating(primaryOverall * 0.75 + bestSecondaryOverall * 0.25);
};

export const calculateBsnOverallFromRatings = (ratings: PlayerRatings, position: Position): number => roundRating(calculatePositionOverallFromRatings(ratings, position));
export const calculatePlayerOverall = (player: Player): number => calculateOverall(player);
export const bsnOverallBand = (overall: number): string => { if (overall >= 90) return 'BSN superstar / elite import'; if (overall >= 85) return 'BSN star / top native / top import'; if (overall >= 80) return 'Strong starter'; if (overall >= 75) return 'Average starter / strong sixth man'; if (overall >= 70) return 'Normal rotation player'; if (overall >= 65) return 'Deep bench / situational player'; if (overall >= 60) return 'Reserve / prospect'; return 'Emergency / non-rotation'; };
export const legacyTendenciesFromPlayer = (player: Player) => ({ shot3Rate: player.tendencies.threePointTendency, driveRate: player.tendencies.driveTendency, postUpRate: player.tendencies.postUpTendency, passRate: player.tendencies.passTendency, foulDrawRate: player.tendencies.drawFoulTendency });
