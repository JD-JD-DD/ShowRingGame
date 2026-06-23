import {
  deriveCardiacLongevityModifiers,
  deriveHealthAdjustedExpressedTraits,
  deriveThyroidGroomingModifiers,
  generateFoundationPhenotypeHealthTruths,
  getPhenotypeHealthResultLabel,
  inheritPhenotypeHealthTruths,
  isPhenotypeHealthTestCode,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  pushFartherFromIdeal,
  revealPhenotypeHealthTestResult,
  type DogTraits,
  type PhenotypeHealthTruth,
} from "../src/index";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function truth(
  conditionCode: PhenotypeHealthTruth["conditionCode"],
  geneticLiability: number,
  environmentModifier = 0
): PhenotypeHealthTruth {
  return {
    conditionCode,
    geneticLiability,
    environmentModifier,
  };
}

function testTraits(hindquarters: number, forequarters = 9): DogTraits {
  return {
    head: 8,
    forequarters,
    hindquarters,
    gait: 11,
    coat: 12,
    size: 13,
    temperament: 14,
    show_shine: 15,
    feet: 16,
    topline: 17,
  };
}

assertEqual(
  JSON.stringify(PHENOTYPE_HEALTH_TEST_CODES),
  JSON.stringify([
    "HIP_DYSPLASIA",
    "ELBOW_DYSPLASIA",
    "CARDIAC",
    "CAER_EYE",
    "THYROID",
  ]),
  "supported phenotype health test list"
);
assertEqual(
  isPhenotypeHealthTestCode("ELBOW_DYSPLASIA"),
  true,
  "elbow dysplasia is supported"
);
assertEqual(
  isPhenotypeHealthTestCode("ELBOWS"),
  false,
  "elbows are not currently supported"
);
assertEqual(
  Object.prototype.hasOwnProperty.call(PHENOTYPE_HEALTH_TESTS, "ELBOW_DYSPLASIA"),
  true,
  "elbow dysplasia has a health test definition"
);
assertEqual(
  PHENOTYPE_HEALTH_TESTS.ELBOW_DYSPLASIA.minimumAgeHours,
  PHENOTYPE_HEALTH_TESTS.HIP_DYSPLASIA.minimumAgeHours,
  "elbow dysplasia uses adult orthopedic age eligibility"
);
assertEqual(
  PHENOTYPE_HEALTH_TESTS.ELBOW_DYSPLASIA.fee,
  PHENOTYPE_HEALTH_TESTS.HIP_DYSPLASIA.fee,
  "elbow dysplasia uses orthopedic test fee"
);

const foundationTruths = generateFoundationPhenotypeHealthTruths(() => 0.5);
assertEqual(
  foundationTruths.length,
  PHENOTYPE_HEALTH_TEST_CODES.length,
  "foundation truth count"
);
assertEqual(
  foundationTruths[0].geneticLiability,
  0.45,
  "foundation liability"
);
assertEqual(
  foundationTruths[0].environmentModifier,
  0.035,
  "foundation environmental modifier"
);
assertEqual(
  foundationTruths.some((item) => item.conditionCode === "ELBOW_DYSPLASIA"),
  true,
  "foundation truths include elbow dysplasia"
);

const healthyParentTruths = PHENOTYPE_HEALTH_TEST_CODES.map((conditionCode) =>
  truth(conditionCode, 0.3)
);
const inheritedTruths = inheritPhenotypeHealthTruths({
  sireTruths: healthyParentTruths,
  damTruths: healthyParentTruths,
  coiPercent: 25,
  random01: () => 0.5,
});
assertEqual(
  inheritedTruths[0].geneticLiability,
  0.35625,
  "inherited COI pressure"
);
assertEqual(
  inheritedTruths.some((item) => item.conditionCode === "ELBOW_DYSPLASIA"),
  true,
  "inherited truths include elbow dysplasia"
);

let resurfacingNoiseIndex = 0;
const resurfacedTruths = inheritPhenotypeHealthTruths({
  sireTruths: healthyParentTruths,
  damTruths: healthyParentTruths,
  coiPercent: 0,
  random01: () => {
    const values = [0.5, 0, 0.5, 0.5];
    const value = values[resurfacingNoiseIndex % values.length];
    resurfacingNoiseIndex += 1;
    return value;
  },
});
assertEqual(
  resurfacedTruths[0].geneticLiability,
  0.535,
  "polygenic risk resurfacing"
);

assertEqual(
  revealPhenotypeHealthTestResult(truth("HIP_DYSPLASIA", 0.1)).resultCode,
  "EXCELLENT",
  "excellent hip result"
);
const severeHipTruth = truth("HIP_DYSPLASIA", 0.9);
const severeHipReveal = revealPhenotypeHealthTestResult(severeHipTruth);
assertEqual(severeHipReveal.resultCode, "SEVERE", "severe hip result");
assertEqual(
  severeHipTruth.geneticLiability,
  0.9,
  "revealing a health result does not mutate hidden truth liability"
);
assertEqual(
  severeHipTruth.environmentModifier,
  0,
  "revealing a health result does not mutate hidden truth environment"
);
assertEqual(
  revealPhenotypeHealthTestResult(truth("HIP_DYSPLASIA", 0.7)).resultCode,
  "MODERATE",
  "moderate hip result"
);
assertEqual(
  revealPhenotypeHealthTestResult(truth("ELBOW_DYSPLASIA", 0.1)).resultCode,
  "NORMAL",
  "normal elbow result"
);
assertEqual(
  revealPhenotypeHealthTestResult(truth("ELBOW_DYSPLASIA", 0.5)).resultCode,
  "BORDERLINE",
  "borderline elbow result"
);
assertEqual(
  revealPhenotypeHealthTestResult(truth("ELBOW_DYSPLASIA", 0.9)).resultCode,
  "GRADE_3",
  "grade 3 elbow result"
);
assertEqual(
  revealPhenotypeHealthTestResult(truth("CARDIAC", 0.9)).resultCode,
  "ABNORMAL",
  "abnormal cardiac result"
);
assertEqual(
  revealPhenotypeHealthTestResult(truth("CAER_EYE", 0.7)).resultCode,
  "BREEDER_OPTION",
  "breeder option eye result"
);
assertEqual(
  revealPhenotypeHealthTestResult(truth("THYROID", 0.8)).resultCode,
  "AUTOIMMUNE_THYROIDITIS",
  "autoimmune thyroid result"
);
assertEqual(
  getPhenotypeHealthResultLabel("CAER_EYE", "NOT_CLEARED"),
  "Not Cleared",
  "eye result display label"
);
assertEqual(
  getPhenotypeHealthResultLabel("ELBOW_DYSPLASIA", "GRADE_2"),
  "Grade 2",
  "elbow result display label"
);

assertEqual(pushFartherFromIdeal(7.5, 3), 4.5, "push under ideal");
assertEqual(pushFartherFromIdeal(12.5, 3), 15.5, "push over ideal");
assertEqual(pushFartherFromIdeal(10, 3), 10, "do not push ideal");
assertEqual(pushFartherFromIdeal(1, 3), 0, "push clamps at minimum");
assertEqual(pushFartherFromIdeal(19, 3), 20, "push clamps at maximum");

const greenHipTraits = testTraits(7.5);
const greenHipExpressed = deriveHealthAdjustedExpressedTraits({
  storedTraits: greenHipTraits,
  phenotypeHealthTruths: [truth("HIP_DYSPLASIA", 0.1)],
});
assertEqual(
  greenHipExpressed.hindquarters,
  7.5,
  "green hips do not alter hindquarters"
);

const yellowHipTraits = testTraits(7.5);
const yellowHipExpressed = deriveHealthAdjustedExpressedTraits({
  storedTraits: yellowHipTraits,
  phenotypeHealthTruths: [truth("HIP_DYSPLASIA", 0.5)],
});
assertEqual(
  yellowHipExpressed.hindquarters,
  6.5,
  "yellow hips push hindquarters 1 point farther from ideal"
);

const redHipTraits = testTraits(12.5);
const redHipExpressed = deriveHealthAdjustedExpressedTraits({
  storedTraits: redHipTraits,
  phenotypeHealthTruths: [truth("HIP_DYSPLASIA", 0.9)],
});
assertEqual(
  redHipExpressed.hindquarters,
  15.5,
  "red hips push hindquarters 3 points farther from ideal"
);
assertEqual(
  redHipTraits.hindquarters,
  12.5,
  "stored input hindquarters are not mutated"
);
for (const trait of Object.keys(redHipTraits) as Array<keyof DogTraits>) {
  if (trait === "hindquarters") continue;
  assertEqual(
    redHipExpressed[trait],
    redHipTraits[trait],
    `non-hindquarter trait unchanged: ${trait}`
  );
}

const yellowElbowTraits = testTraits(10, 7.5);
const greenElbowExpressed = deriveHealthAdjustedExpressedTraits({
  storedTraits: yellowElbowTraits,
  phenotypeHealthTruths: [truth("ELBOW_DYSPLASIA", 0.1)],
});
assertEqual(
  greenElbowExpressed.forequarters,
  7.5,
  "green elbows do not alter forequarters"
);

const yellowElbowExpressed = deriveHealthAdjustedExpressedTraits({
  storedTraits: yellowElbowTraits,
  phenotypeHealthTruths: [truth("ELBOW_DYSPLASIA", 0.5)],
});
assertEqual(
  yellowElbowExpressed.forequarters,
  6.5,
  "yellow elbows push forequarters 1 point farther from ideal"
);

const lowRedElbowTraits = testTraits(10, 7.5);
const lowRedElbowExpressed = deriveHealthAdjustedExpressedTraits({
  storedTraits: lowRedElbowTraits,
  phenotypeHealthTruths: [truth("ELBOW_DYSPLASIA", 0.9)],
});
assertEqual(
  lowRedElbowExpressed.forequarters,
  4.5,
  "red elbows below ideal push forequarters lower"
);

const redElbowTraits = testTraits(10, 12.5);
const redElbowExpressed = deriveHealthAdjustedExpressedTraits({
  storedTraits: redElbowTraits,
  phenotypeHealthTruths: [truth("ELBOW_DYSPLASIA", 0.9)],
});
assertEqual(
  redElbowExpressed.forequarters,
  15.5,
  "red elbows above ideal push forequarters higher"
);
assertEqual(
  redElbowTraits.forequarters,
  12.5,
  "stored input forequarters are not mutated"
);
for (const trait of Object.keys(redElbowTraits) as Array<keyof DogTraits>) {
  if (trait === "forequarters") continue;
  assertEqual(
    redElbowExpressed[trait],
    redElbowTraits[trait],
    `non-forequarter trait unchanged for elbow dysplasia: ${trait}`
  );
}

const greenThyroidModifiers = deriveThyroidGroomingModifiers({
  phenotypeHealthTruths: [truth("THYROID", 0.1)],
});
assertEqual(
  greenThyroidModifiers.groomingGainMultiplier,
  1,
  "green thyroid keeps current grooming gain"
);
assertEqual(
  greenThyroidModifiers.missedGroomingDecayMultiplier,
  1,
  "green thyroid keeps current grooming decay"
);
assertEqual(
  greenThyroidModifiers.coatConditionCap,
  20,
  "green thyroid keeps full coat condition cap"
);

const yellowThyroidModifiers = deriveThyroidGroomingModifiers({
  phenotypeHealthTruths: [truth("THYROID", 0.65)],
});
assertEqual(
  yellowThyroidModifiers.groomingGainMultiplier,
  0.6,
  "yellow thyroid reduces grooming gain"
);
assertEqual(
  yellowThyroidModifiers.missedGroomingDecayMultiplier,
  1.25,
  "yellow thyroid increases missed grooming decay"
);
assertEqual(
  yellowThyroidModifiers.coatConditionCap,
  15,
  "yellow thyroid caps coat condition"
);

const redThyroidModifiers = deriveThyroidGroomingModifiers({
  phenotypeHealthTruths: [truth("THYROID", 0.9)],
});
assertEqual(
  redThyroidModifiers.groomingGainMultiplier,
  0.15,
  "red thyroid greatly reduces grooming gain"
);
assertEqual(
  redThyroidModifiers.missedGroomingDecayMultiplier,
  1.75,
  "red thyroid increases missed grooming decay more"
);
assertEqual(
  redThyroidModifiers.coatConditionCap,
  9,
  "red thyroid caps coat condition"
);

const redThyroidTraits = testTraits(10);
const redThyroidExpressed = deriveHealthAdjustedExpressedTraits({
  storedTraits: redThyroidTraits,
  phenotypeHealthTruths: [truth("THYROID", 0.9)],
});
assertEqual(
  redThyroidExpressed.coat,
  redThyroidTraits.coat,
  "thyroid does not mutate or express traitCoat"
);

const greenCardiacModifiers = deriveCardiacLongevityModifiers({
  phenotypeHealthTruths: [truth("CARDIAC", 0.1)],
});
const yellowCardiacModifiers = deriveCardiacLongevityModifiers({
  phenotypeHealthTruths: [truth("CARDIAC", 0.7)],
});
const redCardiacModifiers = deriveCardiacLongevityModifiers({
  phenotypeHealthTruths: [truth("CARDIAC", 0.9)],
});
assertEqual(
  greenCardiacModifiers.ageDeathMultiplier,
  1,
  "green cardiac preserves current longevity"
);
assertEqual(
  redCardiacModifiers.ageRelatedDeathRiskMultiplier >
    yellowCardiacModifiers.ageRelatedDeathRiskMultiplier,
  true,
  "red cardiac risk is greater than yellow cardiac risk"
);
assertEqual(
  yellowCardiacModifiers.ageRelatedDeathRiskMultiplier >
    greenCardiacModifiers.ageRelatedDeathRiskMultiplier,
  true,
  "yellow cardiac risk is greater than green cardiac risk"
);

const redCardiacTraits = testTraits(10);
const redCardiacExpressed = deriveHealthAdjustedExpressedTraits({
  storedTraits: redCardiacTraits,
  phenotypeHealthTruths: [truth("CARDIAC", 0.9)],
});
for (const trait of Object.keys(redCardiacTraits) as Array<keyof DogTraits>) {
  assertEqual(
    redCardiacExpressed[trait],
    redCardiacTraits[trait],
    `cardiac does not alter expressed traits: ${trait}`
  );
}

console.log("Health checks passed.");
