import type { Prisma } from "@prisma/client";
import {
  BREED_WEIGHTED_JUDGING_SCORING_VERSION,
  FIXED_CONFORMATION_BUDGET,
  GENETIC_JUDGING_CATEGORIES,
  JUDGING_CATEGORIES,
  type JudgedEntryResult,
  type Judge,
} from "@showring/rules";

const AUDIT_VERSION = "breed-judging-audit-v1" as const;
const BUDGET_TOLERANCE = 1e-9;

export type BreedJudgingResultAudit = {
  auditVersion: typeof AUDIT_VERSION;
  effectiveCategoryWeights: Record<(typeof JUDGING_CATEGORIES)[number], number>;
  characteristics: JudgedEntryResult["characteristics"];
  realizedRandomness: {
    dogDayAdjustment: number;
    ringRandomnessAdjustment: number;
    tieBreakRoll: number;
  };
};

export type BreedWeightedResultAuditInput = {
  scoringVersion: typeof BREED_WEIGHTED_JUDGING_SCORING_VERSION;
  breedJudgingProfileId: string;
  breedJudgingRulesVersion: string;
  audit: BreedJudgingResultAudit;
};

function requireFiniteNonnegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite and >= 0.`);
  }
}

/** Validates only the JUDGE-05 contract for new breed-weighted result records. */
export function validateBreedWeightedResultAudit(input: BreedWeightedResultAuditInput) {
  if (input.scoringVersion !== BREED_WEIGHTED_JUDGING_SCORING_VERSION) {
    throw new Error(`Unexpected breed-weighted scoring version ${input.scoringVersion}.`);
  }
  if (!input.breedJudgingProfileId || !input.breedJudgingRulesVersion) {
    throw new Error("Breed-weighted result audit requires profile ID and rules version.");
  }
  if (input.audit.auditVersion !== AUDIT_VERSION) {
    throw new Error(`Unexpected breed judging audit version ${input.audit.auditVersion}.`);
  }
  let conformationTotal = 0;
  for (const category of JUDGING_CATEGORIES) {
    requireFiniteNonnegative(input.audit.effectiveCategoryWeights[category], `Effective ${category} weight`);
    requireFiniteNonnegative(input.audit.characteristics[category], `Characteristic ${category}`);
    if (category !== "CONDITIONING_HANDLING") {
      conformationTotal += input.audit.effectiveCategoryWeights[category];
    }
  }
  if (Math.abs(conformationTotal - FIXED_CONFORMATION_BUDGET) > BUDGET_TOLERANCE) {
    throw new Error(`Effective conformation weights total ${conformationTotal}; expected ${FIXED_CONFORMATION_BUDGET}.`);
  }
  for (const [key, value] of Object.entries(input.audit.realizedRandomness)) {
    if (!Number.isFinite(value)) throw new Error(`Realized randomness ${key} must be finite.`);
  }
  if (input.audit.realizedRandomness.tieBreakRoll < 0 || input.audit.realizedRandomness.tieBreakRoll > 1) {
    throw new Error("Realized tie-break roll must be within [0, 1].");
  }
}

export function createBreedJudgingResultAudit(args: {
  effectiveConformationWeights: Record<(typeof GENETIC_JUDGING_CATEGORIES)[number], number>;
  judge: Judge;
  result: JudgedEntryResult;
}): BreedJudgingResultAudit {
  const audit: BreedJudgingResultAudit = {
    auditVersion: AUDIT_VERSION,
    effectiveCategoryWeights: {
      ...args.effectiveConformationWeights,
      CONDITIONING_HANDLING: args.judge.categoryWeights.CONDITIONING_HANDLING,
    },
    characteristics: args.result.characteristics,
    realizedRandomness: {
      dogDayAdjustment: args.result.dogDayAdjustment,
      ringRandomnessAdjustment: args.result.ringRandomnessAdjustment,
      tieBreakRoll: args.result.tieBreakRoll,
    },
  };
  validateBreedWeightedResultAudit({
    scoringVersion: BREED_WEIGHTED_JUDGING_SCORING_VERSION,
    breedJudgingProfileId: "validation-only",
    breedJudgingRulesVersion: "validation-only",
    audit,
  });
  return audit;
}

export type PersistedJudgingAudit =
  | { kind: "LEGACY" }
  | { kind: "BREED_WEIGHTED_V1"; profileId: string; rulesVersion: string; audit: BreedJudgingResultAudit };

/** Reads only the immutable result-time snapshot; it never consults active profiles. */
export function readPersistedJudgingAudit(result: {
  scoringVersion: string;
  breedJudgingProfileId: string | null;
  breedJudgingRulesVersion: string | null;
  breedJudgingAudit: Prisma.JsonValue | null;
}): PersistedJudgingAudit {
  if (!result.breedJudgingAudit && !result.breedJudgingProfileId && !result.breedJudgingRulesVersion) return { kind: "LEGACY" };
  if (!result.breedJudgingAudit || !result.breedJudgingProfileId || !result.breedJudgingRulesVersion) {
    throw new Error("Incomplete persisted breed judging audit snapshot.");
  }
  const audit = result.breedJudgingAudit as unknown as BreedJudgingResultAudit;
  validateBreedWeightedResultAudit({
    scoringVersion: result.scoringVersion as typeof BREED_WEIGHTED_JUDGING_SCORING_VERSION,
    breedJudgingProfileId: result.breedJudgingProfileId,
    breedJudgingRulesVersion: result.breedJudgingRulesVersion,
    audit,
  });
  return { kind: "BREED_WEIGHTED_V1", profileId: result.breedJudgingProfileId, rulesVersion: result.breedJudgingRulesVersion, audit };
}

/** Internal diagnostics helper. It resolves only the immutable ShowResult snapshot. */
export async function getJudgingAuditForResult(args: {
  client: Pick<Prisma.TransactionClient, "showResult">;
  resultId: string;
}): Promise<PersistedJudgingAudit> {
  const result = await args.client.showResult.findUnique({
    where: { id: args.resultId },
    select: {
      scoringVersion: true,
      breedJudgingProfileId: true,
      breedJudgingRulesVersion: true,
      breedJudgingAudit: true,
    },
  });
  if (!result) throw new Error(`Show result ${args.resultId} was not found.`);
  return readPersistedJudgingAudit(result);
}
