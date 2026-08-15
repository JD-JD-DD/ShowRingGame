import {
  CURRENT_GENETICS_VERSION,
  TOTAL_ALLELE_VALUES,
  TOTAL_LOCI,
  assertCanonicalGenotype,
  calculatePhenotypeFromGenotype,
  decodeGenotype,
  formModelDGamete,
  inheritModelDGenotype,
  type CanonicalGenotype,
} from "../src/index";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}
function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}
function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error("test RNG exhausted");
    return values[index++];
  };
}

const sire: CanonicalGenotype = {
  geneticsVersion: CURRENT_GENETICS_VERSION,
  loci: Array.from({ length: TOTAL_LOCI }, (_, index) => [index / 1_000_000, (100 + index) / 1_000_000] as const),
};
const dam: CanonicalGenotype = {
  geneticsVersion: CURRENT_GENETICS_VERSION,
  loci: Array.from({ length: TOTAL_LOCI }, (_, index) => [-(index + 1) / 1_000_000, -(200 + index) / 1_000_000] as const),
};

const gamete = formModelDGamete(sire, sequence(Array.from({ length: TOTAL_LOCI }, (_, index) => index % 2 === 0 ? 0 : 0.999999)));
assertEqual(gamete.length, TOTAL_LOCI, "gamete has forty loci");
assertEqual(gamete[0], sire.loci[0][0], "boundary zero selects first allele");
assertEqual(gamete[1], sire.loci[1][1], "boundary near one selects second allele");
const homozygous: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci: Array.from({ length: TOTAL_LOCI }, () => [0.25, 0.25] as const) };
assertDeepEqual(formModelDGamete(homozygous, sequence(Array.from({ length: TOTAL_LOCI }, () => 0.999999))), Array.from({ length: TOTAL_LOCI }, () => 0.25), "homozygous loci are invariant");

const selections = [
  ...Array.from({ length: TOTAL_LOCI }, (_, index) => index % 2 === 0 ? 0 : 0.999999),
  ...Array.from({ length: TOTAL_LOCI }, () => 0.999999),
];
const noMutation = inheritModelDGenotype({
  sireGenotype: sire,
  damGenotype: dam,
  random01: sequence([...selections, ...Array.from({ length: TOTAL_ALLELE_VALUES }, () => 0)]),
  mutation: { probability: 0, effectMagnitude: 0 },
});
assertEqual(noMutation.genotype.loci.length, TOTAL_LOCI, "puppy has forty loci");
assertEqual(noMutation.genotype.loci.flat().length, TOTAL_ALLELE_VALUES, "puppy has eighty alleles");
assertEqual(noMutation.geneticsVersion, CURRENT_GENETICS_VERSION, "puppy version is canonical");
assertEqual(noMutation.genotype.loci[0][0], sire.loci[0][0], "sire locus selection is independent");
assertEqual(noMutation.genotype.loci[0][1], dam.loci[0][1], "dam locus selection is independent");
assertEqual(noMutation.genotype.loci[1][0], sire.loci[1][1], "adjacent locus segregates independently");
assertCanonicalGenotype(decodeGenotype(noMutation.encodedGenotype));
assertDeepEqual(noMutation.phenotype, calculatePhenotypeFromGenotype(noMutation.genotype), "uses GEN-01 phenotype calculator");

const positiveMutation = inheritModelDGenotype({ sireGenotype: homozygous, damGenotype: homozygous, random01: () => 0.75, mutation: { probability: 1, effectMagnitude: 0.000001 } });
const negativeMutation = inheritModelDGenotype({ sireGenotype: homozygous, damGenotype: homozygous, random01: () => 0.25, mutation: { probability: 1, effectMagnitude: 0.000001 } });
assertEqual(positiveMutation.mutationCount, TOTAL_ALLELE_VALUES, "forced mutation affects individual alleles");
assertEqual(positiveMutation.genotype.loci[0][0], 0.250001, "positive mutation is supported");
assertEqual(negativeMutation.genotype.loci[0][0], 0.249999, "negative mutation is supported");

const neutralContexts = inheritModelDGenotype({ sireGenotype: sire, damGenotype: dam, random01: sequence([...selections, ...Array.from({ length: TOTAL_ALLELE_VALUES }, () => 0)]), mutation: { probability: 0, effectMagnitude: 0 }, breedBackground: { version: "future-neutral" }, coi: { coiPercent: 0 } });
assertEqual(neutralContexts.encodedGenotype, noMutation.encodedGenotype, "future contexts are inert in GEN-04");

const liveBackground = inheritModelDGenotype({
  sireGenotype: homozygous,
  damGenotype: homozygous,
  random01: () => 0,
  mutation: { probability: 0, effectMagnitude: 0 },
  breedBackground: { version: "simulated-annual", sourceStatus: "LIVE", coefficient: 0.02, weightedLocusAlleles: Array.from({ length: TOTAL_LOCI }, () => [0.2, 0.4]), weightedLocusMeans: Array.from({ length: TOTAL_LOCI }, () => 0.3) },
});
assertEqual(liveBackground.genotype.loci[0][0], 0.248, "live background residual remains canonical six-decimal precision");
assertCanonicalGenotype(liveBackground.genotype);

const litter = Array.from({ length: 4 }, (_, puppyIndex) => inheritModelDGenotype({ sireGenotype: sire, damGenotype: dam, random01: sequence([...Array.from({ length: TOTAL_LOCI * 2 }, (_, roll) => (roll + puppyIndex) % 3 === 0 ? 0 : 0.9), ...Array.from({ length: TOTAL_ALLELE_VALUES }, () => 0)]), mutation: { probability: 0, effectMagnitude: 0 } }));
assertEqual(new Set(litter.map((puppy) => puppy.encodedGenotype)).size > 1, true, "littermates can vary");
litter.forEach((puppy) => assertCanonicalGenotype(puppy.genotype));

console.log("GEN-04 polygenic inheritance tests passed");
