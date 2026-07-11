import {
  canBreed,
  DAM_MAX_BREED_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  type DogStatus,
  type Sex,
  WHELPING_COOLDOWN_HOURS,
} from "@showring/rules";
import { formatGameDurationHoursLong } from "../../lib/gameTimeFormat";

export type BreedingEligibilityReasonCode =
  | "ELIGIBLE"
  | "NOT_ALIVE"
  | "UNDER_MINIMUM_AGE"
  | "OVER_MAXIMUM_DAM_AGE"
  | "PENDING_PREGNANCY_CONFIRMATION"
  | "PREGNANT"
  | "POST_WHELP_COOLDOWN";

export type IndividualBreedingEligibilityInput = {
  currentEpoch: number;
  birthEpoch: number;
  lifecycleState: DogStatus;
  sex: Sex;
  activeBreedingAttemptStatus?: string | null;
  lastWhelpedEpoch?: number | null;
};

export type IndividualBreedingEligibilityResult = {
  eligible: boolean;
  isEligible: boolean;
  reasonCode: BreedingEligibilityReasonCode;
  eligibleAtEpoch: number | null;
  remainingHours: number;
  isInPostWhelpCooldown: boolean;
  cooldownUntilEpoch: number | null;
  activeBreedingAttemptStatus: "INITIATED" | "PREGNANT" | null;
};

export function getIndividualBreedingEligibility(
  args: IndividualBreedingEligibilityInput
): IndividualBreedingEligibilityResult {
  const activeBreedingAttemptStatus =
    args.sex === "F" &&
    (args.activeBreedingAttemptStatus === "INITIATED" ||
      args.activeBreedingAttemptStatus === "PREGNANT")
      ? args.activeBreedingAttemptStatus
      : null;
  const cooldownUntilEpoch =
    args.sex === "F" && args.lastWhelpedEpoch != null
      ? args.lastWhelpedEpoch + WHELPING_COOLDOWN_HOURS
      : null;
  const isInPostWhelpCooldown =
    cooldownUntilEpoch != null && args.currentEpoch < cooldownUntilEpoch;
  const ageHours = Math.max(0, args.currentEpoch - args.birthEpoch);
  const minimumAgeEligibleAtEpoch = args.birthEpoch + MIN_BREED_AGE_HOURS;
  let reasonCode: BreedingEligibilityReasonCode = "ELIGIBLE";
  let eligibleAtEpoch: number | null = null;
  let remainingHours = 0;

  if (args.lifecycleState !== "ALIVE") {
    reasonCode = "NOT_ALIVE";
  } else if (activeBreedingAttemptStatus === "INITIATED") {
    reasonCode = "PENDING_PREGNANCY_CONFIRMATION";
  } else if (activeBreedingAttemptStatus === "PREGNANT") {
    reasonCode = "PREGNANT";
  } else if (isInPostWhelpCooldown && cooldownUntilEpoch != null) {
    reasonCode = "POST_WHELP_COOLDOWN";
    eligibleAtEpoch = cooldownUntilEpoch;
    remainingHours = Math.max(0, cooldownUntilEpoch - args.currentEpoch);
  } else if (ageHours < MIN_BREED_AGE_HOURS) {
    reasonCode = "UNDER_MINIMUM_AGE";
    eligibleAtEpoch = minimumAgeEligibleAtEpoch;
    remainingHours = Math.max(0, minimumAgeEligibleAtEpoch - args.currentEpoch);
  } else if (args.sex === "F" && ageHours > DAM_MAX_BREED_AGE_HOURS) {
    reasonCode = "OVER_MAXIMUM_DAM_AGE";
  }

  const eligible =
    reasonCode === "ELIGIBLE" &&
    activeBreedingAttemptStatus !== "INITIATED" &&
    canBreed(
      args.currentEpoch,
      args.birthEpoch,
      args.lifecycleState,
      args.sex,
      {
        isPregnant: activeBreedingAttemptStatus === "PREGNANT",
        whelpingCooldownUntil: cooldownUntilEpoch,
      }
    );

  return {
    eligible,
    isEligible: eligible,
    reasonCode,
    eligibleAtEpoch,
    remainingHours,
    isInPostWhelpCooldown,
    cooldownUntilEpoch,
    activeBreedingAttemptStatus,
  };
}

export function getBreedingEligibilityMessage(
  result: Pick<
    IndividualBreedingEligibilityResult,
    "reasonCode" | "remainingHours"
  >
): string | null {
  switch (result.reasonCode) {
    case "ELIGIBLE":
      return null;
    case "NOT_ALIVE":
      return "This dog is not alive.";
    case "UNDER_MINIMUM_AGE":
      return "This dog is too young to breed.";
    case "OVER_MAXIMUM_DAM_AGE":
      return "This bitch is above the maximum breeding age.";
    case "PENDING_PREGNANCY_CONFIRMATION":
      return "Pregnancy confirmation is pending.";
    case "PREGNANT":
      return "This bitch is pregnant.";
    case "POST_WHELP_COOLDOWN":
      return `This bitch is resting after a litter. Available to breed in ${formatGameDurationHoursLong(
        result.remainingHours
      )}.`;
    default:
      return null;
  }
}
