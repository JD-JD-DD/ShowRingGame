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

const HEALTH_EXPRESSION_PENALTY_BY_SEVERITY: Record<
  PhenotypeHealthSeverity,
  number
> = {
  green: 0,
  yellow: 1,
  red: 3,
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

function getHealthResultsForExpression(
  input: Omit<HealthExpressionInput, "storedTraits">
): HealthExpressionResult[] {
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

function getHipDysplasiaPenalty(results: readonly HealthExpressionResult[]) {
  const hipResult = results.find(
    (result) => result.testTypeCode === "HIP_DYSPLASIA"
  );
  const severity = hipResult ? getHealthResultSeverity(hipResult) : null;

  return severity ? HEALTH_EXPRESSION_PENALTY_BY_SEVERITY[severity] : 0;
}

export function deriveHealthAdjustedExpressedTraits(
  input: HealthExpressionInput
): DogTraits {
  const expressedTraits: DogTraits = { ...input.storedTraits };
  const hipPenalty = getHipDysplasiaPenalty(
    getHealthResultsForExpression(input)
  );

  expressedTraits.hindquarters = pushFartherFromIdeal(
    expressedTraits.hindquarters,
    hipPenalty
  );

  return expressedTraits;
}
