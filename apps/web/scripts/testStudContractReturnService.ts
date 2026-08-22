import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const schema = read("apps/web/prisma/schema.prisma");
const migration = read("apps/web/prisma/migrations/20260826120000_add_stud_contract_return_service/migration.sql");
const service = read("apps/web/server/services/studContractReturnService.service.ts");
const breeding = read("apps/web/server/services/breeding.service.ts");
const lifecycle = read("apps/web/server/services/lifecycle.service.ts");

for (const fragment of [
  "enum StudContractReturnServiceStatus",
  "AVAILABLE",
  "USED",
  "EXPIRED",
  "EXTINGUISHED",
  "enum StudContractReturnServiceTrigger",
  "NO_LITTER",
  "SMALL_LITTER",
  "model StudContractReturnService",
  "contractId              String                                       @unique",
  "returnBreedingAttemptId String?                                      @unique",
  "returnService      StudContractReturnService?      @relation",
]) assert.ok(schema.includes(fragment), fragment);

for (const fragment of [
  'CREATE TABLE "StudContractReturnService"',
  'CREATE UNIQUE INDEX "StudContractReturnService_contractId_key"',
  'CREATE TYPE "StudContractReturnServiceStatus"',
  'CREATE TYPE "StudContractReturnServiceTrigger"',
]) assert.ok(migration.includes(fragment), fragment);

for (const fragment of [
  "STUD_CONTRACT_RETURN_SERVICE_DURATION_MS = 60 * 24 * 60 * 60 * 1000",
  "studContractReturnService.upsert",
  "where: { contractId: args.contractId }",
  "update: {}",
  'trigger: "NO_LITTER"',
  'trigger: "SMALL_LITTER"',
  "qualification.smallLitterReturnServiceMet === true",
  'resolved.status === "CHECKED_NOT_PREGNANT"',
  'status: "FAILED"',
]) assert.ok(`${service}\n${breeding}\n${lifecycle}`.includes(fragment), fragment);

assert.equal(service.includes("studOffer"), false);
assert.equal(service.includes("ledger"), false);
assert.equal(service.includes("breedingAttempt.create"), false);
assert.equal(breeding.includes("createStudContractReturnService") && lifecycle.includes("createStudContractReturnService"), true);

console.log("Stud Contract Return Service persistence and trigger checks passed.");
