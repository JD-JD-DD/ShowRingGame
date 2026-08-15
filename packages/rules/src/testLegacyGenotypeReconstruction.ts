import {
  CURRENT_GENETICS_VERSION,
  assertStoredLegacyGenotype,
  calculatePhenotypeFromGenotype,
  createNeutralGenotype,
  encodeGenotype,
  reconstructLegacyGenotype,
  type DogTraits,
} from "../src/index";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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

const phenotype: DogTraits = {
  head: 10,
  forequarters: 9,
  hindquarters: 11,
  gait: 9.421357,
  coat: 0,
  size: 20,
  temperament: 8.125,
  show_shine: 11.875432,
  feet: 10.000001,
  topline: 10,
};

const root = reconstructLegacyGenotype({
  deterministicKey: "root-a:SRG-A-0001",
  knownPhenotype: phenotype,
});
assertEqual(root.geneticsVersion, CURRENT_GENETICS_VERSION, "reconstruction version");
assertDeepEqual(calculatePhenotypeFromGenotype(root), phenotype, "exact root phenotype reproduction");
assertEqual(
  encodeGenotype(reconstructLegacyGenotype({ deterministicKey: "root-a:SRG-A-0001", knownPhenotype: phenotype })),
  encodeGenotype(root),
  "same context is byte-for-byte deterministic"
);

const unrelated = reconstructLegacyGenotype({
  deterministicKey: "root-b:SRG-B-0001",
  knownPhenotype: phenotype,
});
assertEqual(encodeGenotype(root) === encodeGenotype(unrelated), false, "unrelated equal-phenotype dogs vary");
assertDeepEqual(calculatePhenotypeFromGenotype(unrelated), phenotype, "unrelated phenotype remains exact");

const sire = reconstructLegacyGenotype({ deterministicKey: "sire", knownPhenotype: phenotype });
const dam = reconstructLegacyGenotype({ deterministicKey: "dam", knownPhenotype: { ...phenotype, head: 9.5 } });
const childWithBoth = reconstructLegacyGenotype({
  deterministicKey: "child",
  knownPhenotype: phenotype,
  parents: { sire, dam },
});
const childSireOnly = reconstructLegacyGenotype({
  deterministicKey: "child",
  knownPhenotype: phenotype,
  parents: { sire },
});
const childDamOnly = reconstructLegacyGenotype({
  deterministicKey: "child",
  knownPhenotype: phenotype,
  parents: { dam },
});
const childNoParents = reconstructLegacyGenotype({ deterministicKey: "child", knownPhenotype: phenotype });
for (const child of [childWithBoth, childSireOnly, childDamOnly, childNoParents]) {
  assertDeepEqual(calculatePhenotypeFromGenotype(child), phenotype, "pedigree variant keeps phenotype exact");
}
assertEqual(encodeGenotype(childWithBoth) === encodeGenotype(childNoParents), false, "parents influence latent arrangement");
assertEqual(encodeGenotype(childSireOnly) === encodeGenotype(childDamOnly), false, "partial parent context influences arrangement");

const sibling = reconstructLegacyGenotype({
  deterministicKey: "sibling",
  knownPhenotype: phenotype,
  parents: { sire, dam },
});
assertEqual(encodeGenotype(sibling) === encodeGenotype(childWithBoth), false, "same-phenotype littermates vary");

const encoded = encodeGenotype(root);
assertEqual(
  encodeGenotype(assertStoredLegacyGenotype({
    genotype: encoded,
    geneticsVersion: CURRENT_GENETICS_VERSION,
    knownPhenotype: phenotype,
    deterministicKey: "root-a:SRG-A-0001",
  })),
  encoded,
  "valid stored genotype is idempotently preserved"
);
assertThrows(
  () => assertStoredLegacyGenotype({ genotype: encoded, geneticsVersion: CURRENT_GENETICS_VERSION, knownPhenotype: { ...phenotype, head: 9 }, deterministicKey: "root-a:SRG-A-0001" }),
  "mismatched stored genotype is rejected"
);
assertThrows(
  () => assertStoredLegacyGenotype({ genotype: encodeGenotype(createNeutralGenotype()), geneticsVersion: "other-version", knownPhenotype: phenotype, deterministicKey: "root-a:SRG-A-0001" }),
  "unsupported stored version is rejected"
);

console.log("GEN-03 legacy genotype reconstruction tests passed");
