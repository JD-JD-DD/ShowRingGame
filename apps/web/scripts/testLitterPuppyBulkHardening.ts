import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const naming = readFileSync("server/services/litterBulkNaming.service.ts", "utf8");
const move = readFileSync("server/services/litterBulkKennelRun.service.ts", "utf8");
const sale = readFileSync("server/services/litterBulkSale.service.ts", "utf8");
const rehome = readFileSync("server/services/litterBulkRehome.service.ts", "utf8");
const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");

for (const [action, source] of [["Name", naming], ["Move", move], ["Sale", sale], ["Re-home", rehome]] as const) {
  assert.match(source, /litter\.bredByKennelId !== args\.kennelId/, `${action} rejects unauthorized litter access as a whole-request error`);
  assert.match(source, /dog\.litterId !== litter\.id/, `${action} revalidates litter membership`);
  assert.match(source, /dog\.ownerKennelId !== args\.kennelId/, `${action} revalidates current ownership`);
  assert.match(source, /lifecycleState !== "ALIVE"/, `${action} skips structurally stale puppies`);
}

assert.match(naming, /db\.\$transaction/, "Name uses one transaction for its affected cohort");
assert.match(naming, /updateDogNaming\(/, "Name uses the canonical naming seam");
assert.match(naming, /error\.status === 403 \|\| error\.status === 404/, "only stale naming authorization races become skips");
assert.match(move, /targetRun\.kennelId !== args\.kennelId/, "Move treats invalid shared destination as an error");
assert.match(move, /dog\.kennelRunId === targetRun\.id/, "Move recognizes same-target no-op skips");
assert.match(move, /affectedDogIds\.length === 0/, "Move returns a zero-affected skip result without mutation");
assert.match(move, /moveDogsToKennelRun\(/, "Move calls the canonical service once after filtering");
assert.doesNotMatch(move, /catch \(error\)/, "Move does not convert canonical execution failures into skips");
assert.match(sale, /getDogSaleEligibility\(/, "Sale preflight and execution use canonical eligibility");
assert.match(sale, /affectedUpdates\.length === 0/, "Sale returns a zero-affected skip result without mutation");
assert.match(sale, /bulkListDogsForSale\(/, "Sale calls canonical bulk listing once after filtering");
assert.doesNotMatch(sale, /dogListing\.|marketState:|ledgerTransaction/, "Sale wrapper has no direct market or ledger write");
assert.match(rehome, /getDogRehomeEligibility\(/, "Re-home uses canonical eligibility");
assert.match(rehome, /affectedDogIds\.length === 0/, "Re-home returns a zero-affected skip result without mutation");
assert.match(rehome, /rehomeOwnedDogs\(/, "Re-home calls the canonical batch once after filtering");
assert.doesNotMatch(rehome, /lifecycleState:\s*"TRANSFERRED"|ownerKennelId:\s*null|kennelRunId:\s*null|marketState:|dogListing\.|ledgerTransaction/, "Re-home wrapper has no direct canonical side effect");

for (const title of ["Names updated", "Kennel run updated", "Sale listings created", "Puppy re-homed"]) {
  assert.match(client, new RegExp(title), `parent result state includes the ${title} status title`);
}
assert.match(client, /role="status"/, "partial-success results are semantic statuses");
assert.match(client, /rehomeResult[\s\S]*selectedPuppies\.length > 0/, "Re-home result remains outside the selection-gated action area");

console.log("Litter puppy bulk hardening checks passed.");
