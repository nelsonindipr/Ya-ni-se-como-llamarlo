import type { Player, PlayerRatings, Position, SimplifiedPlayerRatings } from './types';

const roundRating = (value: number): number => Math.round(Math.max(25, Math.min(99, value)));

const avg = (...values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

const positionOverallWeights: Record<Position, [number, number, number, number, number, number, number, number]> = {
  PG: [0.12, 0.1, 0.16, 0.22, 0.14, 0.07, 0.06, 0.13],
  SG: [0.13, 0.13, 0.2, 0.15, 0.16, 0.06, 0.05, 0.12],
  SF: [0.15, 0.12, 0.16, 0.13, 0.19, 0.11, 0.06, 0.08],
  PF: [0.2, 0.1, 0.1, 0.09, 0.13, 0.2, 0.1, 0.08],
  C: [0.21, 0.07, 0.04, 0.06, 0.08, 0.27, 0.18, 0.09]
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

export const calculateBsnOverallFromRatings = (ratings: PlayerRatings, position: Position): number => {
  const simplified = {
    insideScoring: roundRating(avg(ratings.closeShot, ratings.drivingLayup, ratings.standingDunk, ratings.postControl)),
    midRangeScoring: roundRating(avg(ratings.midRange, ratings.shotCreation)),
    threePointScoring: roundRating(avg(ratings.threePoint, ratings.offBallMovement)),
    playmaking: roundRating(avg(ratings.passAccuracy, ratings.ballHandle, ratings.offensiveIQ)),
    perimeterDefense: roundRating(ratings.perimeterDefense),
    interiorDefense: roundRating(ratings.interiorDefense),
    rebounding: roundRating(avg(ratings.offensiveRebound, ratings.defensiveRebound)),
    stamina: roundRating(ratings.stamina)
  };
  const [inW, midW, threeW, playW, perDefW, intDefW, rebW, stamW] = positionOverallWeights[position];

  return roundRating(
    simplified.insideScoring * inW +
      simplified.midRangeScoring * midW +
      simplified.threePointScoring * threeW +
      simplified.playmaking * playW +
      simplified.perimeterDefense * perDefW +
      simplified.interiorDefense * intDefW +
      simplified.rebounding * rebW +
      simplified.stamina * stamW
  );
};

export const calculatePlayerOverall = (player: Player): number => calculateBsnOverallFromRatings(player.ratings, player.position);

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
