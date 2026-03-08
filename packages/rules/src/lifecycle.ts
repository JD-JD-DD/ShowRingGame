import {
  PUPPY_SALE_MIN_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  AGE_DEATH_START_HOURS,
  MAX_SHOW_AGE_HOURS,
  DAM_MAX_BREED_AGE_HOURS,
} from "../constants/lifecycle.constants";
import { ageHours } from "./time";

export type Sex = "M" | "F";

export type DogStatus =
  | "ALIVE"
  | "RETIRED"
  | "DECEASED"
  | "TRANSFERRED"; // sold/leased out, etc (policy choice)

/**
 * For now, we keep this minimal. Later you can extend with:
 * - isPregnant
 * - lastLitterAt
 * - whelpingCooldownUntil
 */
export type ReproState = {
  isPregnant?: boolean;
  // breedingAttemptId?: string
  // pregCheckEpoch?: number
  // dueEpoch?: number
  whelpingCooldownUntil?: number | null;
};

export type LifeStage = "PUPPY" | "JUNIOR" | "ADULT" | "VETERAN" | "SENIOR";

/**
 * Derive a coarse life stage based on age.
 * You can refine these boundaries later without touching API/UI.
 */
export function lifeStage(
  currentEpoch: number,
  birthEpoch: number
): LifeStage {
  const h = ageHours(currentEpoch, birthEpoch);

  if (h < MIN_SHOW_AGE_HOURS) return "PUPPY";
  if (h < MIN_BREED_AGE_HOURS) return "JUNIOR";
  if (h < AGE_DEATH_START_HOURS) return "ADULT";

  // once death-risk begins, the dog is effectively senior/veteran-aged
  // If you later add a true "veteran" age threshold, split it here.
  if (h <= MAX_SHOW_AGE_HOURS) return "VETERAN";

  return "SENIOR";
}

export function canSellPuppy(currentEpoch: number, birthEpoch: number, status: DogStatus): boolean {
  if (status !== "ALIVE") return false;
  return ageHours(currentEpoch, birthEpoch) >= PUPPY_SALE_MIN_AGE_HOURS;
}

export function canEnterShows(currentEpoch: number, birthEpoch: number, status: DogStatus): boolean {
  if (status !== "ALIVE") return false;

  const h = ageHours(currentEpoch, birthEpoch);
  return h >= MIN_SHOW_AGE_HOURS && h <= MAX_SHOW_AGE_HOURS;
}

/**
 * Breeding eligibility gate.
 * Keep it strict and deterministic; all economics/fees handled elsewhere.
 *
 * NOTE: You have not finalized dam max breeding age in your current constants.ts.
 * When you decide it, add DAM_MAX_BREED_AGE to constants and enforce it here.
 */
export function canBreed(
  currentEpoch: number,
  birthEpoch: number,
  status: DogStatus,
  sex: Sex,
  repro: ReproState = {}
): boolean {
  if (status !== "ALIVE") return false;

  const h = ageHours(currentEpoch, birthEpoch);
  if (h < MIN_BREED_AGE_HOURS) return false;

  if (sex === "F") {
    if (h > DAM_MAX_BREED_AGE_HOURS) return false;
    if (repro.isPregnant) return false;

    if (
      repro.whelpingCooldownUntil != null &&
      currentEpoch < repro.whelpingCooldownUntil
    ) {
      return false;
    }
  }

  return true;
}

/**
 * A single function that UI/API can call to get all lifecycle info at once.
 */
export function getLifecycleFlags(args: {
  currentEpoch: number,
  birthEpoch: number,
  status: DogStatus;
  sex: Sex;
  repro?: ReproState;
}) {
  const {currentEpoch, birthEpoch, status, sex, repro } = args;
  const h = ageHours(currentEpoch, birthEpoch);

  return {
    ageHours: h,
    stage: lifeStage(currentEpoch, birthEpoch),
    canShow: canEnterShows(currentEpoch, birthEpoch, status),
    canBreed: canBreed(currentEpoch, birthEpoch, status, sex, repro),
    canSell: canSellPuppy(currentEpoch, birthEpoch, status),
    isDeathRiskAge: h >= AGE_DEATH_START_HOURS
  };
}