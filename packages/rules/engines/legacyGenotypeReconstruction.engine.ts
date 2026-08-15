import {
  CURRENT_GENETICS_VERSION,
  GENOTYPE_MICRO_UNITS,
  TRAIT_IDEAL,
} from "../constants/genetics.constants";
import {
  CANONICAL_GENOTYPE_TRAIT_ORDER,
  GENOTYPE_TRAIT_LOCUS_INDICES,
  assertLegacyGenotypeReconstructionContract,
  decodeGenotype,
  type CanonicalGenotype,
  type GenotypePhenotype,
} from "./genotype.engine";

export type LegacyGenotypeParentContext = {
  sire?: CanonicalGenotype;
  dam?: CanonicalGenotype;
};

export type ReconstructLegacyGenotypeInput = {
  /** Stable dog-specific identity, normally `${dog.id}:${dog.regNumber}`. */
  deterministicKey: string;
  knownPhenotype: GenotypePhenotype;
  parents?: LegacyGenotypeParentContext;
};

// These are legacy-initialization shaping limits, not future allele calibration.
const LEGACY_JITTER_MICRO_UNITS = 125_000;
const LEGACY_PARENT_STRUCTURE_DIVISOR = 4;
const ALLELES_PER_TRAIT = 8;

function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  return (hash ^ (hash >>> 16)) >>> 0;
}

function deterministicOrder(seed: string): number[] {
  return Array.from({ length: ALLELES_PER_TRAIT }, (_, index) => index).sort(
    (left, right) => hash32(`${seed}:${left}`) - hash32(`${seed}:${right}`)
  );
}

function distributeExactly(total: number, seed: string): number[] {
  const base = Math.trunc(total / ALLELES_PER_TRAIT);
  const remainder = total - base * ALLELES_PER_TRAIT;
  const values = Array.from({ length: ALLELES_PER_TRAIT }, () => base);
  const direction = Math.sign(remainder);
  deterministicOrder(seed)
    .slice(0, Math.abs(remainder))
    .forEach((index) => {
      values[index] += direction;
    });
  return values;
}

function centerExactly(values: number[], seed: string): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  const correction = distributeExactly(-total, `${seed}:correction`);
  return values.map((value, index) => value + correction[index]);
}

function parentStructure(
  trait: keyof GenotypePhenotype,
  parents: LegacyGenotypeParentContext | undefined
): number[] {
  const parentGenotypes = [parents?.sire, parents?.dam].filter(
    (parent): parent is CanonicalGenotype => parent !== undefined
  );
  if (parentGenotypes.length === 0) return Array.from({ length: ALLELES_PER_TRAIT }, () => 0);

  const parentValues = parentGenotypes.map((parent) =>
    GENOTYPE_TRAIT_LOCUS_INDICES[trait].flatMap((locusIndex) => parent.loci[locusIndex])
  );
  const averaged = Array.from({ length: ALLELES_PER_TRAIT }, (_, alleleIndex) => {
    const alleleTotal = parentValues.reduce((sum, alleles) => sum + alleles[alleleIndex], 0);
    return Math.round((alleleTotal / parentGenotypes.length) * GENOTYPE_MICRO_UNITS);
  });
  const mean = Math.trunc(
    averaged.reduce((sum, value) => sum + value, 0) / ALLELES_PER_TRAIT
  );
  return averaged.map((value) => Math.trunc((value - mean) / LEGACY_PARENT_STRUCTURE_DIVISOR));
}

function reconstructTrait(args: {
  trait: keyof GenotypePhenotype;
  phenotype: number;
  deterministicKey: string;
  parents?: LegacyGenotypeParentContext;
}): number[] {
  const targetTotal = Math.round((args.phenotype - TRAIT_IDEAL) * GENOTYPE_MICRO_UNITS);
  const seed = `${CURRENT_GENETICS_VERSION}:${args.deterministicKey}:${args.trait}`;
  const latent = parentStructure(args.trait, args.parents).map(
    (parentValue, alleleIndex) => {
      const jitter =
        (hash32(`${seed}:jitter:${alleleIndex}`) % (LEGACY_JITTER_MICRO_UNITS * 2 + 1)) -
        LEGACY_JITTER_MICRO_UNITS;
      return parentValue + jitter;
    }
  );
  const exactBase = distributeExactly(targetTotal, `${seed}:base`);
  const centeredLatent = centerExactly(latent, seed);
  return exactBase.map((base, alleleIndex) => base + centeredLatent[alleleIndex]);
}

/**
 * Deterministically creates a hidden GEN-01 genotype around authoritative
 * legacy phenotype. Parent alleles influence relative arrangement only; the
 * exact phenotype sum is always reconstructed independently.
 */
export function reconstructLegacyGenotype(
  input: ReconstructLegacyGenotypeInput
): CanonicalGenotype {
  if (!input.deterministicKey) {
    throw new Error("Legacy genotype reconstruction requires a deterministic key.");
  }
  const loci: Array<readonly [number, number]> = Array.from(
    { length: CANONICAL_GENOTYPE_TRAIT_ORDER.length * 4 },
    () => [0, 0] as const
  );

  for (const trait of CANONICAL_GENOTYPE_TRAIT_ORDER) {
    const alleles = reconstructTrait({
      trait,
      phenotype: input.knownPhenotype[trait],
      deterministicKey: input.deterministicKey,
      parents: input.parents,
    });
    GENOTYPE_TRAIT_LOCUS_INDICES[trait].forEach((locusIndex, traitLocusIndex) => {
      loci[locusIndex] = [
        alleles[traitLocusIndex * 2] / GENOTYPE_MICRO_UNITS,
        alleles[traitLocusIndex * 2 + 1] / GENOTYPE_MICRO_UNITS,
      ] as const;
    });
  }

  const genotype: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci };
  assertLegacyGenotypeReconstructionContract({
    request: {
      knownPhenotype: input.knownPhenotype,
      deterministicKey: input.deterministicKey,
      pedigreeContext: input.parents,
    },
    result: { genotype },
  });
  return genotype;
}

/** Validates an existing current-version stored genotype before an idempotent rerun. */
export function assertStoredLegacyGenotype(input: {
  genotype: string;
  geneticsVersion: string;
  knownPhenotype: GenotypePhenotype;
  deterministicKey: string;
}): CanonicalGenotype {
  if (input.geneticsVersion !== CURRENT_GENETICS_VERSION) {
    throw new Error(`Unsupported stored genetics version ${input.geneticsVersion}.`);
  }
  const genotype = decodeGenotype(input.genotype);
  assertLegacyGenotypeReconstructionContract({
    request: {
      knownPhenotype: input.knownPhenotype,
      deterministicKey: input.deterministicKey,
    },
    result: { genotype },
  });
  return genotype;
}
