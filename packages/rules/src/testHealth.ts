import {
  generateFoundationPhenotypeHealthTruths,
  getPhenotypeHealthResultLabel,
  inheritPhenotypeHealthTruths,
  PHENOTYPE_HEALTH_TEST_CODES,
  revealPhenotypeHealthTestResult,
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
assertEqual(
  revealPhenotypeHealthTestResult(truth("HIP_DYSPLASIA", 0.7)).resultCode,
  "MODERATE",
  "moderate hip result"
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

console.log("Health checks passed.");
