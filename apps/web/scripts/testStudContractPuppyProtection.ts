import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const protection = read("apps/web/server/services/studContractPuppyProtection.service.ts");
const lifecycle = read("apps/web/server/services/studContractLifecycle.service.ts");

for (const status of ['"WAITING"', '"DAM_FIRST_PICK"', '"STUD_PICK"', '"SELECTED"']) {
  assert.ok(protection.includes(status), `active protection state ${status}`);
}
for (const status of ['"FORFEITED"', '"UNFULFILLABLE"', '"COMPLETED"']) {
  assert.ok(!protection.includes(status), `resolved state ${status} must not be protected`);
}

assert.ok(protection.includes('selection.status === "DAM_FIRST_PICK"'));
assert.ok(protection.includes('dog.id !== selection.damFirstPickDogId'));
assert.ok(protection.includes('selection.contract.puppySex === "EITHER"'));
assert.ok(protection.includes('selection.status === "SELECTED" && selection.selectedDogId === dog.id'));
assert.ok(protection.includes('dog.lifecycleState !== "ALIVE"'));
assert.ok(!protection.includes('turnDeadlineAt'));
assert.ok(!protection.includes('bornEpoch'));
assert.ok(!protection.includes('Day 8'));
assert.ok(lifecycle.includes('turnDeadlineAt: { not: null, lte: now }'));

for (const path of [
  "apps/web/server/services/market.service.ts",
  "apps/web/server/services/rehome.service.ts",
  "apps/web/server/services/accountClosure.service.ts",
]) {
  assert.ok(read(path).includes("ProtectedByStudContractSelection"), path);
}

for (const path of [
  "apps/web/app/api/dogs/[dogId]/call-name/route.ts",
  "apps/web/app/api/dogs/[dogId]/rename/route.ts",
  "apps/web/server/services/kennelRunManagement.service.ts",
]) {
  assert.equal(read(path).includes("ProtectedByStudContractSelection"), false, path);
}
assert.equal(protection.includes('action: "named"'), false);

console.log("Stud Contract puppy protection checks passed.");
