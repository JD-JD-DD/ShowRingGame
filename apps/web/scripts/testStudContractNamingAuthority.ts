import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const protection = read("apps/web/server/services/studContractPuppyProtection.service.ts");
const callName = read("apps/web/app/api/dogs/[dogId]/call-name/route.ts");
const registeredName = read("apps/web/app/api/dogs/[dogId]/rename/route.ts");
const bulkNaming = read("apps/web/server/services/kennelRunManagement.service.ts");
const transfer = read("apps/web/server/services/studContractLifecycle.service.ts");

assert.equal(protection.includes('action: "named"'), false);
for (const source of [callName, registeredName, bulkNaming]) {
  assert.equal(source.includes("ProtectedByStudContractSelection"), false);
}
assert.ok(callName.includes("dog.ownerKennelId !== kennel.id"));
assert.ok(registeredName.includes("dog.ownerKennelId !== kennel.id"));
assert.ok(bulkNaming.includes("dog.ownerKennelId !== args.kennelId"));
assert.ok(callName.includes("validateCallName"));
assert.ok(registeredName.includes("validateRegisteredDogName"));
assert.ok(bulkNaming.includes("validateRegisteredDogName"));
for (const action of ["listed for sale", "rehomed", "transferred", "removed"]) {
  assert.ok(protection.includes(`"${action}"`), action);
}
const transferProcessor = transfer.slice(
  transfer.indexOf("export async function processDueStudContractPuppyTransfers"),
  transfer.indexOf("export async function processExpiredStudContractRequests")
);
assert.ok(transferProcessor.includes('data: { ownerKennelId: destinationKennel.id, kennelRunId: destinationRun.id }'));

console.log("Stud Contract naming authority checks passed.");
