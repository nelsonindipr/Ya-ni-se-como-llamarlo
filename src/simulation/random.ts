export type RandomSource = () => number;

export const createSeededRandom = (seed: number): RandomSource => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

export const randomInt = (min: number, max: number, rng: RandomSource): number =>
  Math.floor(rng() * (max - min + 1)) + min;
