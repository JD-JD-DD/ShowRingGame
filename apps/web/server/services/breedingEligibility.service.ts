import {
  canBreed,
  DAM_MAX_BREED_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  type DogStatus,
  type Sex,
  WHELPING_COOLDOWN_HOURS,
} from "@showring/rules";
import { formatRealDurationHoursLong } from "../../lib/gameTimeFormat";

export type ResolvedReproductiveEmergencyEligibilityEvent = {
  id: string;
  status: string;
  resolvedEpoch: number | null;
  reproductiveConsequence: string | null;
};

export type BreedingEligibilityReasonCode =
  | "ELIGIBLE"
  | "NOT_ALIVE"
  | "UNDER_MINIMUM_AGE"
  | "OVER_MAXIMUM_DAM_AGE"
  | "PENDING_PREGNANCY_CONFIRMATION"
  | "PREGNANT"
  | "REPRODUCTIVE_EMERGENCY"
  | "POST_WHELP_COOLDOWN"
  | "REPRODUCTIVE_RECOVERY"
  | "REPRODUCTIVE_EXTENDED_RECOVERY"
  | "PERMANENT_REPRODUCTIVE_RESTRICTION";

export type IndividualBreedingEligibilityInput = {
  currentEpoch: number;
  birthEpoch: number;
  lifecycleState: DogStatus;
  sex: Sex;
  activeBreedingAttemptStatus?: string | null;
  lastWhelpedEpoch?: number | null;
  resolvedReproductiveEmergencies?: ResolvedReproductiveEmergencyEligibilityEvent[];
};

export type IndividualBreedingEligibilityResult = {
  eligible: boolean;
  isEligible: boolean;
  reasonCode: BreedingEligibilityReasonCode;
  eligibleAtEpoch: number | null;
  remainingHours: number;
  isInPostWhelpCooldown: boolean;
  cooldownUntilEpoch: number | null;
  activeBreedingAttemptStatus:
    | "INITIATED"
    | "PREGNANT"
    | "REPRODUCTIVE_EMERGENCY"
    | null;
};

export function getIndividualBreedingEligibility(
  args: IndividualBreedingEligibilityInput
): IndividualBreedingEligibilityResult {
  const activeBreedingAttemptStatus =
    args.sex === "F" &&
    (args.activeBreedingAttemptStatus === "INITIATED" ||
      args.activeBreedingAttemptStatus === "PREGNANT" ||
      args.activeBreedingAttemptStatus === "REPRODUCTIVE_EMERGENCY")
      ? args.activeBreedingAttemptStatus
      : null;
  const terminalEvents = (args.resolvedReproductiveEmergencies ?? [])
    .filter((event) => event.resolvedEpoch != null)
    .sort((a, b) => (b.resolvedEpoch! - a.resolvedEpoch!) || b.id.localeCompare(a.id));
  const permanentEvent = terminalEvents.find(
    (event) => event.reproductiveConsequence === "PERMANENT_BREEDING_RESTRICTION"
  );
  const latestEvent = terminalEvents[0] ?? null;
  const reproductiveRecoveryUntil = latestEvent?.resolvedEpoch != null && latestEvent.reproductiveConsequence !== "PERMANENT_BREEDING_RESTRICTION"
    ? latestEvent.resolvedEpoch + (latestEvent.reproductiveConsequence === "EXTENDED_RECOVERY" ? 365 : WHELPING_COOLDOWN_HOURS)
    : null;
  const cooldownUntilEpoch = reproductiveRecoveryUntil ?? (
    args.sex === "F" && args.lastWhelpedEpoch != null
      ? args.lastWhelpedEpoch + WHELPING_COOLDOWN_HOURS
      : null);
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
  } else if (activeBreedingAttemptStatus === "REPRODUCTIVE_EMERGENCY") {
    reasonCode = "REPRODUCTIVE_EMERGENCY";
  } else if (permanentEvent) {
    reasonCode = "PERMANENT_REPRODUCTIVE_RESTRICTION";
  } else if (isInPostWhelpCooldown && reproductiveRecoveryUntil != null) {
    reasonCode = latestEvent?.reproductiveConsequence === "EXTENDED_RECOVERY"
      ? "REPRODUCTIVE_EXTENDED_RECOVERY"
      : "REPRODUCTIVE_RECOVERY";
    eligibleAtEpoch = reproductiveRecoveryUntil;
    remainingHours = Math.max(0, reproductiveRecoveryUntil - args.currentEpoch);
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
    case "REPRODUCTIVE_EMERGENCY":
      return "This dam is receiving emergency care for a whelping complication.";
    case "REPRODUCTIVE_RECOVERY":
      return `She is recovering after whelping and may be bred again after game time in ${formatRealDurationHoursLong(result.remainingHours)}.`;
    case "REPRODUCTIVE_EXTENDED_RECOVERY":
      return `She is recovering from whelping complications and may be bred again after game time in ${formatRealDurationHoursLong(result.remainingHours)}.`;
    case "PERMANENT_REPRODUCTIVE_RESTRICTION":
      return "Veterinary complications mean she cannot safely carry another litter and may not be bred again.";
    case "POST_WHELP_COOLDOWN":
      return `This bitch is resting after a litter. Available to breed in ${formatRealDurationHoursLong(
        result.remainingHours
      )}.`;
    default:
      return null;
  }
}
