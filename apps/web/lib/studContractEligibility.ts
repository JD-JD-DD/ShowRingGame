import {
  PHENOTYPE_HEALTH_TESTS,
  type StudHealthRequirementLevel,
  type StudTitleRequirement,
} from "@showring/rules";
import {
  getChampionOfRecordTitleLevel,
  type ChampionOfRecordDogLike,
} from "./dogTitles";
import { getPhenotypeHealthSeverity } from "./dogHealth";

type HealthResult = {
  healthTestCode: string;
  resultCode: string;
  testedAtEpoch: number | null;
  createdAtEpoch: number;
  id?: string;
};

export type StudContractRequirementSnapshot = {
  brucellosisNegativeRequired: boolean;
  healthRequirements: Array<{
    healthTestCode: string;
    requirementLevel: StudHealthRequirementLevel;
  }>;
  titleRequirement: StudTitleRequirement;
};

export type StudContractEligibilityFailureCode =
  | "BRUCELLOSIS_NEGATIVE_REQUIRED"
  | "HEALTH_RESULT_REQUIRED"
  | "HEALTH_GREEN_OR_YELLOW_REQUIRED"
  | "HEALTH_GREEN_ONLY_REQUIRED"
  | "TITLE_CH_OR_HIGHER_REQUIRED"
  | "TITLE_GCH_OR_HIGHER_REQUIRED";

export type StudContractDamFacts = {
  hasValidNegativeBrucellosis: boolean;
  healthResults: HealthResult[];
  titleDog: ChampionOfRecordDogLike;
};

function currentHealthResult(
  healthResults: HealthResult[],
  healthTestCode: string
): HealthResult | null {
  return healthResults
    .filter((result) => result.healthTestCode === healthTestCode)
    .sort((left, right) =>
      (right.testedAtEpoch ?? -1) - (left.testedAtEpoch ?? -1) ||
      right.createdAtEpoch - left.createdAtEpoch ||
      (right.id ?? "").localeCompare(left.id ?? "")
    )[0] ?? null;
}

function healthFailure(
  requirementLevel: StudHealthRequirementLevel,
  hasCurrentResult: boolean,
  severity: "green" | "yellow" | "red" | null
): StudContractEligibilityFailureCode | null {
  if (requirementLevel === "NONE") return null;
  if (!hasCurrentResult) return "HEALTH_RESULT_REQUIRED";
  if (requirementLevel === "GREEN_OR_YELLOW") {
    return severity === "green" || severity === "yellow"
      ? null
      : "HEALTH_GREEN_OR_YELLOW_REQUIRED";
  }
  return severity === "green" ? null : "HEALTH_GREEN_ONLY_REQUIRED";
}

export function evaluateDamAgainstStudContractRequirements(
  requirements: StudContractRequirementSnapshot,
  dam: StudContractDamFacts
) {
  const brucellosisFailure = requirements.brucellosisNegativeRequired &&
    !dam.hasValidNegativeBrucellosis
      ? "BRUCELLOSIS_NEGATIVE_REQUIRED" as const
      : null;
  const health = requirements.healthRequirements.map((requirement) => {
    const currentResult = currentHealthResult(
      dam.healthResults,
      requirement.healthTestCode
    );
    const severity = currentResult
      ? getPhenotypeHealthSeverity(
          requirement.healthTestCode,
          currentResult.resultCode
        )
      : null;
    const failureCode = healthFailure(
      requirement.requirementLevel,
      currentResult !== null,
      severity
    );
    const label =
      PHENOTYPE_HEALTH_TESTS[
        requirement.healthTestCode as keyof typeof PHENOTYPE_HEALTH_TESTS
      ]?.label ?? requirement.healthTestCode;
    const message = failureCode === null
      ? null
      : failureCode === "HEALTH_GREEN_ONLY_REQUIRED"
        ? `${label} requires a completed Green result.`
        : failureCode === "HEALTH_GREEN_OR_YELLOW_REQUIRED"
          ? `${label} requires a completed Green or Yellow result.`
          : `${label} requires a completed result.`;
    return {
      healthTestCode: requirement.healthTestCode,
      healthTestLabel: label,
      requirementLevel: requirement.requirementLevel,
      currentResult: currentResult
        ? { resultCode: currentResult.resultCode, severity }
        : null,
      eligible: failureCode === null,
      failureCode,
      message,
    };
  });
  const titleLevel = getChampionOfRecordTitleLevel(dam.titleDog);
  const titleFailure = requirements.titleRequirement === "CH_OR_HIGHER" &&
      titleLevel === "NONE"
    ? "TITLE_CH_OR_HIGHER_REQUIRED" as const
    : requirements.titleRequirement === "GCH_OR_HIGHER" &&
        titleLevel !== "GCH_OR_HIGHER"
      ? "TITLE_GCH_OR_HIGHER_REQUIRED" as const
      : null;

  return {
    eligible: brucellosisFailure === null &&
      health.every((result) => result.eligible) &&
      titleFailure === null,
    brucellosis: {
      required: requirements.brucellosisNegativeRequired,
      hasValidNegative: dam.hasValidNegativeBrucellosis,
      eligible: brucellosisFailure === null,
      failureCode: brucellosisFailure,
      message: brucellosisFailure
        ? "This dam needs a current negative brucellosis result."
        : null,
    },
    health,
    title: {
      requirement: requirements.titleRequirement,
      currentLevel: titleLevel,
      eligible: titleFailure === null,
      failureCode: titleFailure,
      message: titleFailure === "TITLE_CH_OR_HIGHER_REQUIRED"
        ? "This dam must hold CH or a qualifying higher championship title."
        : titleFailure === "TITLE_GCH_OR_HIGHER_REQUIRED"
          ? "This dam must hold GCH or a qualifying higher Grand Championship title."
          : null,
    },
  };
}
