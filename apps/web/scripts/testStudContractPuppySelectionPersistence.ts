import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const schema = readFileSync(join(root, "apps/web/prisma/schema.prisma"), "utf8");
const migration = readFileSync(join(root, "apps/web/prisma/migrations/20260824120000_add_stud_contract_puppy_selection/migration.sql"), "utf8");
const service = readFileSync(join(root, "apps/web/server/services/studContractPuppySelection.service.ts"), "utf8");

for (const value of ["WAITING", "DAM_FIRST_PICK", "STUD_PICK", "SELECTED", "FORFEITED", "UNFULFILLABLE", "COMPLETED"]) {
  assert.ok(schema.includes(value), value);
}
for (const value of ["NONE", "DAM_OWNER", "STUD_OWNER"]) assert.ok(schema.includes(value), value);
for (const field of [
  "contractId               String                          @unique",
  "litterId                 String                          @unique",
  "turnStartedAt            DateTime?",
  "turnDeadlineAt           DateTime?",
  "damFirstPickDogId        String?                         @unique",
  "selectedDogId            String?                         @unique",
  "damFirstPickForfeitedAt  DateTime?",
  "studSelectionForfeitedAt DateTime?",
  "completedAt              DateTime?",
]) assert.ok(schema.includes(field), field);
assert.ok(schema.includes('StudContractPuppySelection?     @relation("StudContractPuppySelectionContract")'));
assert.ok(schema.includes('StudContractPuppySelection? @relation("StudContractPuppySelectionLitter")'));
assert.ok(schema.includes('@relation("StudContractPuppySelectionSelectedDog"'));
assert.ok(schema.includes('@relation("StudContractPuppySelectionDamFirstPickDog"'));
assert.ok(migration.includes('CREATE TABLE "StudContractPuppySelection"'));
assert.ok(migration.includes('"status" "StudContractPuppySelectionStatus" NOT NULL DEFAULT \'WAITING\''));
assert.ok(migration.includes('"currentActor" "StudContractPuppySelectionActor" NOT NULL DEFAULT \'NONE\''));
assert.ok(service.includes('contract.litterId !== args.litterId'));
assert.ok(service.includes('contract.qualificationCheckpointAt === null'));
assert.ok(service.includes('compensationType === "CASH"'));
assert.ok(service.includes('data: { contractId: args.contractId, litterId: args.litterId }'));
console.log("Stud Contract puppy selection persistence checks passed.");
