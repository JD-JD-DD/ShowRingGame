import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MIN_GROOMING_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
} from "@showring/rules";

import { buildDogActionWindows } from "@/lib/dogActionWindows";

const currentEpoch = 10_000;

function actionWindowsForAge(args: {
  ageHours: number;
  lifecycleState?: string;
  canGroom?: boolean;
  canShow?: boolean;
}) {
  return buildDogActionWindows({
    ageHours: args.ageHours,
    sex: "M",
    lifecycleState: args.lifecycleState ?? "ALIVE",
    currentEpoch,
    canShow: args.canShow ?? args.ageHours >= MIN_SHOW_AGE_HOURS,
    canBreed: false,
    canGroom: args.canGroom ?? args.ageHours >= MIN_GROOMING_AGE_HOURS,
    groomedThisWeek: false,
  });
}

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

assert.equal(MIN_GROOMING_AGE_HOURS, 84, "grooming unlocks at 12 weeks");
assert.equal(MIN_SHOW_AGE_HOURS, 182, "show eligibility remains 6 months");

const eightyThreeHourDog = actionWindowsForAge({
  ageHours: MIN_GROOMING_AGE_HOURS - 1,
  canGroom: false,
  canShow: false,
});
assert.ok(
  eightyThreeHourDog.groomingWindow.value.startsWith("Grooming available in "),
  "83-hour-old living dog cannot be groomed yet"
);
assert.ok(
  eightyThreeHourDog.nextMilestone.value.startsWith("Grooming unlocks in "),
  "83-hour-old living dog sees grooming as the next milestone"
);

const eightyFourHourDog = actionWindowsForAge({
  ageHours: MIN_GROOMING_AGE_HOURS,
  canGroom: true,
  canShow: false,
});
assert.equal(
  eightyFourHourDog.groomingWindow.value,
  "Available now.",
  "84-hour-old living dog can be groomed"
);

const oneEightyOneHourDog = actionWindowsForAge({
  ageHours: MIN_SHOW_AGE_HOURS - 1,
  canGroom: true,
  canShow: false,
});
assert.equal(
  oneEightyOneHourDog.groomingWindow.value,
  "Available now.",
  "181-hour-old dog can be groomed"
);
assert.ok(
  oneEightyOneHourDog.showWindow.value.startsWith("Show eligible in "),
  "181-hour-old dog still cannot enter shows"
);

const oneEightyTwoHourDog = actionWindowsForAge({
  ageHours: MIN_SHOW_AGE_HOURS,
  canGroom: true,
  canShow: true,
});
assert.equal(
  oneEightyTwoHourDog.groomingWindow.value,
  "Available now.",
  "182-hour-old dog can be groomed"
);
assert.equal(
  oneEightyTwoHourDog.showWindow.value,
  "Eligible now.",
  "182-hour-old dog can enter shows"
);

const deceasedDog = actionWindowsForAge({
  ageHours: MIN_SHOW_AGE_HOURS,
  lifecycleState: "DECEASED",
  canGroom: false,
  canShow: false,
});
assert.equal(
  deceasedDog.groomingWindow.value,
  "Unavailable.",
  "deceased dog cannot be groomed even if old enough"
);

const groomingService = source("server/services/grooming.service.ts");
assert.ok(
  groomingService.includes("MIN_GROOMING_AGE_HOURS"),
  "grooming service uses the grooming age constant"
);
assert.ok(
  !groomingService.includes("MIN_SHOW_AGE_HOURS"),
  "grooming service no longer depends on show age"
);

const kennelPanel = source("components/kennel/KennelDogsPanel.tsx");
assert.ok(
  kennelPanel.includes("MIN_GROOMING_AGE_HOURS"),
  "kennel grooming controls use the grooming age constant"
);

console.log("Grooming eligibility checks passed.");
