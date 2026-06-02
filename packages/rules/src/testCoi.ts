import {
  calculatePedigreeCoi,
  generatePuppyTraits,
  getCoiTraitEffects,
  type DogTraits,
  type PedigreeDog,
} from "../src/index";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function dog(
  id: string,
  sireId: string | null = null,
  damId: string | null = null
): PedigreeDog {
  return { id, sireId, damId };
}

function coiPercent(
  sireId: string,
  damId: string,
  pedigree: PedigreeDog[]
): number {
  return calculatePedigreeCoi({ sireId, damId, pedigree }).coiPercent;
}

const unrelatedFounders = [dog("sire"), dog("dam")];
assertClose(
  coiPercent("sire", "dam", unrelatedFounders),
  0,
  "unrelated founder pairing COI"
);

const parentChild = [dog("sire"), dog("dam"), dog("child", "sire", "dam")];
assertClose(
  coiPercent("sire", "child", parentChild),
  25,
  "parent-child pairing COI"
);

const halfSiblings = [
  dog("shared-sire"),
  dog("dam-a"),
  dog("dam-b"),
  dog("half-a", "shared-sire", "dam-a"),
  dog("half-b", "shared-sire", "dam-b"),
];
assertClose(
  coiPercent("half-a", "half-b", halfSiblings),
  12.5,
  "half-sibling pairing COI"
);

const fullSiblings = [
  dog("shared-sire"),
  dog("shared-dam"),
  dog("full-a", "shared-sire", "shared-dam"),
  dog("full-b", "shared-sire", "shared-dam"),
];
assertClose(
  coiPercent("full-a", "full-b", fullSiblings),
  25,
  "full-sibling pairing COI"
);

const noCoiEffects = getCoiTraitEffects(0);
assertClose(noCoiEffects.faultExpressionRate, 0, "zero COI fault rate");
assertClose(noCoiEffects.varianceScale, 1, "zero COI variance scale");

const moderateCoiEffects = getCoiTraitEffects(25);
assertClose(
  moderateCoiEffects.faultExpressionRate,
  0.06,
  "25 percent COI fault rate"
);
assertClose(
  moderateCoiEffects.varianceScale,
  0.825,
  "25 percent COI variance scale"
);

const highCoiEffects = getCoiTraitEffects(50);
assertClose(highCoiEffects.faultExpressionRate, 0.12, "capped COI fault rate");
assertClose(highCoiEffects.varianceScale, 0.65, "capped COI variance scale");

const parentTraits: DogTraits = {
  head: 9,
  forequarters: 9,
  hindquarters: 9,
  gait: 9,
  coat: 9,
  size: 9,
  temperament: 9,
  show_shine: 9,
  feet: 9,
  topline: 9,
};

const baselineTraits = generatePuppyTraits({
  sireTraits: parentTraits,
  damTraits: parentTraits,
  coiPercent: 0,
  random01: () => 0.5,
});
assertEqual(baselineTraits.head, 9, "baseline inherited head trait");

let noiseIndex = 0;
const highCoiTraits = generatePuppyTraits({
  sireTraits: parentTraits,
  damTraits: parentTraits,
  coiPercent: 25,
  random01: () => {
    const values = [0.5, 0.5, 0.5, 0.5, 0];
    const value = values[noiseIndex % values.length];
    noiseIndex += 1;
    return value;
  },
});
assertEqual(highCoiTraits.head, 8, "COI fault expressed on inherited head trait");

console.log("COI checks passed.");
