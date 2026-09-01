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
  const policy = ensureSource.indexOf("getFoundationPolicyForBreed({ breedCode2, currentEpoch })");
  const context = ensureSource.indexOf("resolveFoundationPopulationContext(breedCode2)");
  const initialRecheck = ensureSource.indexOf("getLockedFoundationInventoryState({ breedCode2 })");
  const create = ensureSource.indexOf("createOneFoundationDogForInventory");
  const finalRecheck = ensureSource.lastIndexOf("getLockedFoundationInventoryState({ breedCode2 })");
  assert.ok(policy < initialRecheck && context < initialRecheck, "policy and population context are prepared before the locked authoritative count");
  assert.ok(initialRecheck < create && create < finalRecheck, "refill creation occurs between short locked rechecks");
  assert.match(source, /async function createOneFoundationDogForInventory/, "inventory refills use a dedicated locked creation path");
  const inventoryCreateStart = indexOfOrFail("async function createOneFoundationDogForInventory");
  const inventoryCreateEnd = source.indexOf("export async function ensureFoundationInventoryForBreed", inventoryCreateStart);
  const inventoryCreateSource = source.slice(inventoryCreateStart, inventoryCreateEnd);
  assert.match(inventoryCreateSource, /const prepared = await prepareFoundationDog\(args\);[\s\S]*withFoundationInventoryBreedLock/, "identity, pricing, and profile preparation occur before the per-dog lock transaction");
  assert.match(inventoryCreateSource, /getFoundationInventoryCreateCount\([\s\S]*persistPreparedFoundationDog/, "each locked creation rechecks the current deficit before writing");
  assert.doesNotMatch(inventoryCreateSource, /db\.\$transaction/, "the per-dog locked transaction is not nested inside another global transaction");
  assert.match(source, /getFoundationInventoryCreateCount[\s\S]*targetInventory - args\.state\.currentCount/, "minimum replacement count still includes the total inventory deficit");
  assert.match(source, /countUnsoldFoundationFemalesByBreed\(args\.breedCode2, args\.tx\)/, "female count shares the authoritative transaction client");
  assert.match(source, /countUnsoldFoundationMalesByBreed\(args\.breedCode2, args\.tx\)/, "male count shares the authoritative transaction client");
  assert.doesNotMatch(source, /new Map\(|new Mutex|setTimeout\(/, "no in-memory lock or timing workaround was added");
  assert.match(source, /const FOUNDATION_DENSE_TARGET = 2/, "dense target remains 2");
  assert.match(source, /const FOUNDATION_THIN_TARGET = 4/, "thin target remains 4");
  assert.match(source, /const FOUNDATION_LISTING_HOURS = 7 \* SHOW_WEEK_HOURS/, "49-hour listing policy remains unchanged");
  console.log("Foundation inventory serialization contract checks passed.");
}

main();
