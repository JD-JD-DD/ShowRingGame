import {
  DAM_MAX_BREED_AGE_HOURS,
  GESTATION_HOURS,
  MIN_BREED_AGE_HOURS,
  PREG_CHECK_HOURS,
  WHELPING_COOLDOWN_HOURS,
} from "../constants/lifecycle.constants";
import { ageHours } from "../src/time";
import type { DogStatus, Sex } from "../src/lifecycle";
import { createLitter, type LitterWithDogs } from "./litter.engine";
import type { Dog } from "./dog.engine";

export type BreedingAttemptStatus =
  | "INITIATED"
  | "CHECKED_NOT_PREGNANT"
  | "PREGNANT"
  | "WHELPED"
  | "FAILED";

export type PregnancyState = "NOT_PREGNANT" | "PREGNANT" | "POST_WHELP";

export type BreedingDog = {
  dogId: string;
  breedCode2: string;
  birthEpoch: number;
  sex: Sex;
  status: DogStatus;
};

export type BreedingAttempt = {
  attemptId: string;
  sireId: string;
  damId: string;
  breedCode2: string;
  createdEpoch: number;
  pregCheckEpoch: number;
  dueEpoch: number;
  checkedEpoch: number | null;
  isPregnant: boolean | null;
  whelpedEpoch: number | null;
  litterId: string | null;
  rngSeed: number;
  status: BreedingAttemptStatus;
};

export type DamReproUpdate = {
  isPregnant: boolean;
  whelpingCooldownUntil: number | null;
};

export type ValidationResult = {
  ok: boolean;
  reasons: string[];
};

export type CreateBreedingAttemptInput = {
  attemptId: string;
  currentEpoch: number;
  sire: BreedingDog;
  dam: BreedingDog;
  rngSeed: number;
  damIsPregnant?: boolean;
  damCooldownUntil?: number | null;
};

export type PregnancyCheckInput = {
  attempt: BreedingAttempt;
  currentEpoch: number;
  conceptionRate: number;
  conceptionRoll: number;
};

export type ResolveWhelpInput = {
  attempt: BreedingAttempt;
  currentEpoch: number;
  litterId: string;
  pupCount: number;
  puppySexes: Sex[];
  puppyDogIds: string[];
  random01?: () => number;
};

export type WhelpOutcome = {
  attempt: BreedingAttempt;
  litter: LitterWithDogs["litter"];
  puppies: Dog[];
  damReproUpdate: DamReproUpdate;
};

function assertFiniteInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be a finite integer.`);
  }
}

function assertRoll(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`${label} must be >= 0 and < 1.`);
  }
}

export function canBreedSire(currentEpoch: number, sire: BreedingDog): boolean {
  if (sire.sex !== "M") return false;
  if (sire.status !== "ALIVE") return false;

  const age = ageHours(currentEpoch, sire.birthEpoch);
  return age >= MIN_BREED_AGE_HOURS;
}

export function canBreedDam(
  currentEpoch: number,
  dam: BreedingDog,
  options: {
    isPregnant?: boolean;
    cooldownUntil?: number | null;
  } = {}
): boolean {
  if (dam.sex !== "F") return false;
  if (dam.status !== "ALIVE") return false;
  if (options.isPregnant === true) return false;
  if (
    options.cooldownUntil != null &&
    Number.isFinite(options.cooldownUntil) &&
    currentEpoch < options.cooldownUntil
  ) {
    return false;
  }

  const age = ageHours(currentEpoch, dam.birthEpoch);
  return age >= MIN_BREED_AGE_HOURS && age <= DAM_MAX_BREED_AGE_HOURS;
}

export function validateBreedingPair(
  currentEpoch: number,
  sire: BreedingDog,
  dam: BreedingDog,
  options: {
    damIsPregnant?: boolean;
    damCooldownUntil?: number | null;
  } = {}
): ValidationResult {
  const reasons: string[] = [];

  if (sire.dogId === dam.dogId) {
    reasons.push("Sire and dam cannot be the same dog.");
  }

  if (sire.breedCode2 !== dam.breedCode2) {
    reasons.push("Cross-breed breeding is not allowed in v1.");
  }

  if (!canBreedSire(currentEpoch, sire)) {
    reasons.push("Sire is not eligible to breed.");
  }

  if (
    !canBreedDam(currentEpoch, dam, {
      isPregnant: options.damIsPregnant,
      cooldownUntil: options.damCooldownUntil,
    })
  ) {
    reasons.push("Dam is not eligible to breed.");
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function createBreedingAttempt(
  input: CreateBreedingAttemptInput
): BreedingAttempt {
  const {
    attemptId,
    currentEpoch,
    sire,
    dam,
    rngSeed,
    damIsPregnant,
    damCooldownUntil,
  } = input;

  assertFiniteInteger(currentEpoch, "currentEpoch");

  const validation = validateBreedingPair(currentEpoch, sire, dam, {
    damIsPregnant,
    damCooldownUntil,
  });

  if (!validation.ok) {
    throw new Error(
      `Cannot create breeding attempt: ${validation.reasons.join(" ")}`
    );
  }

  return {
    attemptId,
    sireId: sire.dogId,
    damId: dam.dogId,
    breedCode2: sire.breedCode2,
    createdEpoch: currentEpoch,
    pregCheckEpoch: currentEpoch + PREG_CHECK_HOURS,
    dueEpoch: currentEpoch + GESTATION_HOURS,
    checkedEpoch: null,
    isPregnant: null,
    whelpedEpoch: null,
    litterId: null,
    rngSeed,
    status: "INITIATED",
  };
}

export function resolvePregnancyCheck(
  input: PregnancyCheckInput
): BreedingAttempt {
  const { attempt, currentEpoch, conceptionRate, conceptionRoll } = input;

  assertFiniteInteger(currentEpoch, "currentEpoch");
  assertRoll(conceptionRate, "conceptionRate");
  assertRoll(conceptionRoll, "conceptionRoll");

  if (
    attempt.status === "CHECKED_NOT_PREGNANT" ||
    attempt.status === "PREGNANT" ||
    attempt.status === "WHELPED" ||
    attempt.status === "FAILED"
  ) {
    return attempt;
  }

  if (currentEpoch < attempt.pregCheckEpoch) {
    throw new Error("Pregnancy check cannot occur before pregCheckEpoch.");
  }

  const pregnant = conceptionRoll < conceptionRate;

  return {
    ...attempt,
    checkedEpoch: currentEpoch,
    isPregnant: pregnant,
    status: pregnant ? "PREGNANT" : "CHECKED_NOT_PREGNANT",
  };
}

export function canWhelp(
  attempt: BreedingAttempt,
  currentEpoch: number
): boolean {
  if (attempt.status !== "PREGNANT") return false;
  if (attempt.isPregnant !== true) return false;
  return currentEpoch >= attempt.dueEpoch;
}

export function resolveWhelp(input: ResolveWhelpInput): WhelpOutcome {
  const {
    attempt,
    currentEpoch,
    litterId,
    pupCount,
    puppySexes,
    puppyDogIds,
    random01,
  } = input;

  assertFiniteInteger(currentEpoch, "currentEpoch");

  if (attempt.status === "WHELPED") {
    throw new Error("Attempt already whelped.");
  }

  if (!canWhelp(attempt, currentEpoch)) {
    throw new Error("Attempt is not ready to whelp.");
  }

  const { litter, puppies } = createLitter({
    litterId,
    breedCode2: attempt.breedCode2,
    bornEpoch: currentEpoch,
    sireId: attempt.sireId,
    damId: attempt.damId,
    pupCount,
    puppySexes,
    puppyDogIds,
    random01,
  });

  const updatedAttempt: BreedingAttempt = {
    ...attempt,
    whelpedEpoch: currentEpoch,
    litterId,
    status: "WHELPED",
  };

  return {
    attempt: updatedAttempt,
    litter,
    puppies,
    damReproUpdate: {
      isPregnant: false,
      whelpingCooldownUntil: currentEpoch + WHELPING_COOLDOWN_HOURS,
    },
  };
}

export function getPregnancyState(
  attempt: BreedingAttempt | null
): PregnancyState {
  if (!attempt) return "NOT_PREGNANT";
  if (attempt.status === "WHELPED") return "POST_WHELP";
  if (attempt.status === "PREGNANT") return "PREGNANT";
  return "NOT_PREGNANT";
}