// Seeded pseudo-random helpers so mock data is identical on every reload.

export interface Rng {
  /** Float in [0, 1). */
  rand(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T;
  chance(p: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32: tiny, fast, good-enough PRNG for test data. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const rand = mulberry32(seed);

  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)];

  const weightedPick = <T>(items: readonly T[], weights: readonly number[]): T => {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = rand() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll < 0) return items[i];
    }
    return items[items.length - 1];
  };

  const chance = (p: number) => rand() < p;

  // Fisher-Yates on a copy.
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  return { rand, int, pick, weightedPick, chance, shuffle };
}
