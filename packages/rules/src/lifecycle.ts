import {
  PUPPY_SALE_MIN_AGE,
  MIN_SHOW_AGE,
  MIN_BREED_AGE,
  AGE_DEATH_START,
  MAX_SHOW_AGE
} from "./constants";
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
  whelpingCooldownUntil?: Date | null;
};

export type LifeStage = "PUPPY" | "JUNIOR" | "ADULT" | "VETERAN" | "SENIOR";

/**
 * Derive a coarse life stage based on age.
 * You can refine these boundaries later without touching API/UI.
 */
export function lifeStage(now: Date, birthAt: Date): LifeStage {
  const h = ageHours(now, birthAt);

  if (h < MIN_SHOW_AGE) return "PUPPY";
  if (h < MIN_BREED_AGE) return "JUNIOR";
  if (h < AGE_DEATH_START) return "ADULT";

  // once death-risk begins, the dog is effectively senior/veteran-aged
  // If you later add a true "veteran" age threshold, split it here.
  if (h <= MAX_SHOW_AGE) return "VETERAN";

  return "SENIOR";
}

export function canSellPuppy(now: Date, birthAt: Date, status: DogStatus): boolean {
  if (status !== "ALIVE") return false;
  return ageHours(now, birthAt) >= PUPPY_SALE_MIN_AGE;
}

export function canEnterShows(now: Date, birthAt: Date, status: DogStatus): boolean {
  if (status !== "ALIVE") return false;

  const h = ageHours(now, birthAt);
  return h >= MIN_SHOW_AGE && h <= MAX_SHOW_AGE;
}

/**
 * Breeding eligibility gate.
 * Keep it strict and deterministic; all economics/fees handled elsewhere.
 *
 * NOTE: You have not finalized dam max breeding age in your current constants.ts.
 * When you decide it, add DAM_MAX_BREED_AGE to constants and enforce it here.
 */
export function canBreed(
  now: Date,
  birthAt: Date,
  status: DogStatus,
  sex: Sex,
  repro: ReproState = {}
): boolean {
  if (status !== "ALIVE") return false;

  const h = ageHours(now, birthAt);
  if (h < MIN_BREED_AGE) return false;

  // If dog is too old to show, you may still allow breeding.
  // Policy choice: keep breeding allowed past MAX_SHOW_AGE unless you add caps.
  // For dams, you likely will add a max breeding age later.
  if (sex === "F") {
    if (repro.isPregnant) return false;

    if (repro.whelpingCooldownUntil && now < repro.whelpingCooldownUntil) {
      return false;
    }
  }

  return true;
}

/**
 * A single function that UI/API can call to get all lifecycle info at once.
 */
export function getLifecycleFlags(args: {
  now: Date;
  birthAt: Date;
  status: DogStatus;
  sex: Sex;
  repro?: ReproState;
}) {
  const { now, birthAt, status, sex, repro } = args;
  const h = ageHours(now, birthAt);

  return {
    ageHours: h,
    stage: lifeStage(now, birthAt),
    canShow: canEnterShows(now, birthAt, status),
    canBreed: canBreed(now, birthAt, status, sex, repro),
    canSell: canSellPuppy(now, birthAt, status),
    isDeathRiskAge: h >= AGE_DEATH_START
  };
}