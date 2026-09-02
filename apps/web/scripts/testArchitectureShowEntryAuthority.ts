import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd().endsWith(join("apps", "web"))
  ? resolve(process.cwd(), "..", "..")
  : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const showEntry = source("apps/web/server/services/showEntry.service.ts");
const judging = source("apps/web/server/services/judging.service.ts");

function section(start: string, end: string): string {
  const from = showEntry.indexOf(start);
  const to = showEntry.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `expected ${start} service section`);
  return showEntry.slice(from, to);
}

const singleMutation = section("export async function createShowEntry", "export async function pullShowEntry");
const bulkMutation = section("export async function createShowEntriesForCluster", "export async function seedTestEntriesForShow");
const transactionEntry = section("async function createShowEntryWithTx", "export async function createShowEntry");

assert.match(transactionEntry, /canEnterShowBlock\(\{ dog, block, currentEpoch \}\)/, "single entry revalidates eligibility inside its transaction seam");
assert.match(transactionEntry, /assertDogHasNoPendingVeterinaryCare\(dog\.id, tx\)/, "single entry revalidates current care state");
assert.match(singleMutation, /return db\.\$transaction\(async \(tx\)/, "single entry uses server-side transactional mutation");
assert.match(singleMutation, /createShowEntryWithTx\(/, "single entry delegates to the revalidating transaction seam");
assert.match(bulkMutation, /return await db\.\$transaction\(async \(tx\)/, "bulk entry uses a server transaction");
assert.match(bulkMutation, /const dogs = await tx\.dog\.findMany/, "bulk entry reloads current Dog records rather than trusting planner DTOs");
assert.match(bulkMutation, /dog\.ownerKennelId !== kennelId/, "bulk entry revalidates current ownership");
assert.match(bulkMutation, /getShowDayEntryEligibilityReason\(/, "bulk entry rechecks current day and Dog eligibility");
assert.match(bulkMutation, /getShowDayEntryAvailability\(/, "bulk entry rechecks current entry-window availability");
assert.match(judging, /getBlockJudgingEntryDisposition\(/, "judging retains its separate event-time eligibility/disposition recheck");

console.log("ARCH-GUARD-001 show-entry authority checks passed.");
