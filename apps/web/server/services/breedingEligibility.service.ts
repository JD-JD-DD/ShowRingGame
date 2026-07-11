import {
  canBreed,
  type DogStatus,
  type Sex,
  WHELPING_COOLDOWN_HOURS,
} from "@showring/rules";

export type IndividualBreedingEligibilityInput = {
  currentEpoch: number;
  birthEpoch: number;
  lifecycleState: DogStatus;
  sex: Sex;
  activeBreedingAttemptStatus?: string | null;
  lastWhelpedEpoch?: number | null;
};

export type IndividualBreedingEligibilityResult = {
  isEligible: boolean;
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

  return {
    isEligible:
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
      ),
    isInPostWhelpCooldown,
    cooldownUntilEpoch,
    activeBreedingAttemptStatus,
  };
}
