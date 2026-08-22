import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const breeding = read("apps/web/server/services/breeding.service.ts");
const route = read("apps/web/app/api/stud-contract-return-services/[returnServiceId]/attempt/route.ts");
const returnService = read("apps/web/server/services/studContractReturnService.service.ts");

for (const fragment of [
  "attemptStudContractReturnService",
  "returnServiceId: args.returnServiceId",
  'include: { contract: { include: { healthRequirements: true } } }',
  'returnService.status === "USED"',
  'returnService.status === "EXPIRED"',
  'returnService.status === "EXTINGUISHED"',
  '"This Return Service ended because the sire changed kennels."',
  '"This Return Service ended because the dam died."',
  'returnService.expiresAt <= new Date()',
  'data: { status: "EXPIRED" }',
  "returnService.contract.damKennelId !== kennelId",
  "returnService.contract.sireDogId !== sire.id",
  "returnService.contract.damDogId !== dam.id",
  "freshSire.ownerKennelId !== returnServiceContract.sireKennelId",
  "freshDam.ownerKennelId !== (returnServiceContract?.damKennelId ?? kennelId)",
  "assertDamMeetsStudContractRequirements",
  "returnServiceContract.healthRequirements",
  "returnServiceContract.brucellosisNegativeRequired",
  'studFeeAmount: returnServiceContract ? 0 : studFeeAmount',
  'status: "USED", usedAt, returnBreedingAttemptId: createdAttempt.id',
  'where: { id: args.returnServiceId, status: "AVAILABLE", expiresAt: { gt: usedAt } }',
]) assert.ok(breeding.includes(fragment), fragment);

assert.equal(breeding.includes("returnServiceContract ? await tx.studOffer"), false);
assert.equal(breeding.includes("returnBreedingAttemptId: createdAttempt.id") && breeding.includes("breedingAttemptId: createdAttempt.id"), true);
assert.equal(returnService.includes("createBreedingAttempt"), false);
assert.ok(route.includes("getSessionUserId"));
assert.ok(route.includes("attemptStudContractReturnService"));
assert.equal(route.includes("sireDogId"), false);
assert.equal(route.includes("damDogId"), false);

console.log("Stud Contract Return Service exercise checks passed.");
