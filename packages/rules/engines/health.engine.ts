import {
  PHENOTYPE_HEALTH_TEST_CODES,
  type PhenotypeHealthTestCode,
} from "../constants/health.constants";

export type PhenotypeHealthTruth = {
  conditionCode: PhenotypeHealthTestCode;
  geneticLiability: number;
  environmentModifier: number;
};

export type PhenotypeHealthTestResult = {
  testTypeCode: PhenotypeHealthTestCode;
  resultCode: string;
  resultLabel: string;
  liabilityScore: number;
};

type InheritPhenotypeHealthTruthsInput = {
  sireTruths: PhenotypeHealthTruth[];
  damTruths: PhenotypeHealthTruth[];
  coiPercent?: number | null;
  random01?: () => number;
};

type PhenotypeHealthConditionSettings = {
  foundationLiabilityScale: number;
  environmentMin: number;
  environmentMax: number;
  inheritedVariation: number;
  polygenicRiskEventRate: number;
  polygenicRiskMin: number;
  polygenicRiskMax: number;
};

const PHENOTYPE_HEALTH_CONDITION_SETTINGS: Record<
  PhenotypeHealthTestCode,
  PhenotypeHealthConditionSettings
> = {
  HIP_DYSPLASIA: {
    foundationLiabilityScale: 0.9,
    environmentMin: -0.08,
    environmentMax: 0.15,
    inheritedVariation: 0.2,
    polygenicRiskEventRate: 0.06,
    polygenicRiskMin: 0.15,
    polygenicRiskMax: 0.32,
  },
  CARDIAC: {
    foundationLiabilityScale: 0.9,
    environmentMin: -0.08,
    environmentMax: 0.15,
    inheritedVariation: 0.2,
    polygenicRiskEventRate: 0.045,
    polygenicRiskMin: 0.2,
    polygenicRiskMax: 0.38,
  },
  CAER_EYE: {
    foundationLiabilityScale: 0.94,
    environmentMin: -0.08,
    environmentMax: 0.16,
    inheritedVariation: 0.2,
    polygenicRiskEventRate: 0.05,
    polygenicRiskMin: 0.2,
    polygenicRiskMax: 0.4,
  },
  THYROID: {
    foundationLiabilityScale: 0.94,
    environmentMin: -0.08,
    environmentMax: 0.16,
    inheritedVariation: 0.2,
    polygenicRiskEventRate: 0.045,
    polygenicRiskMin: 0.2,
    polygenicRiskMax: 0.4,
  },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function randomBetween(random01: () => number, min: number, max: number): number {
  return min + (max - min) * random01();
}

function roundScore(value: number): number {
  return Number(value.toFixed(6));
}

function getTruth(
  truths: PhenotypeHealthTruth[],
  conditionCode: PhenotypeHealthTestCode
): PhenotypeHealthTruth {
  const truth = truths.find((candidate) => candidate.conditionCode === conditionCode);

  if (!truth) {
    throw new Error(`Missing hidden health truth for ${conditionCode}.`);
  }

  return truth;
}

export function isPhenotypeHealthTestCode(
  value: string
): value is PhenotypeHealthTestCode {
  return PHENOTYPE_HEALTH_TEST_CODES.includes(value as PhenotypeHealthTestCode);
}

export function generateFoundationPhenotypeHealthTruths(
  random01: () => number = Math.random
): PhenotypeHealthTruth[] {
  return PHENOTYPE_HEALTH_TEST_CODES.map((conditionCode) => {
    const settings = PHENOTYPE_HEALTH_CONDITION_SETTINGS[conditionCode];
    const geneticLiability =
      ((random01() + random01() + random01()) / 3) *
      settings.foundationLiabilityScale;
    const environmentModifier = randomBetween(
      random01,
      settings.environmentMin,
      settings.environmentMax
    );

    return {
      conditionCode,
      geneticLiability: roundScore(clamp01(geneticLiability)),
      environmentModifier: roundScore(environmentModifier),
    };
  });
}

export function inheritPhenotypeHealthTruths(
  input: InheritPhenotypeHealthTruthsInput
): PhenotypeHealthTruth[] {
  const random01 = input.random01 ?? Math.random;
  const coi = clamp01((input.coiPercent ?? 0) / 100);
  const excessCoi = Math.max(0, coi - 0.0625);

  return PHENOTYPE_HEALTH_TEST_CODES.map((conditionCode) => {
    const settings = PHENOTYPE_HEALTH_CONDITION_SETTINGS[conditionCode];
    const sireTruth = getTruth(input.sireTruths, conditionCode);
    const damTruth = getTruth(input.damTruths, conditionCode);
    const inheritedLiability =
      (sireTruth.geneticLiability + damTruth.geneticLiability) / 2;
    const inheritedVariation = randomBetween(
      random01,
      -settings.inheritedVariation,
      settings.inheritedVariation
    );
    const coiPressure = excessCoi * 0.3;
    // A compressed liability score cannot explicitly model every contributing
    // allele. This rare event represents a risky hidden combination resurfacing,
    // rather than a literal single-gene mutation.
    const polygenicRiskPressure =
      random01() < settings.polygenicRiskEventRate
        ? randomBetween(
            random01,
            settings.polygenicRiskMin,
            settings.polygenicRiskMax
          )
        : 0;
    const environmentModifier = randomBetween(
      random01,
      settings.environmentMin,
      settings.environmentMax
    );

    return {
      conditionCode,
      geneticLiability: roundScore(
        clamp01(
          inheritedLiability +
            inheritedVariation +
            coiPressure +
            polygenicRiskPressure
        )
      ),
      environmentModifier: roundScore(environmentModifier),
    };
  });
}

export function revealPhenotypeHealthTestResult(
  truth: PhenotypeHealthTruth
): PhenotypeHealthTestResult {
  const liabilityScore = roundScore(
    clamp01(truth.geneticLiability + truth.environmentModifier)
  );
  let resultCode: string;
  let resultLabel: string;

  switch (truth.conditionCode) {
    case "HIP_DYSPLASIA":
      if (liabilityScore <= 0.18) [resultCode, resultLabel] = ["EXCELLENT", "Excellent"];
      else if (liabilityScore <= 0.32) [resultCode, resultLabel] = ["GOOD", "Good"];
      else if (liabilityScore <= 0.45) [resultCode, resultLabel] = ["FAIR", "Fair"];
      else if (liabilityScore <= 0.55) [resultCode, resultLabel] = ["BORDERLINE", "Borderline"];
      else if (liabilityScore <= 0.68) [resultCode, resultLabel] = ["MILD", "Mild"];
      else if (liabilityScore <= 0.82) [resultCode, resultLabel] = ["MODERATE", "Moderate"];
      else [resultCode, resultLabel] = ["SEVERE", "Severe"];
      break;
    case "CARDIAC":
      if (liabilityScore <= 0.58) [resultCode, resultLabel] = ["NORMAL", "Normal"];
      else if (liabilityScore <= 0.74) [resultCode, resultLabel] = ["EQUIVOCAL", "Equivocal"];
      else [resultCode, resultLabel] = ["ABNORMAL", "Abnormal"];
      break;
    case "CAER_EYE":
      if (liabilityScore <= 0.58) [resultCode, resultLabel] = ["NORMAL", "Normal"];
      else if (liabilityScore <= 0.76) [resultCode, resultLabel] = ["BREEDER_OPTION", "Breeder Option"];
      else [resultCode, resultLabel] = ["NOT_CLEARED", "Not Cleared"];
      break;
    case "THYROID":
      if (liabilityScore <= 0.54) [resultCode, resultLabel] = ["NORMAL", "Normal"];
      else if (liabilityScore <= 0.68) [resultCode, resultLabel] = ["EQUIVOCAL", "Equivocal"];
      else if (liabilityScore <= 0.82) {
        [resultCode, resultLabel] = ["AUTOIMMUNE_THYROIDITIS", "Autoimmune Thyroiditis"];
      } else {
        [resultCode, resultLabel] = ["REDUCED_THYROID_FUNCTION", "Reduced Thyroid Function"];
      }
      break;
  }

  return {
    testTypeCode: truth.conditionCode,
    resultCode,
    resultLabel,
    liabilityScore,
  };
}

export function getPhenotypeHealthResultLabel(
  testTypeCode: PhenotypeHealthTestCode,
  resultCode: string
): string {
  return revealPhenotypeHealthTestResult({
    conditionCode: testTypeCode,
    geneticLiability: resultCodeToLiabilityScore(testTypeCode, resultCode),
    environmentModifier: 0,
  }).resultLabel;
}

function resultCodeToLiabilityScore(
  testTypeCode: PhenotypeHealthTestCode,
  resultCode: string
): number {
  const scores: Record<PhenotypeHealthTestCode, Record<string, number>> = {
    HIP_DYSPLASIA: {
      EXCELLENT: 0.1,
      GOOD: 0.25,
      FAIR: 0.4,
      BORDERLINE: 0.5,
      MILD: 0.62,
      MODERATE: 0.76,
      SEVERE: 0.9,
    },
    CARDIAC: {
      NORMAL: 0.5,
      EQUIVOCAL: 0.7,
      ABNORMAL: 0.9,
    },
    CAER_EYE: {
      NORMAL: 0.5,
      BREEDER_OPTION: 0.72,
      NOT_CLEARED: 0.9,
    },
    THYROID: {
      NORMAL: 0.5,
      EQUIVOCAL: 0.65,
      AUTOIMMUNE_THYROIDITIS: 0.8,
      REDUCED_THYROID_FUNCTION: 0.92,
    },
  };

  return scores[testTypeCode][resultCode] ?? 1;
}
