import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "server/services/foundationDog.service.ts"),
  "utf8"
);

function indexOfOrFail(needle: string): number {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `expected foundation inventory source to contain ${needle}`);
  return index;
}

function main() {
  const lockStart = indexOfOrFail("async function withFoundationInventoryBreedLock");
  const lockEnd = source.indexOf("export async function ensureFoundationInventoryForBreed", lockStart);
  const lockSource = source.slice(lockStart, lockEnd);
  assert.match(lockSource, /pg_advisory_xact_lock/, "automatic maintenance uses a PostgreSQL advisory lock");
  assert.match(lockSource, /hashtextextended\(\$\{args\.breedCode2\}, 0\)/, "lock identity is deterministic from canonical breedCode2");
  assert.match(lockSource, /\$transaction/, "advisory lock is transaction-scoped");

  const ensureStart = lockEnd;
  const ensureEnd = source.indexOf("export async function ensureFoundationInventoryForBreeds", ensureStart);
  const ensureSource = source.slice(ensureStart, ensureEnd);
  const acquire = ensureSource.indexOf("withFoundationInventoryBreedLock");
  const authoritativeCount = ensureSource.indexOf("countUnsoldFoundationDogsByBreed(breedCode2, tx)");
  const context = ensureSource.indexOf("resolveFoundationPopulationContext(breedCode2)");
  const create = ensureSource.indexOf("await createOneFoundationDog");
  assert.ok(acquire < authoritativeCount, "active inventory is counted only after the breed lock is acquired");
  assert.ok(authoritativeCount < context && context < create, "one context is resolved only for an actual post-lock replacement batch");
  assert.match(ensureSource, /Math\.max\(\s*targetInventory - currentCount,\s*femalesNeeded \+ malesNeeded/, "minimum replacement count still combines total and sex deficits");
  assert.match(ensureSource, /if \(createCount === 0\)/, "waiting callers with no post-lock deficit create nothing");
  assert.match(ensureSource, /countUnsoldFoundationFemalesByBreed\(breedCode2, tx\)/, "female count shares the authoritative transaction client");
  assert.match(ensureSource, /countUnsoldFoundationMalesByBreed\(breedCode2, tx\)/, "male count shares the authoritative transaction client");
  assert.doesNotMatch(source, /new Map\(|new Mutex|setTimeout\(/, "no in-memory lock or timing workaround was added");
  assert.match(source, /const FOUNDATION_DENSE_TARGET = 2/, "dense target remains 2");
  assert.match(source, /const FOUNDATION_THIN_TARGET = 4/, "thin target remains 4");
  assert.match(source, /const FOUNDATION_LISTING_HOURS = 7 \* SHOW_WEEK_HOURS/, "49-hour listing policy remains unchanged");
  console.log("Foundation inventory serialization contract checks passed.");
}

main();
