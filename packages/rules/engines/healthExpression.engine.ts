import {
  PHENOTYPE_HEALTH_TESTS,
  type PhenotypeHealthSeverity,
} from "../constants/health.constants";
import {
  TRAIT_IDEAL,
  TRAIT_MAX,
  TRAIT_MIN,
} from "../constants/genetics.constants";
import type { DogTraits } from "./dog.engine";
import {
  isPhenotypeHealthTestCode,
  revealPhenotypeHealthTestResult,
} from "./health.engine";

type HealthExpressionTruth = {
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

type HealthExpressionResult = {
  testTypeCode: string;
  resultCode: string;
};

type HealthExpressionInput = {
  storedTraits: DogTraits;
  phenotypeHealthTruths?: HealthExpressionTruth[];
  phenotypeHealthResults?: HealthExpressionResult[];
};

type HealthExpressionSourceInput = Omit<HealthExpressionInput, "storedTraits">;

export type ThyroidGroomingModifiers = {
  groomingGainMultiplier: number;
  missedGroomingDecayMultiplier: number;
  coatConditionCap: number;
};

export type CardiacLongevityModifiers = {
  ageDeathMultiplier: number;
  ageRelatedDeathRiskMultiplier: number;
};

const HEALTH_EXPRESSION_PENALTY_BY_SEVERITY: Record<
  PhenotypeHealthSeverity,
  number
> = {
  green: 0,
  yellow: 1,
  red: 3,
};

const THYROID_GROOMING_MODIFIERS_BY_SEVERITY: Record<
  PhenotypeHealthSeverity,
  ThyroidGroomingModifiers
> = {
  green: {
    groomingGainMultiplier: 1,
    missedGroomingDecayMultiplier: 1,
    coatConditionCap: TRAIT_MAX,
  },
  yellow: {
    groomingGainMultiplier: 0.6,
    missedGroomingDecayMultiplier: 1.25,
    coatConditionCap: 15,
  },
  red: {
    groomingGainMultiplier: 0.15,
    missedGroomingDecayMultiplier: 1.75,
    coatConditionCap: 9,
  },
};

const CARDIAC_LONGEVITY_MODIFIERS_BY_SEVERITY: Record<
  PhenotypeHealthSeverity,
  CardiacLongevityModifiers
> = {
  green: {
    ageDeathMultiplier: 1,
    ageRelatedDeathRiskMultiplier: 1,
  },
  yellow: {
    ageDeathMultiplier: 0.95,
    ageRelatedDeathRiskMultiplier: 1.15,
  },
  red: {
    ageDeathMultiplier: 0.85,
    ageRelatedDeathRiskMultiplier: 1.5,
  },
};

function clampTrait(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, value));
}

export function pushFartherFromIdeal(value: number, penalty: number): number {
  if (penalty <= 0 || value === TRAIT_IDEAL) {
    return clampTrait(value);
  }

  if (value < TRAIT_IDEAL) {
    return clampTrait(value - penalty);
  }

  return clampTrait(value + penalty);
}

function revealHealthTruths(
  healthTruths: readonly HealthExpressionTruth[] = []
): HealthExpressionResult[] {
  return healthTruths.flatMap((truth) => {
    if (!isPhenotypeHealthTestCode(truth.conditionCode)) {
      return [];
    }

    const result = revealPhenotypeHealthTestResult({
      conditionCode: truth.conditionCode,
      geneticLiability: truth.geneticLiability,
      environmentModifier: truth.environmentModifier,
    });

    return [
      {
        testTypeCode: result.testTypeCode,
        resultCode: result.resultCode,
      },
    ];
  });
}

function getHealthResultsForExpression(input: HealthExpressionSourceInput): HealthExpressionResult[] {
  const truthResults = revealHealthTruths(input.phenotypeHealthTruths);
  const truthCodes = new Set(truthResults.map((result) => result.testTypeCode));
  const fallbackResults = (input.phenotypeHealthResults ?? []).filter(
    (result) => !truthCodes.has(result.testTypeCode)
  );

  return [...truthResults, ...fallbackResults];
}

function getHealthResultSeverity(
  result: HealthExpressionResult
): PhenotypeHealthSeverity | null {
  if (!isPhenotypeHealthTestCode(result.testTypeCode)) {
    return null;
  }

  return (
    PHENOTYPE_HEALTH_TESTS[result.testTypeCode].resultSeverityByCode[
      result.resultCode
    ] ?? null
  );
}

function getHealthExpressionPenalty(
  results: readonly HealthExpressionResult[],
  testTypeCode: string
) {
  const result = results.find(
    (candidate) => candidate.testTypeCode === testTypeCode
  );
  const severity = result ? getHealthResultSeverity(result) : null;

  return severity ? HEALTH_EXPRESSION_PENALTY_BY_SEVERITY[severity] : 0;
}

function getHealthExpressionSeverity(
  results: readonly HealthExpressionResult[],
  testTypeCode: string
): PhenotypeHealthSeverity | null {
  const result = results.find(
    (candidate) => candidate.testTypeCode === testTypeCode
  );

  return result ? getHealthResultSeverity(result) : null;
}

export function deriveThyroidGroomingModifiers(
  input: HealthExpressionSourceInput
): ThyroidGroomingModifiers {
  const severity = getHealthExpressionSeverity(
    getHealthResultsForExpression(input),
    "THYROID"
  );

  return severity
    ? THYROID_GROOMING_MODIFIERS_BY_SEVERITY[severity]
    : THYROID_GROOMING_MODIFIERS_BY_SEVERITY.green;
}

export function deriveCardiacLongevityModifiers(
  input: HealthExpressionSourceInput
): CardiacLongevityModifiers {
  const severity = getHealthExpressionSeverity(
    getHealthResultsForExpression(input),
    "CARDIAC"
  );

  return severity
    ? CARDIAC_LONGEVITY_MODIFIERS_BY_SEVERITY[severity]
    : CARDIAC_LONGEVITY_MODIFIERS_BY_SEVERITY.green;
}

export function deriveHealthAdjustedExpressedTraits(
  input: HealthExpressionInput
): DogTraits {
  const expressedTraits: DogTraits = { ...input.storedTraits };
  const healthResults = getHealthResultsForExpression(input);
  const hipPenalty = getHealthExpressionPenalty(
    healthResults,
    "HIP_DYSPLASIA"
  );
  const elbowPenalty = getHealthExpressionPenalty(
    healthResults,
    "ELBOW_DYSPLASIA"
  );
  const caerPenalty = getHealthExpressionPenalty(
    healthResults,
    "CAER_EYE"
  );

  expressedTraits.hindquarters = pushFartherFromIdeal(
    expressedTraits.hindquarters,
    hipPenalty
  );
  expressedTraits.forequarters = pushFartherFromIdeal(
    expressedTraits.forequarters,
    elbowPenalty
  );
  expressedTraits.temperament = pushFartherFromIdeal(
    expressedTraits.temperament,
    caerPenalty
  );

  return expressedTraits;
}
