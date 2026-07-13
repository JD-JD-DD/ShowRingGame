import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

function assertExcludes(haystack: string, needle: string, label: string): void {
  assert.ok(!haystack.includes(needle), label);
}

const mineRoute = source("apps/web/app/api/dogs/mine/route.ts");
const breedingService = source("apps/web/server/services/breeding.service.ts");
const dogProfileService = source("apps/web/server/services/dog.service.ts");
const cronRoute = source("apps/web/app/api/cron/resolve-breeding-progress/route.ts");
const plannerRoute = source("apps/web/app/api/kennel/program-planner/route.ts");
const lifecycleService = source("apps/web/server/services/lifecycle.service.ts");
const vercelConfig = source("apps/web/vercel.json");
const healthBatchingTest = source(
  "apps/web/scripts/testPhenotypeHealthTruthBatching.ts"
);

assertIncludes(
  breedingService,
  "export async function resolveDueBreedingProgressForKennel(",
  "breeding service exposes a kennel-scoped due-breeding resolver without the full maintenance bundle"
);
assertIncludes(
  breedingService,
  "await resolveDogDeaths({ kennelId, currentEpoch });",
  "full kennel breeding resolver still preserves death resolution for authoritative non-roster callers"
);
assertIncludes(
  breedingService,
  "return resolveDueBreedingProgress({\n    kennelId: args.kennelId,\n    currentEpoch: args.currentEpoch,\n  });",
  "new kennel due-breeding helper stays narrowly scoped to due attempts"
);
assertIncludes(
  breedingService,
  'status: "INITIATED"',
  "due breeding resolution still covers pregnancy-check transitions"
);
assertIncludes(
  breedingService,
  'status: "PREGNANT"',
  "due breeding resolution still covers whelping transitions"
);
assertIncludes(
  breedingService,
  "fresh.checkedEpoch !== null",
  "pregnancy-check resolution remains idempotent once checked"
);
assertIncludes(
  breedingService,
  "fresh.whelpedEpoch !== null ||\n      fresh.litterId !== null",
  "whelp resolution remains idempotent once litter creation has happened"
);
assertIncludes(
  breedingService,
  'status: "WHELPED"',
  "whelp resolution still persists the canonical post-whelp status"
);

assertIncludes(
  mineRoute,
  "resolveDueBreedingProgressForKennel",
  "kennel roster uses the narrow due-breeding fallback"
);
assertExcludes(
  mineRoute,
  "resolveBreedingProgressForKennel({ kennelId: kennel.id, currentEpoch })",
  "kennel roster no longer runs the full kennel breeding maintenance helper"
);
assertExcludes(
  mineRoute,
  "resolveDogDeaths(",
  "kennel roster no longer triggers whole-kennel death maintenance directly"
);
assertIncludes(
  mineRoute,
  'await perf.measure("resolveDueBreedingMs"',
  "kennel roster still measures the remaining read-time breeding fallback"
);
assertIncludes(
  mineRoute,
  'await perf.measure("dtoMappingMs"',
  "kennel roster measures DTO mapping separately"
);
assertIncludes(
  mineRoute,
  '"payloadSerializationMs"',
  "kennel roster measures payload serialization separately"
);

assertIncludes(
  dogProfileService,
  'resolveDogDeaths({ currentEpoch, dogIds: [dogId] })',
  "dog page remains an authoritative narrow death-resolution fallback"
);
assertIncludes(
  dogProfileService,
  "resolveBreedingProgressForOwnedDam({",
  "dog page remains an authoritative narrow breeding fallback for owned dams"
);
assertIncludes(
  dogProfileService,
  'await measure("resolveBreedingProgressMs"',
  "dog page continues to time the owned-dam breeding fallback"
);
assertIncludes(
  plannerRoute,
  "await resolveDogDeaths({ kennelId: kennel.id, currentEpoch });",
  "program planner keeps its explicit kennel death-resolution trigger"
);
assertIncludes(
  plannerRoute,
  "resolveDueBreedingProgressForKennel",
  "program planner reuses the narrow kennel due-breeding resolver after explicit death resolution"
);

assertIncludes(
  cronRoute,
  "resolveDueBreedingProgressBatch",
  "breeding cron remains the authoritative batch resolver for due attempts"
);
assertIncludes(
  cronRoute,
  "const DEFAULT_BATCH_LIMIT = 50",
  "breeding cron keeps the bounded default batch size"
);
assertIncludes(
  cronRoute,
  "const MAX_BATCH_LIMIT = 100",
  "breeding cron keeps the bounded max batch size"
);
assertIncludes(
  vercelConfig,
  '"path": "/api/cron/resolve-breeding-progress"',
  "Vercel cron still schedules breeding progress resolution"
);
assertIncludes(
  vercelConfig,
  '"schedule": "0 * * * *"',
  "Vercel cron cadence for breeding resolution remains unchanged"
);

assertIncludes(
  lifecycleService,
  "const update = await client.dog.updateMany({",
  "death resolution still finalizes dogs through an idempotent updateMany gate"
);
assertIncludes(
  lifecycleService,
  "if (update.count === 0) {",
  "death resolution still short-circuits repeated finalization attempts"
);
assertIncludes(
  lifecycleService,
  'type: "DOG_DEATH"',
  "death resolution still emits canonical dog-death notices"
);

assertIncludes(
  mineRoute,
  'label: "Pending Pregnancy Confirmation"',
  "kennel roster still exposes the persisted pending-pregnancy label"
);
assertIncludes(
  mineRoute,
  'label: "Pregnant"',
  "kennel roster still exposes the persisted pregnancy label"
);
assertIncludes(
  mineRoute,
  'label: "Post-Whelp Rest"',
  "kennel roster still exposes the persisted post-whelp cooldown label"
);

assertIncludes(
  healthBatchingTest,
  "Phenotype health truth batching checks passed.",
  "Stage 1 phenotype health batching coverage remains present"
);

console.log("Kennel roster maintenance path checks passed.");
