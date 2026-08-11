import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const litterService = readFileSync("server/services/litter.service.ts", "utf8");
const breedingService = readFileSync("server/services/breeding.service.ts", "utf8");
const breedingCron = readFileSync(
  "app/api/cron/resolve-breeding-progress/route.ts",
  "utf8"
);
const emergencyJob = readFileSync(
  "app/api/jobs/process-emergency-vet-care/route.ts",
  "utf8"
);
const vercelConfig = readFileSync("vercel.json", "utf8");

const listSection = litterService.slice(
  litterService.indexOf("export async function listLittersForKennel"),
  litterService.indexOf("export async function getLitterForKennel")
);
const detailSection = litterService.slice(
  litterService.indexOf("export async function getLitterForKennel")
);

for (const [section, label] of [
  [listSection, "litter list"],
  [detailSection, "litter detail"],
] as const) {
  assert.doesNotMatch(
    section,
    /resolve(?:Due)?BreedingProgressForKennel|resolveDueBreedingProgress\(/,
    `${label} must not advance breeding progression`
  );
}

assert.match(
  litterService,
  /return loadLitterListPageForKennel\(args\);/,
  "pagination remains a direct read-only list query"
);
assert.match(
  listSection,
  /listBreedingsForKennelAfterProgressResolved\(\{ kennelId, currentEpoch \}\)/,
  "active breeding UI reads the persisted breeding state"
);

assert.match(
  breedingCron,
  /resolveDueBreedingProgressBatch/,
  "scheduled breeding cron owns due progression"
);
assert.ok(
  breedingCron.includes('request.headers.get("Authorization")') &&
    breedingCron.includes("process.env.CRON_SECRET") &&
    breedingCron.includes("authHeader !== `Bearer ${cronSecret}`"),
  "scheduled breeding cron requires CRON_SECRET authorization"
);
assert.match(
  vercelConfig,
  /"path": "\/api\/cron\/resolve-breeding-progress",\s*"schedule": "0 \* \* \* \*"/,
  "production scheduler invokes breeding progression hourly"
);
assert.match(
  breedingService,
  /status: "INITIATED"[\s\S]*pregCheckEpoch:[\s\S]*lte: currentEpoch/,
  "batch progression resolves due pregnancy checks"
);
assert.match(
  breedingService,
  /status: "PREGNANT"[\s\S]*dueEpoch:[\s\S]*lte: currentEpoch/,
  "batch progression resolves due whelps and emergency creation"
);
assert.match(
  breedingService,
  /fresh\.checkedEpoch !== null/,
  "pregnancy checks remain idempotent"
);
assert.match(
  breedingService,
  /fresh\.whelpedEpoch !== null \|\|\s*fresh\.litterId !== null/,
  "whelping remains idempotent"
);
assert.match(
  emergencyJob,
  /processExpiredReproductiveEmergencyEvents[\s\S]*processAuthorizedReproductiveEmergencyEvents/,
  "scheduled emergency job resolves pending and authorized reproductive emergencies"
);

console.log("Litter read-only progression checks passed.");
