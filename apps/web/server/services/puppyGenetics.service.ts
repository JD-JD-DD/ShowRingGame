import type { DogTraits } from "@showring/rules";

/**
 * Stable, purpose-separated input for current puppy conformation inheritance.
 * Parent genotype fields are carried for GEN-08 parity but deliberately unused
 * while GEN-07 preserves the live phenotype-level algorithm.
 */
export type PuppyGeneticsBirthContext = {
  breedingAttemptId: string;
  litterId: string;
  litterOrder: number;
  geneticsSeed: number;
  sire: { id: string; traits: DogTraits; genotype?: string | null; geneticsVersion?: string | null };
  dam: { id: string; traits: DogTraits; genotype?: string | null; geneticsVersion?: string | null };
  coiPercent: number;
};

function seeded01(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x85ebca6b); hash ^= hash >>> 13; hash = Math.imul(hash, 0xc2b2ae35); hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}

/** Genetics-only stream: unaffected by emergency, retry, wall-clock, or array order. */
export function createPuppyGeneticsRandom01(context: PuppyGeneticsBirthContext): () => number {
  let draw = 0;
  return () => seeded01(`${context.geneticsSeed}:puppy-genetics-v1:${context.breedingAttemptId}:${context.litterOrder}:${draw++}`);
}

export function createPuppyGeneticsRandom01ForLitter(args: Omit<PuppyGeneticsBirthContext, "litterOrder">): (litterOrder: number) => () => number {
  return (litterOrder) => createPuppyGeneticsRandom01({ ...args, litterOrder });
}
