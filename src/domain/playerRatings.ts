import type { Player, SimplifiedPlayerRatings } from './types';

const roundRating = (value: number): number => Math.round(Math.max(25, Math.min(99, value)));

const avg = (...values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

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

export const legacyTendenciesFromPlayer = (player: Player) => ({
  shot3Rate: player.tendencies.threePointTendency,
  driveRate: player.tendencies.driveTendency,
  postUpRate: player.tendencies.postUpTendency,
  passRate: player.tendencies.passTendency,
  foulDrawRate: player.tendencies.drawFoulTendency
});
