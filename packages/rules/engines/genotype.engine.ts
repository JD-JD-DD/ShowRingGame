import {
  ALLELES_PER_LOCUS,
  CURRENT_GENETICS_VERSION,
  GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX,
  GENOTYPE_MICRO_UNITS,
  LOCI_PER_TRAIT,
  PHENOTYPE_TRAIT_COUNT,
  TOTAL_ALLELE_VALUES,
  TOTAL_LOCI,
  TRAIT_IDEAL,
  TRAIT_KEYS,
  TRAIT_MAX,
  TRAIT_MIN,
  type TraitKey,
} from "../constants/genetics.constants";

/** A diploid locus: two additive, directional allele effects. */
export type DiploidLocus = readonly [number, number];

/** The canonical hidden genotype for the current Post-Invitational contract. */
export type CanonicalGenotype = {
  geneticsVersion: typeof CURRENT_GENETICS_VERSION;
  loci: readonly DiploidLocus[];
};

export type GenotypePhenotype = Record<TraitKey, number>;

export type LegacyGenotypeReconstructionRequest = {
  knownPhenotype: GenotypePhenotype;
  deterministicKey: string;
  pedigreeContext?: unknown;
};

export type LegacyGenotypeReconstructionResult = {
  genotype: CanonicalGenotype;
};

export const CANONICAL_GENOTYPE_TRAIT_ORDER = TRAIT_KEYS;

export const GENOTYPE_TRAIT_LOCUS_INDICES: Readonly<Record<TraitKey, readonly number[]>> =
  Object.freeze(
    Object.fromEntries(
      CANONICAL_GENOTYPE_TRAIT_ORDER.map((trait, traitIndex) => [
        trait,
        Object.freeze(
          Array.from(
            { length: LOCI_PER_TRAIT },
            (_, locusOffset) => traitIndex * LOCI_PER_TRAIT + locusOffset
          )
        ),
      ])
    ) as Record<TraitKey, readonly number[]>
  );

const GENOTYPE_CODEC_PREFIX = `${CURRENT_GENETICS_VERSION}.`;
const ENCODED_GENOTYPE_BYTE_LENGTH = TOTAL_ALLELE_VALUES * Int32Array.BYTES_PER_ELEMENT;
const VALUE_PRECISION_EPSILON = 1e-12;

function contractError(message: string): never {
  throw new Error(`Invalid genotype contract: ${message}`);
}

function toMicroUnits(value: number, label: string): number {
  if (!Number.isFinite(value)) contractError(`${label} must be finite`);
  if (Math.abs(value) > GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX) {
    contractError(
      `${label} must be within +/-${GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX}`
    );
  }

  const microUnits = Math.round(value * GENOTYPE_MICRO_UNITS);
  if (!Number.isSafeInteger(microUnits)) contractError(`${label} is not safely representable`);
  if (Math.abs(value - microUnits / GENOTYPE_MICRO_UNITS) > VALUE_PRECISION_EPSILON) {
    contractError(`${label} supports no more than six decimal places`);
  }
  return microUnits;
}

function phenotypeToMicroUnits(value: number, trait: TraitKey): number {
  if (!Number.isFinite(value)) contractError(`known phenotype ${trait} must be finite`);
  if (value < TRAIT_MIN || value > TRAIT_MAX) {
    contractError(`known phenotype ${trait} must be within ${TRAIT_MIN}..${TRAIT_MAX}`);
  }
  const microUnits = Math.round(value * GENOTYPE_MICRO_UNITS);
  if (Math.abs(value - microUnits / GENOTYPE_MICRO_UNITS) > VALUE_PRECISION_EPSILON) {
    contractError(`known phenotype ${trait} supports no more than six decimal places`);
  }
  return microUnits;
}

/** Verifies the one canonical trait-to-locus layout before it is used or encoded. */
export function assertGenotypeArchitecture(): void {
  if (CANONICAL_GENOTYPE_TRAIT_ORDER.length !== PHENOTYPE_TRAIT_COUNT) {
    contractError("canonical trait order does not contain exactly ten traits");
  }
  const locusIndices = CANONICAL_GENOTYPE_TRAIT_ORDER.flatMap(
    (trait) => GENOTYPE_TRAIT_LOCUS_INDICES[trait]
  );
  if (locusIndices.length !== TOTAL_LOCI) {
    contractError("trait mapping does not contain exactly forty loci");
  }
  const expected = Array.from({ length: TOTAL_LOCI }, (_, index) => index);
  if (locusIndices.some((index, position) => index !== expected[position])) {
    contractError("trait mapping has overlapping or missing loci");
  }
  if (ALLELES_PER_LOCUS !== 2 || TOTAL_LOCI * ALLELES_PER_LOCUS !== TOTAL_ALLELE_VALUES) {
    contractError("locus/allele architecture is inconsistent");
  }
}

export function assertCanonicalGenotype(genotype: CanonicalGenotype): void {
  assertGenotypeArchitecture();
  if (genotype.geneticsVersion !== CURRENT_GENETICS_VERSION) {
    contractError(`unsupported genetics version ${String(genotype.geneticsVersion)}`);
  }
  if (!Array.isArray(genotype.loci) || genotype.loci.length !== TOTAL_LOCI) {
    contractError(`expected exactly ${TOTAL_LOCI} loci`);
  }
  genotype.loci.forEach((locus, locusIndex) => {
    if (!Array.isArray(locus) || locus.length !== ALLELES_PER_LOCUS) {
      contractError(`locus ${locusIndex} must have exactly two alleles`);
    }
    locus.forEach((allele, alleleIndex) =>
      toMicroUnits(allele, `locus ${locusIndex} allele ${alleleIndex}`)
    );
  });
}

export function createNeutralGenotype(): CanonicalGenotype {
  return {
    geneticsVersion: CURRENT_GENETICS_VERSION,
    loci: Array.from({ length: TOTAL_LOCI }, () => [0, 0] as const),
  };
}

/**
 * Pure GEN-01 additive expression. Values are summed as integer micro-units,
 * then clamped to the existing legal 0..20 trait range.
 */
export function calculatePhenotypeFromGenotype(
  genotype: CanonicalGenotype
): GenotypePhenotype {
  assertCanonicalGenotype(genotype);
  const phenotype = {} as GenotypePhenotype;
  const idealMicroUnits = TRAIT_IDEAL * GENOTYPE_MICRO_UNITS;
  const minimumMicroUnits = TRAIT_MIN * GENOTYPE_MICRO_UNITS;
  const maximumMicroUnits = TRAIT_MAX * GENOTYPE_MICRO_UNITS;

  for (const trait of CANONICAL_GENOTYPE_TRAIT_ORDER) {
    const contribution = GENOTYPE_TRAIT_LOCUS_INDICES[trait].reduce(
      (traitTotal, locusIndex) =>
        traitTotal +
        toMicroUnits(genotype.loci[locusIndex][0], `locus ${locusIndex} allele 0`) +
        toMicroUnits(genotype.loci[locusIndex][1], `locus ${locusIndex} allele 1`),
      0
    );
    phenotype[trait] =
      Math.max(minimumMicroUnits, Math.min(maximumMicroUnits, idealMicroUnits + contribution)) /
      GENOTYPE_MICRO_UNITS;
  }
  return phenotype;
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) contractError("codec payload is malformed");
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    contractError("codec payload is malformed");
  }
}

/** Stable base64url encoding of 80 signed int32 allele micro-unit values. */
export function encodeGenotype(genotype: CanonicalGenotype): string {
  assertCanonicalGenotype(genotype);
  const bytes = new Uint8Array(ENCODED_GENOTYPE_BYTE_LENGTH);
  const view = new DataView(bytes.buffer);
  genotype.loci.flat().forEach((allele, alleleIndex) =>
    view.setInt32(alleleIndex * Int32Array.BYTES_PER_ELEMENT, toMicroUnits(allele, `allele ${alleleIndex}`), false)
  );
  return `${GENOTYPE_CODEC_PREFIX}${encodeBytes(bytes)}`;
}

export function decodeGenotype(encoded: string): CanonicalGenotype {
  if (typeof encoded !== "string" || !encoded.startsWith(GENOTYPE_CODEC_PREFIX)) {
    contractError("unsupported genetics version");
  }
  const bytes = decodeBytes(encoded.slice(GENOTYPE_CODEC_PREFIX.length));
  if (bytes.byteLength !== ENCODED_GENOTYPE_BYTE_LENGTH) {
    contractError(`codec payload must contain ${TOTAL_ALLELE_VALUES} allele values`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const loci = Array.from({ length: TOTAL_LOCI }, (_, locusIndex) => {
    const offset = locusIndex * ALLELES_PER_LOCUS * Int32Array.BYTES_PER_ELEMENT;
    return [
      view.getInt32(offset, false) / GENOTYPE_MICRO_UNITS,
      view.getInt32(offset + Int32Array.BYTES_PER_ELEMENT, false) / GENOTYPE_MICRO_UNITS,
    ] as const;
  });
  const genotype: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci };
  assertCanonicalGenotype(genotype);
  return genotype;
}

/**
 * GEN-03 must call this after reconstruction. It intentionally does not
 * construct or persist legacy genotypes; exact known phenotype wins over
 * optional pedigree coherence.
 */
export function assertLegacyGenotypeReconstructionContract(input: {
  request: LegacyGenotypeReconstructionRequest;
  result: LegacyGenotypeReconstructionResult;
}): void {
  if (!input.request.deterministicKey) {
    contractError("legacy reconstruction requires a deterministic key");
  }
  const reconstructed = calculatePhenotypeFromGenotype(input.result.genotype);
  for (const trait of CANONICAL_GENOTYPE_TRAIT_ORDER) {
    if (phenotypeToMicroUnits(reconstructed[trait], trait) !== phenotypeToMicroUnits(input.request.knownPhenotype[trait], trait)) {
      contractError(`legacy reconstruction does not exactly preserve ${trait}`);
    }
  }
}

assertGenotypeArchitecture();
