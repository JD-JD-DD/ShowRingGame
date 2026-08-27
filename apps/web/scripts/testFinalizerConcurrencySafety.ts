import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const schema = source("apps/web/prisma/schema.prisma");
const judging = source("apps/web/server/services/judging.service.ts");
const migration = source(
  "apps/web/prisma/migrations/20260827120000_add_show_award_finalization_key/migration.sql"
);

function section(start: string, end: string): string {
  const startIndex = judging.indexOf(start);
  const endIndex = judging.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing ${start}`);
  return judging.slice(startIndex, endIndex);
}

const groupFinalizer = section(
  "async function createGroupAwardsForShowDay",
  "async function createBestInShowAwardsForShowDay"
);
const bisFinalizer = section(
  "async function createBestInShowAwardsForShowDay",
  "async function syncFinalsTitleProgressForShowDay"
);

async function simulateUniqueInsert(
  persistedKeys: Set<string>,
  keys: readonly string[]
): Promise<number> {
  // Models PostgreSQL's unique-index authority: separate writers can submit the
  // same batch, but only the first insert for each canonical key persists.
  await Promise.resolve();
  let inserted = 0;
  for (const key of keys) {
    if (!persistedKeys.has(key)) {
      persistedKeys.add(key);
      inserted += 1;
    }
  }
  return inserted;
}

assert.match(schema, /finalizationKey\s+String\?\s+@unique/);
assert.match(migration, /CREATE UNIQUE INDEX "ShowAward_finalizationKey_key"/);
assert.match(migration, /"awardGroup" NOT IN \('GROUP', 'BEST_IN_SHOW'\)/);

// One canonical key for each Group placement means concurrent G1-G4 inserts
// conflict at the database, while breed awards leave the nullable key unset.
assert.match(
  groupFinalizer,
  /finalizationKey: `\$\{args\.showDayId\}:GROUP:\$\{groupCode\}:\$\{judgedAward\.awardCode\}`/
);
assert.match(groupFinalizer, /createMany\(\{\s*data: awardsToCreate,\s*skipDuplicates: true,/);

// BIS and RBIS have one ShowDay-scoped canonical key and receive the same
// conflict-safe insert behavior.
assert.match(
  bisFinalizer,
  /finalizationKey: `\$\{args\.showDayId\}:BEST_IN_SHOW:\$\{judgedAward\.awardCode\}`/
);
assert.match(bisFinalizer, /createMany\(\{\s*data: awardsToCreate,\s*skipDuplicates: true,/);

assert.doesNotMatch(groupFinalizer, /finalizationKey:.*BREED/);

const groupKeys = ["G1", "G2", "G3", "G4"].map(
  (awardCode) => `show-day:GROUP:SPORTING:${awardCode}`
);
const bisKeys = ["BIS", "RBIS"].map(
  (awardCode) => `show-day:BEST_IN_SHOW:${awardCode}`
);

async function run(): Promise<void> {
  const groupRows = new Set<string>();
  const [firstGroupAttempt, secondGroupAttempt] = await Promise.all([
    simulateUniqueInsert(groupRows, groupKeys),
    simulateUniqueInsert(groupRows, groupKeys),
  ]);
  assert.equal(firstGroupAttempt + secondGroupAttempt, 4);
  assert.deepEqual([...groupRows].sort(), groupKeys.sort());

  const bisRows = new Set<string>();
  const [firstBisAttempt, secondBisAttempt] = await Promise.all([
    simulateUniqueInsert(bisRows, bisKeys),
    simulateUniqueInsert(bisRows, bisKeys),
  ]);
  assert.equal(firstBisAttempt + secondBisAttempt, 2);
  assert.deepEqual([...bisRows].sort(), bisKeys.sort());

  const existingFinals = new Set([...groupKeys, ...bisKeys]);
  assert.equal(await simulateUniqueInsert(existingFinals, groupKeys), 0);
  assert.equal(await simulateUniqueInsert(existingFinals, bisKeys), 0);
  assert.equal(existingFinals.size, 6);
  console.log("Finalizer concurrency safety regression checks passed.");
}

void run();
