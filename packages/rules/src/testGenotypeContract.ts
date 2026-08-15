import {
  ALLELES_PER_LOCUS,
  CANONICAL_GENOTYPE_TRAIT_ORDER,
  CURRENT_GENETICS_VERSION,
  GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX,
  GENOTYPE_TRAIT_LOCUS_INDICES,
  LOCI_PER_TRAIT,
  PHENOTYPE_TRAIT_COUNT,
  TOTAL_ALLELE_VALUES,
  TOTAL_LOCI,
  assertCanonicalGenotype,
  assertGenotypeArchitecture,
  assertLegacyGenotypeReconstructionContract,
  calculatePhenotypeFromGenotype,
  createNeutralGenotype,
  decodeGenotype,
  encodeGenotype,
  type CanonicalGenotype,
} from "../src/index";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)}`);
  }
}

function assertThrows(action: () => unknown, message: string): void {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(`${message}: expected an error`);
}

assertGenotypeArchitecture();
assertEqual(PHENOTYPE_TRAIT_COUNT, 10, "ten phenotype traits");
assertEqual(CANONICAL_GENOTYPE_TRAIT_ORDER.length, 10, "canonical trait order length");
assertEqual(LOCI_PER_TRAIT, 4, "four loci per trait");
assertEqual(ALLELES_PER_LOCUS, 2, "two alleles per locus");
assertEqual(TOTAL_LOCI, 40, "forty loci");
assertEqual(TOTAL_ALLELE_VALUES, 80, "eighty allele values");
assertDeepEqual(
  CANONICAL_GENOTYPE_TRAIT_ORDER.flatMap((trait) => GENOTYPE_TRAIT_LOCUS_INDICES[trait]),
  Array.from({ length: TOTAL_LOCI }, (_, index) => index),
  "trait-to-locus mapping is complete and non-overlapping"
);

const neutral = createNeutralGenotype();
const neutralPhenotype = calculatePhenotypeFromGenotype(neutral);
for (const trait of CANONICAL_GENOTYPE_TRAIT_ORDER) {
  assertEqual(neutralPhenotype[trait], 10, `neutral ${trait} is exactly 10.000000`);
}

const directional = createNeutralGenotype();
const directionalLoci = directional.loci.map((locus) => [...locus] as [number, number]);
directionalLoci[0] = [0.125, 0.25];
directionalLoci[4] = [-0.125, -0.25];
directionalLoci[8] = [0.5, -0.5];
const directionalPhenotype = calculatePhenotypeFromGenotype({
  geneticsVersion: CURRENT_GENETICS_VERSION,
  loci: directionalLoci,
});
assertEqual(directionalPhenotype.head, 10.375, "positive alleles move phenotype above ideal");
assertEqual(directionalPhenotype.forequarters, 9.625, "negative alleles move phenotype below ideal");
assertEqual(directionalPhenotype.hindquarters, 10, "opposite allele effects cancel");

const additiveLoci = createNeutralGenotype().loci.map((locus) => [...locus] as [number, number]);
const expectedPhenotypes = [10.1, 9.8, 10.3, 9.6, 10.5, 9.4, 10.7, 9.2, 10.9, 9.0];
CANONICAL_GENOTYPE_TRAIT_ORDER.forEach((trait, traitIndex) => {
  const contribution = expectedPhenotypes[traitIndex] - 10;
  const [firstLocus] = GENOTYPE_TRAIT_LOCUS_INDICES[trait];
  additiveLoci[firstLocus] = [contribution, 0];
});
const additiveGenotype: CanonicalGenotype = {
  geneticsVersion: CURRENT_GENETICS_VERSION,
  loci: additiveLoci,
};
const additivePhenotype = calculatePhenotypeFromGenotype(additiveGenotype);
CANONICAL_GENOTYPE_TRAIT_ORDER.forEach((trait, traitIndex) =>
  assertEqual(additivePhenotype[trait], expectedPhenotypes[traitIndex], `additive ${trait}`)
);

const precisionLoci = createNeutralGenotype().loci.map((locus) => [...locus] as [number, number]);
precisionLoci[0] = [0.123456, -0.000001];
const precisionGenotype: CanonicalGenotype = {
  geneticsVersion: CURRENT_GENETICS_VERSION,
  loci: precisionLoci,
};
assertEqual(
  calculatePhenotypeFromGenotype(precisionGenotype).head,
  10.123455,
  "six-decimal precision is retained without display rounding"
);

const encoded = encodeGenotype(precisionGenotype);
assertEqual(encoded.startsWith(`${CURRENT_GENETICS_VERSION}.`), true, "encoding carries genetics version");
assertEqual(encodeGenotype(decodeGenotype(encoded)), encoded, "codec round trip is deterministic");
assertDeepEqual(
  calculatePhenotypeFromGenotype(decodeGenotype(encoded)),
  calculatePhenotypeFromGenotype(precisionGenotype),
  "decoded genotype reproduces phenotype"
);
assertThrows(() => decodeGenotype("unknown-version.payload"), "unsupported version is rejected");
assertThrows(() => decodeGenotype(`${CURRENT_GENETICS_VERSION}.not@base64`), "malformed codec is rejected");
assertThrows(
  () => assertCanonicalGenotype({ geneticsVersion: CURRENT_GENETICS_VERSION, loci: [] }),
  "incorrect locus count is rejected"
);
assertThrows(
  () =>
    assertCanonicalGenotype({
      geneticsVersion: CURRENT_GENETICS_VERSION,
      loci: [[0] as unknown as [number, number], ...createNeutralGenotype().loci.slice(1)],
    }),
  "incorrect allele count is rejected"
);
assertThrows(
  () =>
    assertCanonicalGenotype({
      geneticsVersion: CURRENT_GENETICS_VERSION,
      loci: [[Number.NaN, 0], ...createNeutralGenotype().loci.slice(1)],
    }),
  "non-finite allele is rejected"
);
assertThrows(
  () =>
    assertCanonicalGenotype({
      geneticsVersion: CURRENT_GENETICS_VERSION,
      loci: [[GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX + 0.000001, 0], ...createNeutralGenotype().loci.slice(1)],
    }),
  "out-of-bound allele is rejected"
);

// GEN-03 scaffolding only: this hand-built valid result proves the interface
// can enforce exact legacy phenotype preservation without any population backfill.
assertLegacyGenotypeReconstructionContract({
  request: {
    knownPhenotype: calculatePhenotypeFromGenotype(additiveGenotype),
    deterministicKey: "legacy-dog-fixture-001",
    pedigreeContext: { optional: true },
  },
  result: { genotype: additiveGenotype },
});

console.log("GEN-01 genotype contract tests passed");
