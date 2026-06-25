import { strict as assert } from "node:assert";

import {
  DAM_MAX_BREED_AGE_HOURS,
  MAX_SHOW_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
} from "@showring/rules";

import {
  buildDogActionWindows,
  type BuildDogActionWindowsInput,
} from "../lib/dogActionWindows";

const currentEpoch = 10_000;

function buildInput(
  overrides: Partial<BuildDogActionWindowsInput> = {}
): BuildDogActionWindowsInput {
  return {
    ageHours: MIN_BREED_AGE_HOURS,
    sex: "M",
    lifecycleState: "ALIVE",
    currentEpoch,
    canShow: true,
    canBreed: true,
    canGroom: false,
    groomedThisWeek: false,
    ...overrides,
  };
}

const thirtySevenWeekDog = buildDogActionWindows(
  buildInput({
    ageHours: 37 * 7,
    canShow: true,
    canBreed: false,
  })
);

assert.equal(
  thirtySevenWeekDog.showWindow.value,
  "Eligible now.",
  "37-week dog can show now"
);
assert.ok(
  thirtySevenWeekDog.breedingWindow.value.startsWith("Breeding eligible in "),
  "37-week dog has a breeding-age countdown"
);

const puppy = buildDogActionWindows(
  buildInput({
    ageHours: MIN_SHOW_AGE_HOURS - 1,
    canShow: false,
    canBreed: false,
  })
);

assert.ok(
  puppy.showWindow.value.startsWith("Show eligible in "),
  "puppy under show age has a show-age countdown"
);
assert.ok(
  puppy.nextMilestone.value.startsWith("Show age in "),
  "puppy next milestone prioritizes show age"
);

const adultMale = buildDogActionWindows(
  buildInput({
    sex: "M",
    ageHours: MIN_BREED_AGE_HOURS,
    canBreed: true,
  })
);

assert.equal(
  adultMale.breedingWindow.value,
  "Eligible now.",
  "adult male can be breeding eligible now"
);

const adultFemale = buildDogActionWindows(
  buildInput({
    sex: "F",
    ageHours: MIN_BREED_AGE_HOURS,
    canBreed: true,
  })
);

assert.equal(
  adultFemale.breedingWindow.value,
  "Eligible now.",
  "adult female can be breeding eligible now"
);
assert.ok(
  adultFemale.nextMilestone.value.startsWith("Dam window ends in "),
  "adult female next milestone can show dam cutoff"
);

const pastDamCutoff = buildDogActionWindows(
  buildInput({
    sex: "F",
    ageHours: DAM_MAX_BREED_AGE_HOURS + 1,
    canBreed: false,
  })
);

assert.equal(
  pastDamCutoff.breedingWindow.value,
  "Past dam breeding age.",
  "female past dam cutoff uses closed breeding copy"
);

const pastMaxShowAge = buildDogActionWindows(
  buildInput({
    ageHours: MAX_SHOW_AGE_HOURS + 1,
    canShow: false,
    canBreed: false,
  })
);

assert.equal(
  pastMaxShowAge.showWindow.value,
  "Show career ended.",
  "dog past max show age uses closed show copy"
);

const groomedThisWeek = buildDogActionWindows(
  buildInput({
    canGroom: false,
    groomedThisWeek: true,
    nextGroomingResetEpoch: currentEpoch + 12,
  })
);

assert.equal(
  groomedThisWeek.groomingWindow.value,
  "Groomed this week.",
  "groomed dog shows completed grooming copy"
);

const groomingAvailable = buildDogActionWindows(
  buildInput({
    canGroom: true,
  })
);

assert.equal(
  groomingAvailable.groomingWindow.value,
  "Available now.",
  "available grooming window uses ready copy"
);

const pendingPregnancyCheck = buildDogActionWindows(
  buildInput({
    sex: "F",
    canBreed: false,
    breedingStatus: "INITIATED",
    pregCheckEpoch: currentEpoch + 48,
    dueEpoch: currentEpoch + 200,
  })
);

assert.ok(
  pendingPregnancyCheck.nextMilestone.value.startsWith("Pregnancy check in "),
  "pending pregnancy check wins next milestone priority"
);

const pregnantDue = buildDogActionWindows(
  buildInput({
    sex: "F",
    canBreed: false,
    breedingStatus: "PREGNANT",
    pregCheckEpoch: currentEpoch - 1,
    dueEpoch: currentEpoch + 72,
  })
);

assert.ok(
  pregnantDue.nextMilestone.value.startsWith("Due to whelp in "),
  "pregnant dog shows due-to-whelp milestone"
);

const fallback = buildDogActionWindows(
  buildInput({
    ageHours: MAX_SHOW_AGE_HOURS + 1,
    sex: "M",
    canShow: false,
    canBreed: false,
    canGroom: false,
    nextGroomingResetEpoch: null,
  })
);

assert.equal(
  fallback.nextMilestone.value,
  "No pending countdown.",
  "dogs without upcoming display events use fallback copy"
);

console.log("Dog action window checks passed.");
