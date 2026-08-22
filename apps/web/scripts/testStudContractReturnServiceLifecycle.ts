import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const schema = read("apps/web/prisma/schema.prisma");
const migration = read("apps/web/prisma/migrations/20260826130000_add_stud_contract_return_service_extinguishment_reasons/migration.sql");
const returnService = read("apps/web/server/services/studContractReturnService.service.ts");
const lifecycle = read("apps/web/server/services/studContractLifecycle.service.ts");
const dogLifecycle = read("apps/web/server/services/lifecycle.service.ts");
const market = read("apps/web/server/services/market.service.ts");
const rehome = read("apps/web/server/services/rehome.service.ts");
const accountClosure = read("apps/web/server/services/accountClosure.service.ts");
const emergencyResolution = read("apps/web/server/services/reproductiveEmergencyResolution.service.ts");
const cron = read("apps/web/app/api/cron/process-stud-contract-lifecycle/route.ts");

for (const value of ["SIRE_OWNERSHIP_CHANGED", "DAM_OWNERSHIP_CHANGED", "SIRE_DIED", "DAM_DIED"]) {
  assert.ok(schema.includes(value), value);
  assert.ok(migration.includes(`ADD VALUE IF NOT EXISTS '${value}'`), value);
}

for (const fragment of [
  "extinguishStudContractReturnServicesForDog",
  'where: { status: "AVAILABLE", contract: { sireDogId: args.dogId } }',
  'where: { status: "AVAILABLE", contract: { damDogId: args.dogId } }',
  'status: "EXTINGUISHED"',
  "processExpiredStudContractReturnServices",
  'where: { status: "AVAILABLE", expiresAt: { lte: now } }',
  'where: { id: candidate.id, status: "AVAILABLE", expiresAt: { lte: now } }',
  'data: { status: "EXPIRED" }',
]) assert.ok(`${returnService}\n${lifecycle}`.includes(fragment), fragment);

assert.ok(dogLifecycle.includes('sireReason: "SIRE_DIED"'));
assert.ok(dogLifecycle.includes('damReason: "DAM_DIED"'));
assert.ok(market.includes('sireReason: "SIRE_OWNERSHIP_CHANGED"'));
assert.ok(market.includes('damReason: "DAM_OWNERSHIP_CHANGED"'));
assert.ok(rehome.includes('sireReason: "SIRE_OWNERSHIP_CHANGED"'));
assert.ok(rehome.includes('damReason: "DAM_OWNERSHIP_CHANGED"'));
assert.ok(accountClosure.includes('lifecycleState: "RETIRED"'));
assert.ok(accountClosure.includes('sireReason: "PERMANENT_BREEDING_INELIGIBILITY"'));
assert.ok(emergencyResolution.includes('consequence === "PERMANENT_BREEDING_RESTRICTION"'));
assert.ok(emergencyResolution.includes('damReason: "PERMANENT_BREEDING_INELIGIBILITY"'));
assert.ok(cron.includes("processExpiredStudContractReturnServices"));

assert.equal(returnService.includes("isBreedingActive"), false);
assert.equal(returnService.includes("studOffer"), false);
assert.equal(returnService.includes("ledger"), false);

console.log("Stud Contract Return Service lifecycle checks passed.");
