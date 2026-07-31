import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const breedingService = source("apps/web/server/services/breeding.service.ts");
const noticeService = source("apps/web/server/services/kennelNotice.service.ts");
const eligibilityService = source(
  "apps/web/server/services/breedingEligibility.service.ts"
);
const dogService = source("apps/web/server/services/dog.service.ts");
const lifecycleService = source("apps/web/server/services/lifecycle.service.ts");

function assertIncludes(value: string, expected: string, label: string) {
  assert.ok(value.includes(expected), label);
}

assertIncludes(
  breedingService,
  "const trigger = shouldTriggerReproductiveEmergency({",
  "reproductive emergency trigger is canonical"
);
assertIncludes(
  breedingService,
  'const existingEmergency = await tx.reproductiveEmergencyEvent.findUnique',
  "whelp transaction checks for an existing reproductive emergency"
);
assertIncludes(
  breedingService,
  "const pupCount = rollLitterSize",
  "whelp transaction retains seeded intended litter-size generation"
);
assertIncludes(
  breedingService,
  "shouldTriggerReproductiveEmergency({",
  "whelp transaction invokes the deterministic trigger"
);
assertIncludes(
  breedingService,
  'status: "REPRODUCTIVE_EMERGENCY"',
  "triggered emergency changes the breeding attempt state"
);
assertIncludes(
  breedingService,
  'sourceKey: getReproductiveEmergencySourceKey(fresh.id)',
  "event source key is deterministic by breeding attempt"
);
assertIncludes(
  breedingService,
  'treatmentCost: REPRODUCTIVE_EMERGENCY_TREATMENT_COST',
  "event stores the canonical treatment cost"
);
assertIncludes(
  breedingService,
  'currentEpoch + REPRODUCTIVE_EMERGENCY_RESPONSE_WINDOW_HOURS',
  "event response deadline uses the canonical response window"
);
assertIncludes(
  breedingService,
  "await createReproductiveEmergencyNotice({",
  "triggered emergency creates a keyed notice"
);
assertIncludes(
  breedingService,
  "return \"REPRODUCTIVE_EMERGENCY\";",
  "triggered emergency exits before normal litter persistence"
);

const emergencyBranchStart = breedingService.indexOf(
  "const trigger = shouldTriggerReproductiveEmergency({"
);
const puppyCreationStart = breedingService.indexOf("const puppyDogIds = Array.from");
assert.ok(emergencyBranchStart >= 0, "trigger branch exists");
assert.ok(puppyCreationStart > emergencyBranchStart, "trigger occurs before puppy IDs");
const eventCreationStart = breedingService.indexOf(
  "await tx.reproductiveEmergencyEvent.create"
);
assert.ok(eventCreationStart > emergencyBranchStart, "event creation is inside trigger branch");
assert.ok(eventCreationStart < puppyCreationStart, "event is created before puppy IDs");

assertIncludes(
  breedingService,
  'status: "PREGNANT",\n        dueEpoch:',
  "due resolver continues to select only PREGNANT attempts"
);
assertIncludes(
  breedingService,
  'in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"]',
  "reproductive emergency counts as an active breeding conflict"
);
assertIncludes(
  eligibilityService,
  '"REPRODUCTIVE_EMERGENCY"',
  "eligibility recognizes the unresolved state"
);
assertIncludes(
  dogService,
  'label: "Reproductive Emergency"',
  "dog reproductive snapshot is not shown as open"
);
assertIncludes(
  lifecycleService,
  'in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"]',
  "lifecycle failure handling includes unresolved reproductive emergencies"
);
assertIncludes(
  noticeService,
  "REPRODUCTIVE_EMERGENCY_NOTICE:",
  "notice source key is stable"
);
assertIncludes(
  noticeService,
  "Litter resolution is paused while emergency veterinary care is required.",
  "notice communicates a pending complication without declaring an outcome"
);

console.log("Reproductive emergency trigger source checks passed.");
