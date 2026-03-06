import {
  DAM_MAX_BREED_AGE_HOURS,
  GESTATION_HOURS,
  MIN_BREED_AGE_HOURS,
  PREG_CHECK_HOURS,
} from "../constants/lifecycle.constants";
import { ageHours } from "../src/time";
import type { DogStatus, Sex } from "../src/lifecycle";

export type BreedingAttemptStatus =
  | "INITIATED"
  | "CHECKED_NOT_PREGNANT"
  | "PREGNANT"
  | "WHELPED";

export type PregnancyState = "NOT_PREGNANT" | "PREGNANT" | "POST_WHELP";

export type BreedCode2 = string;

export type BreedingDog = {
  dogId: string;
  breedCode2: BreedCode2;
  birthEpoch: number;
  sex: Sex;
  status: DogStatus;
};

export type BreedingAttempt = {
  attemptId: string;
  sireId: string;
  damId: string;
  breedCode2: BreedCode2;
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

export type Litter = {
  litterId: string;
  breedCode2: BreedCode2;
  serial6: string;
  bornEpoch: number;
  sireId: string;
  damId: string;
  pupCount: number;
};

export type PuppyRecord = {
  dogId: string;
  litterId: string;
  litterOrder: number;
  regNumber: string;
  breedCode2: BreedCode2;
  birthEpoch: number;
  sex: Sex;
  status: DogStatus;
};

export type WhelpOutcome = {
  attempt: BreedingAttempt;
  litter: Litter;
  puppies: PuppyRecord[];
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
};

export type PregnancyCheckInput = {
  attempt: BreedingAttempt;
  currentEpoch: number;
  conceptionRate: number;
  conceptionRoll: number; // expected 0.0 <= roll < 1.0
};

export type WhelpInput = {
  attempt: BreedingAttempt;
  currentEpoch: number;
  litterId: string;
  pupCount: number;
  serial6: string;
  puppySexes: Sex[];
  puppyDogIds: string[];
};

function isValidBreedCode2(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

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

function assertPositiveInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

export function canBreedSire(currentEpoch: number, sire: BreedingDog): boolean {
  if (sire.sex !== "M") return false;
  if (sire.status !== "ALIVE") return false;

  const h = ageHours(currentEpoch, sire.birthEpoch);
  return h >= MIN_BREED_AGE_HOURS;
}

export function canBreedDam(
  currentEpoch: number,
  dam: BreedingDog,
  options: { isPregnant?: boolean } = {}
): boolean {
  if (dam.sex !== "F") return false;
  if (dam.status !== "ALIVE") return false;
  if (options.isPregnant) return false;

  const h = ageHours(currentEpoch, dam.birthEpoch);
  return h >= MIN_BREED_AGE_HOURS && h <= DAM_MAX_BREED_AGE_HOURS;
}

export function validateBreedingPair(
  currentEpoch: number,
  sire: BreedingDog,
  dam: BreedingDog,
  options: { damIsPregnant?: boolean } = {}
): ValidationResult {
  const reasons: string[] = [];

  if (!isValidBreedCode2(sire.breedCode2)) {
    reasons.push("Sire breedCode2 is invalid.");
  }

  if (!isValidBreedCode2(dam.breedCode2)) {
    reasons.push("Dam breedCode2 is invalid.");
  }

  if (sire.dogId === dam.dogId) {
    reasons.push("Sire and dam cannot be the same dog.");
  }

  if (sire.breedCode2 !== dam.breedCode2) {
    reasons.push("Breed mismatch.");
  }

  if (!canBreedSire(currentEpoch, sire)) {
    reasons.push("Sire is not breeding-eligible.");
  }

  if (!canBreedDam(currentEpoch, dam, { isPregnant: options.damIsPregnant })) {
    reasons.push("Dam is not breeding-eligible.");
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function createBreedingAttempt(
  input: CreateBreedingAttemptInput
): BreedingAttempt {
  const { attemptId, currentEpoch, sire, dam, rngSeed } = input;

  assertFiniteInteger(currentEpoch, "currentEpoch");
  assertFiniteInteger(rngSeed, "rngSeed");

  const validation = validateBreedingPair(currentEpoch, sire, dam);
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

  if (attempt.status === "CHECKED_NOT_PREGNANT" || attempt.status === "PREGNANT" || attempt.status === "WHELPED") {
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

export function canWhelp(attempt: BreedingAttempt, currentEpoch: number): boolean {
  if (attempt.status !== "PREGNANT") return false;
  if (attempt.isPregnant !== true) return false;
  return currentEpoch >= attempt.dueEpoch;
}

export function buildRegNumber(
  breedCode2: string,
  serial6: string,
  litterOrder: number
): string {
  if (!isValidBreedCode2(breedCode2)) {
    throw new Error("breedCode2 must be two uppercase letters.");
  }

  if (!/^\d{6}$/.test(serial6)) {
    throw new Error("serial6 must be exactly 6 digits.");
  }

  if (!Number.isInteger(litterOrder) || litterOrder < 1 || litterOrder > 99) {
    throw new Error("litterOrder must be an integer between 1 and 99.");
  }

  return `${breedCode2}${serial6}${String(litterOrder).padStart(2, "0")}`;
}

export function generateSerial6(random01: () => number): string {
  const roll = random01();
  assertRoll(roll, "random01()");
  const value = Math.floor(roll * 1_000_000);
  return String(value).padStart(6, "0");
}

export function resolveWhelp(input: WhelpInput): WhelpOutcome {
  const {
    attempt,
    currentEpoch,
    litterId,
    pupCount,
    serial6,
    puppySexes,
    puppyDogIds,
  } = input;

  assertFiniteInteger(currentEpoch, "currentEpoch");
  assertPositiveInt(pupCount, "pupCount");

  if (attempt.status === "WHELPED") {
    throw new Error("Attempt already whelped.");
  }

  if (!canWhelp(attempt, currentEpoch)) {
    throw new Error("Attempt is not ready to whelp.");
  }

  if (!/^\d{6}$/.test(serial6)) {
    throw new Error("serial6 must be exactly 6 digits.");
  }

  if (puppySexes.length !== pupCount) {
    throw new Error("puppySexes length must equal pupCount.");
  }

  if (puppyDogIds.length !== pupCount) {
    throw new Error("puppyDogIds length must equal pupCount.");
  }

  const litter: Litter = {
    litterId,
    breedCode2: attempt.breedCode2,
    serial6,
    bornEpoch: currentEpoch,
    sireId: attempt.sireId,
    damId: attempt.damId,
    pupCount,
  };

  const puppies: PuppyRecord[] = Array.from({ length: pupCount }, (_, index) => {
    const litterOrder = index + 1;

    return {
      dogId: puppyDogIds[index],
      litterId,
      litterOrder,
      regNumber: buildRegNumber(attempt.breedCode2, serial6, litterOrder),
      breedCode2: attempt.breedCode2,
      birthEpoch: currentEpoch,
      sex: puppySexes[index],
      status: "ALIVE",
    };
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
  };
}

export function getPregnancyState(attempt: BreedingAttempt | null): PregnancyState {
  if (!attempt) return "NOT_PREGNANT";
  if (attempt.status === "WHELPED") return "POST_WHELP";
  if (attempt.status === "PREGNANT") return "PREGNANT";
  return "NOT_PREGNANT";
}