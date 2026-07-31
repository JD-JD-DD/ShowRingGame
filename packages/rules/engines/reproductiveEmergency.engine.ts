import {
  REPRODUCTIVE_EMERGENCY_EXTENDED_RECOVERY_HOURS,
  REPRODUCTIVE_EMERGENCY_RULESET_VERSION,
  REPRODUCTIVE_EMERGENCY_TRIGGER_RATE,
} from "../constants/lifecycle.constants";
import { seeded01 } from "../src/seededRandom";

export type ReproductiveDamOutcome = "SURVIVED" | "DIED";
export type ReproductivePuppyOutcome =
  | "ALL_SURVIVED"
  | "PARTIAL_SURVIVAL"
  | "NONE_SURVIVED";
export type ReproductiveConsequence =
  | "NONE"
  | "EXTENDED_RECOVERY"
  | "PERMANENT_BREEDING_RESTRICTION";
export type ReproductivePuppySurvivalBand =
  | "ALL_SURVIVE"
  | "MOST_SURVIVE"
  | "FEW_SURVIVE"
  | "NONE_SURVIVE";

type PuppySurvivalProbabilities = Readonly<{
  allSurvive: number;
  mostSurvive: number;
  fewSurvive: number;
  noneSurvive: number;
}>;

type ReproductiveConsequenceProbabilities = Readonly<{
  none: number;
  extendedRecovery: number;
  permanentBreedingRestriction: number;
}>;

export type ReproductiveEmergencyProbabilities = Readonly<{
  damSurvivalRate: number;
  puppySurvival: PuppySurvivalProbabilities;
  reproductiveConsequence: ReproductiveConsequenceProbabilities;
}>;

export type ReproductiveEmergencyTriggerResult = Readonly<{
  triggered: boolean;
  triggerRoll: number;
  triggerRate: number;
  rulesetVersion: string;
}>;

export type ReproductiveEmergencyOutcomeResult = Readonly<{
  damOutcome: ReproductiveDamOutcome;
  survivingPuppyCount: number;
  puppyOutcome: ReproductivePuppyOutcome;
  puppySurvivalBand: ReproductivePuppySurvivalBand;
  reproductiveConsequence: ReproductiveConsequence;
  recoveryHours: number;
  rolls: Readonly<{
    damSurvivalRoll: number;
    puppyOutcomeRoll: number;
    puppyCountRoll: number;
    reproductiveConsequenceRoll: number;
  }>;
  probabilities: ReproductiveEmergencyProbabilities;
  treatmentAuthorized: boolean;
  intendedPuppyCount: number;
  rulesetVersion: string;
}>;

const TREATED_PUPPY_SURVIVAL: PuppySurvivalProbabilities = {
  allSurvive: 0.45,
  mostSurvive: 0.35,
  fewSurvive: 0.15,
  noneSurvive: 0.05,
};

const UNTREATED_PUPPY_SURVIVAL: PuppySurvivalProbabilities = {
  allSurvive: 0.03,
  mostSurvive: 0.17,
  fewSurvive: 0.25,
  noneSurvive: 0.55,
};

const TREATED_CONSEQUENCES: ReproductiveConsequenceProbabilities = {
  none: 0.8,
  extendedRecovery: 0.15,
  permanentBreedingRestriction: 0.05,
};

const UNTREATED_CONSEQUENCES: ReproductiveConsequenceProbabilities = {
  none: 0.35,
  extendedRecovery: 0.35,
  permanentBreedingRestriction: 0.3,
};

function assertRngSeed(rngSeed: number): void {
  if (!Number.isFinite(rngSeed) || !Number.isInteger(rngSeed)) {
    throw new Error("rngSeed must be a finite integer.");
  }
}

function assertRulesetVersion(rulesetVersion: string): void {
  if (rulesetVersion !== REPRODUCTIVE_EMERGENCY_RULESET_VERSION) {
    throw new Error(`Unsupported reproductive emergency ruleset: ${rulesetVersion}.`);
  }
}

function assertIntendedPuppyCount(intendedPuppyCount: number): void {
  if (!Number.isInteger(intendedPuppyCount) || intendedPuppyCount < 1) {
    throw new Error("intendedPuppyCount must be an integer of at least 1.");
  }
}

function selectPuppySurvivalBand(
  roll: number,
  probabilities: PuppySurvivalProbabilities
): ReproductivePuppySurvivalBand {
  if (roll < probabilities.allSurvive) return "ALL_SURVIVE";
  if (roll < probabilities.allSurvive + probabilities.mostSurvive) {
    return "MOST_SURVIVE";
  }
  if (
    roll <
    probabilities.allSurvive + probabilities.mostSurvive + probabilities.fewSurvive
  ) {
    return "FEW_SURVIVE";
  }
  return "NONE_SURVIVE";
}

function selectInclusiveInteger(roll: number, minimum: number, maximum: number): number {
  return minimum + Math.floor(roll * (maximum - minimum + 1));
}

function resolveSurvivingPuppyCount(args: {
  intendedPuppyCount: number;
  puppySurvivalBand: ReproductivePuppySurvivalBand;
  puppyCountRoll: number;
}): number {
  const { intendedPuppyCount, puppySurvivalBand, puppyCountRoll } = args;

  switch (puppySurvivalBand) {
    case "ALL_SURVIVE":
      return intendedPuppyCount;
    case "NONE_SURVIVE":
      return 0;
    case "MOST_SURVIVE": {
      if (intendedPuppyCount === 1) return 1;
      const maximum = intendedPuppyCount - 1;
      const minimum = Math.min(Math.ceil(intendedPuppyCount * 0.6), maximum);
      return selectInclusiveInteger(puppyCountRoll, minimum, maximum);
    }
    case "FEW_SURVIVE":
      if (intendedPuppyCount === 1) return 1;
      return selectInclusiveInteger(
        puppyCountRoll,
        1,
        Math.max(1, Math.floor(intendedPuppyCount * 0.5))
      );
  }
}

function mapPuppyOutcome(
  survivingPuppyCount: number,
  intendedPuppyCount: number
): ReproductivePuppyOutcome {
  if (survivingPuppyCount === intendedPuppyCount) return "ALL_SURVIVED";
  if (survivingPuppyCount === 0) return "NONE_SURVIVED";
  return "PARTIAL_SURVIVAL";
}

function selectConsequence(
  roll: number,
  probabilities: ReproductiveConsequenceProbabilities
): ReproductiveConsequence {
  if (roll < probabilities.none) return "NONE";
  if (roll < probabilities.none + probabilities.extendedRecovery) {
    return "EXTENDED_RECOVERY";
  }
  return "PERMANENT_BREEDING_RESTRICTION";
}

export function shouldTriggerReproductiveEmergency(args: {
  rngSeed: number;
  rulesetVersion?: string;
}): ReproductiveEmergencyTriggerResult {
  const rulesetVersion =
    args.rulesetVersion ?? REPRODUCTIVE_EMERGENCY_RULESET_VERSION;
  assertRngSeed(args.rngSeed);
  assertRulesetVersion(rulesetVersion);

  const triggerRoll = seeded01(
    `${args.rngSeed}:reproductive-emergency:trigger`
  );

  return {
    triggered: triggerRoll < REPRODUCTIVE_EMERGENCY_TRIGGER_RATE,
    triggerRoll,
    triggerRate: REPRODUCTIVE_EMERGENCY_TRIGGER_RATE,
    rulesetVersion,
  };
}

export function resolveReproductiveEmergencyOutcome(args: {
  rngSeed: number;
  treatmentAuthorized: boolean;
  intendedPuppyCount: number;
  rulesetVersion?: string;
}): ReproductiveEmergencyOutcomeResult {
  const rulesetVersion =
    args.rulesetVersion ?? REPRODUCTIVE_EMERGENCY_RULESET_VERSION;
  assertRngSeed(args.rngSeed);
  assertIntendedPuppyCount(args.intendedPuppyCount);
  assertRulesetVersion(rulesetVersion);

  const damSurvivalRoll = seeded01(`${args.rngSeed}:reproductive-emergency:dam`);
  const puppyOutcomeRoll = seeded01(`${args.rngSeed}:reproductive-emergency:puppies`);
  const puppyCountRoll = seeded01(
    `${args.rngSeed}:reproductive-emergency:puppy-count`
  );
  const reproductiveConsequenceRoll = seeded01(
    `${args.rngSeed}:reproductive-emergency:consequence`
  );
  const damSurvivalRate = args.treatmentAuthorized ? 0.97 : 0.1;
  const puppySurvival = args.treatmentAuthorized
    ? TREATED_PUPPY_SURVIVAL
    : UNTREATED_PUPPY_SURVIVAL;
  const reproductiveConsequence = args.treatmentAuthorized
    ? TREATED_CONSEQUENCES
    : UNTREATED_CONSEQUENCES;
  const probabilities = {
    damSurvivalRate,
    puppySurvival,
    reproductiveConsequence,
  };
  const damOutcome: ReproductiveDamOutcome =
    damSurvivalRoll < damSurvivalRate ? "SURVIVED" : "DIED";
  const puppySurvivalBand = selectPuppySurvivalBand(
    puppyOutcomeRoll,
    puppySurvival
  );
  const survivingPuppyCount = resolveSurvivingPuppyCount({
    intendedPuppyCount: args.intendedPuppyCount,
    puppySurvivalBand,
    puppyCountRoll,
  });
  const consequence =
    damOutcome === "DIED"
      ? "NONE"
      : selectConsequence(reproductiveConsequenceRoll, reproductiveConsequence);

  return {
    damOutcome,
    survivingPuppyCount,
    puppyOutcome: mapPuppyOutcome(
      survivingPuppyCount,
      args.intendedPuppyCount
    ),
    puppySurvivalBand,
    reproductiveConsequence: consequence,
    recoveryHours:
      consequence === "EXTENDED_RECOVERY"
        ? REPRODUCTIVE_EMERGENCY_EXTENDED_RECOVERY_HOURS
        : 0,
    rolls: {
      damSurvivalRoll,
      puppyOutcomeRoll,
      puppyCountRoll,
      reproductiveConsequenceRoll,
    },
    probabilities,
    treatmentAuthorized: args.treatmentAuthorized,
    intendedPuppyCount: args.intendedPuppyCount,
    rulesetVersion,
  };
}
