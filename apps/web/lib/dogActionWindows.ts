import {
  DAM_MAX_BREED_AGE_HOURS,
  MAX_SHOW_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  MIN_GROOMING_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
} from "@showring/rules";

import { formatRealDurationHoursLong } from "@/lib/gameTimeFormat";

export type DogActionWindowTone =
  | "ready"
  | "pending"
  | "complete"
  | "closed"
  | "unavailable"
  | "neutral";

export type DogActionWindowCard = {
  label: string;
  value: string;
  tone: DogActionWindowTone;
};

export type DogActionWindows = {
  showWindow: DogActionWindowCard;
  breedingWindow: DogActionWindowCard;
  groomingWindow: DogActionWindowCard;
  nextMilestone: DogActionWindowCard;
};

export type BuildDogActionWindowsInput = {
  ageHours: number;
  sex: "M" | "F";
  lifecycleState: string;
  currentEpoch: number;
  canShow: boolean;
  canBreed: boolean;
  breedingUnavailableReason?: string | null;
  groomingState?: string | null;
  canGroom?: boolean;
  groomedThisWeek?: boolean;
  nextGroomingResetEpoch?: number | null;
  breedingStatus?: string | null;
  pregCheckEpoch?: number | null;
  dueEpoch?: number | null;
};

function isAlive(lifecycleState: string): boolean {
  return lifecycleState === "ALIVE";
}

function remainingFromCurrentEpoch(
  targetEpoch: number | null | undefined,
  currentEpoch: number
): number | null {
  if (targetEpoch == null || targetEpoch <= currentEpoch) {
    return null;
  }

  return targetEpoch - currentEpoch;
}

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toUpperCase();
}

function isPregnantStatus(status: string): boolean {
  return status === "PREGNANT" || status.includes("PREGNANT");
}

function isPendingPregnancyCheckStatus(status: string): boolean {
  return (
    status === "INITIATED" ||
    status.includes("PENDING") ||
    status.includes("CONFIRMATION")
  );
}

function buildShowWindow(input: BuildDogActionWindowsInput): DogActionWindowCard {
  if (!isAlive(input.lifecycleState)) {
    return {
      label: "Show Window",
      value: "Unavailable.",
      tone: "unavailable",
    };
  }

  if (input.ageHours < MIN_SHOW_AGE_HOURS) {
    return {
      label: "Show Window",
      value: `Show eligible in ${formatRealDurationHoursLong(
        MIN_SHOW_AGE_HOURS - input.ageHours
      )}.`,
      tone: "pending",
    };
  }

  if (input.ageHours > MAX_SHOW_AGE_HOURS) {
    return {
      label: "Show Window",
      value: "Show career ended.",
      tone: "closed",
    };
  }

  if (input.canShow) {
    return {
      label: "Show Window",
      value: "Eligible now.",
      tone: "ready",
    };
  }

  return {
    label: "Show Window",
    value: "Unavailable.",
    tone: "unavailable",
  };
}

function buildBreedingWindow(
  input: BuildDogActionWindowsInput
): DogActionWindowCard {
  if (!isAlive(input.lifecycleState)) {
    return {
      label: "Breeding Window",
      value: "Unavailable.",
      tone: "unavailable",
    };
  }

  if (input.ageHours < MIN_BREED_AGE_HOURS) {
    return {
      label: "Breeding Window",
      value: `Breeding eligible in ${formatRealDurationHoursLong(
        MIN_BREED_AGE_HOURS - input.ageHours
      )}.`,
      tone: "pending",
    };
  }

  if (input.sex === "F" && input.ageHours > DAM_MAX_BREED_AGE_HOURS) {
    return {
      label: "Breeding Window",
      value: "Past dam breeding age.",
      tone: "closed",
    };
  }

  if (input.canBreed) {
    return {
      label: "Breeding Window",
      value: "Eligible now.",
      tone: "ready",
    };
  }

  if (input.breedingUnavailableReason) {
    return {
      label: "Breeding Window",
      value: input.breedingUnavailableReason,
      tone: "pending",
    };
  }

  return {
    label: "Breeding Window",
    value: "Not currently available.",
    tone: "pending",
  };
}

function buildGroomingWindow(
  input: BuildDogActionWindowsInput
): DogActionWindowCard {
  const resetRemaining = remainingFromCurrentEpoch(
    input.nextGroomingResetEpoch,
    input.currentEpoch
  );

  if (!isAlive(input.lifecycleState)) {
    return {
      label: "Grooming Window",
      value: "Unavailable.",
      tone: "unavailable",
    };
  }

  if (input.ageHours < MIN_GROOMING_AGE_HOURS) {
    return {
      label: "Grooming Window",
      value: `Grooming available again in ${formatRealDurationHoursLong(
        MIN_GROOMING_AGE_HOURS - input.ageHours
      )}.`,
      tone: "pending",
    };
  }

  if (input.groomedThisWeek) {
    return {
      label: "Grooming Window",
      value: "Groomed this week.",
      tone: "complete",
    };
  }

  if (input.canGroom) {
    return {
      label: "Grooming Window",
      value: "Available now.",
      tone: "ready",
    };
  }

  if (resetRemaining !== null) {
    return {
      label: "Grooming Window",
      value: `Grooming available again in ${formatRealDurationHoursLong(
        resetRemaining
      )}.`,
      tone: "pending",
    };
  }

  return {
    label: "Grooming Window",
    value: "Not currently available.",
    tone: "unavailable",
  };
}

function buildNextMilestone(
  input: BuildDogActionWindowsInput
): DogActionWindowCard {
  const breedingStatus = normalizeStatus(input.breedingStatus);
  const pregCheckRemaining = remainingFromCurrentEpoch(
    input.pregCheckEpoch,
    input.currentEpoch
  );
  const dueRemaining = remainingFromCurrentEpoch(
    input.dueEpoch,
    input.currentEpoch
  );
  const groomingResetRemaining = remainingFromCurrentEpoch(
    input.nextGroomingResetEpoch,
    input.currentEpoch
  );

  if (
    pregCheckRemaining !== null &&
    (!isPregnantStatus(breedingStatus) ||
      isPendingPregnancyCheckStatus(breedingStatus))
  ) {
    return {
      label: "Next Milestone",
      value: `Pregnancy confirmation in ${formatRealDurationHoursLong(
        pregCheckRemaining
      )}.`,
      tone: "pending",
    };
  }

  if (
    dueRemaining !== null &&
    (isPregnantStatus(breedingStatus) || breedingStatus === "")
  ) {
    return {
      label: "Next Milestone",
      value: `Due in ${formatRealDurationHoursLong(dueRemaining)}.`,
      tone: "pending",
    };
  }

  if (!isAlive(input.lifecycleState)) {
    return {
      label: "Next Milestone",
      value: "No pending countdown.",
      tone: "neutral",
    };
  }

  if (input.ageHours < MIN_GROOMING_AGE_HOURS) {
    return {
      label: "Next Milestone",
      value: `Grooming available again in ${formatRealDurationHoursLong(
        MIN_GROOMING_AGE_HOURS - input.ageHours
      )}.`,
      tone: "pending",
    };
  }

  if (input.ageHours < MIN_SHOW_AGE_HOURS) {
    return {
      label: "Next Milestone",
      value: `Show eligible in ${formatRealDurationHoursLong(
        MIN_SHOW_AGE_HOURS - input.ageHours
      )}.`,
      tone: "pending",
    };
  }

  if (input.ageHours < MIN_BREED_AGE_HOURS) {
    return {
      label: "Next Milestone",
      value: `Breeding eligible in ${formatRealDurationHoursLong(
        MIN_BREED_AGE_HOURS - input.ageHours
      )}.`,
      tone: "pending",
    };
  }

  if (input.sex === "F" && input.ageHours < DAM_MAX_BREED_AGE_HOURS) {
    return {
      label: "Next Milestone",
      value: `Dam breeding window ends in ${formatRealDurationHoursLong(
        DAM_MAX_BREED_AGE_HOURS - input.ageHours
      )}.`,
      tone: "pending",
    };
  }

  if (input.ageHours < MAX_SHOW_AGE_HOURS) {
    return {
      label: "Next Milestone",
      value: `Show career ends in ${formatRealDurationHoursLong(
        MAX_SHOW_AGE_HOURS - input.ageHours
      )}.`,
      tone: "pending",
    };
  }

  if (groomingResetRemaining !== null) {
    return {
      label: "Next Milestone",
      value: `Grooming available again in ${formatRealDurationHoursLong(
        groomingResetRemaining
      )}.`,
      tone: "pending",
    };
  }

  return {
    label: "Next Milestone",
    value: "No pending countdown.",
    tone: "neutral",
  };
}

export function buildDogActionWindows(
  input: BuildDogActionWindowsInput
): DogActionWindows {
  return {
    showWindow: buildShowWindow(input),
    breedingWindow: buildBreedingWindow(input),
    groomingWindow: buildGroomingWindow(input),
    nextMilestone: buildNextMilestone(input),
  };
}
