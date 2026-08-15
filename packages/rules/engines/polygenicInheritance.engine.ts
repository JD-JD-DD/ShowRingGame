import {
  CURRENT_GENETICS_VERSION,
  GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX,
  GENOTYPE_MICRO_UNITS,
  TOTAL_LOCI,
} from "../constants/genetics.constants";
import {
  assertCanonicalGenotype,
  calculatePhenotypeFromGenotype,
  encodeGenotype,
  type CanonicalGenotype,
  type GenotypePhenotype,
} from "./genotype.engine";

export type Random01 = () => number;
export type Gamete = readonly number[];

/** GEN-06 supplies calibrated values; GEN-04 intentionally has no default. */
export type ModelDMutationConfig = {
  probability: number;
  effectMagnitude: number;
};

/** Reserved, inert GEN-05 reference. It never moves the fixed ideal in GEN-04. */
export type BreedBackgroundContext = {
  version: string;
  referenceId?: string;
};

/** Reserved, inert context for future homozygosity/segregation behavior. */
export type CoiInheritanceContext = {
  coiPercent?: number;
  homozygosityReference?: string;
};

export type ModelDInheritanceInput = {
  sireGenotype: CanonicalGenotype;
  damGenotype: CanonicalGenotype;
  random01: Random01;
  mutation: ModelDMutationConfig;
  breedBackground?: BreedBackgroundContext;
  coi?: CoiInheritanceContext;
};

export type ModelDInheritanceResult = {
  genotype: CanonicalGenotype;
  encodedGenotype: string;
  geneticsVersion: typeof CURRENT_GENETICS_VERSION;
  phenotype: GenotypePhenotype;
  mutationCount: number;
};

function nextRoll(random01: Random01, label: string): number {
  const value = random01();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`${label} must return a finite value in [0, 1).`);
  }
  return value;
}

function validateMutationConfig(config: ModelDMutationConfig): void {
  if (!Number.isFinite(config.probability) || config.probability < 0 || config.probability > 1) {
    throw new Error("Model D mutation probability must be within 0..1.");
  }
  const microUnits = Math.round(config.effectMagnitude * GENOTYPE_MICRO_UNITS);
  if (!Number.isFinite(config.effectMagnitude) || config.effectMagnitude < 0 ||
    Math.abs(config.effectMagnitude - microUnits / GENOTYPE_MICRO_UNITS) > 1e-12 ||
    config.effectMagnitude > GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX) {
    throw new Error("Model D mutation effectMagnitude must be a bounded six-decimal value.");
  }
}

/** Forms a 40-allele gamete in canonical locus order using independent rolls. */
export function formModelDGamete(parent: CanonicalGenotype, random01: Random01): Gamete {
  assertCanonicalGenotype(parent);
  return parent.loci.map((locus, locusIndex) =>
    nextRoll(random01, `gamete locus ${locusIndex}`) < 0.5 ? locus[0] : locus[1]
  );
}

function mutateInheritedAllele(args: {
  allele: number;
  random01: Random01;
  mutation: ModelDMutationConfig;
  label: string;
}): { allele: number; mutated: boolean } {
  if (nextRoll(args.random01, `${args.label} mutation roll`) >= args.mutation.probability || args.mutation.effectMagnitude === 0) {
    return { allele: args.allele, mutated: false };
  }
  const direction = nextRoll(args.random01, `${args.label} mutation direction`) < 0.5 ? -1 : 1;
  const mutated = args.allele + direction * args.mutation.effectMagnitude;
  // GEN-01 permits bounded alleles; clamp deterministically rather than wrapping.
  return {
    allele: Math.max(-GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX, Math.min(GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX, mutated)),
    mutated: true,
  };
}

/**
 * Pure Model D v1 inheritance. Breed-background and COI contexts are accepted
 * as typed, intentionally inert future hooks; all loci segregate independently.
 */
export function inheritModelDGenotype(input: ModelDInheritanceInput): ModelDInheritanceResult {
  assertCanonicalGenotype(input.sireGenotype);
  assertCanonicalGenotype(input.damGenotype);
  validateMutationConfig(input.mutation);
  const sireGamete = formModelDGamete(input.sireGenotype, input.random01);
  const damGamete = formModelDGamete(input.damGenotype, input.random01);
  if (sireGamete.length !== TOTAL_LOCI || damGamete.length !== TOTAL_LOCI) {
    throw new Error("Model D gametes must contain exactly forty alleles.");
  }

  let mutationCount = 0;
  const loci = Array.from({ length: TOTAL_LOCI }, (_, locusIndex) => {
    const sire = mutateInheritedAllele({ allele: sireGamete[locusIndex], random01: input.random01, mutation: input.mutation, label: `sire locus ${locusIndex}` });
    const dam = mutateInheritedAllele({ allele: damGamete[locusIndex], random01: input.random01, mutation: input.mutation, label: `dam locus ${locusIndex}` });
    mutationCount += Number(sire.mutated) + Number(dam.mutated);
    return [sire.allele, dam.allele] as const;
  });
  const genotype: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci };
  assertCanonicalGenotype(genotype);
  return {
    genotype,
    encodedGenotype: encodeGenotype(genotype),
    geneticsVersion: CURRENT_GENETICS_VERSION,
    phenotype: calculatePhenotypeFromGenotype(genotype),
    mutationCount,
  };
}
