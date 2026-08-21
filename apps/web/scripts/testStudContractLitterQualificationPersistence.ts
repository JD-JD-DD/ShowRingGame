import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const schema = readFileSync(join(root, "apps/web/prisma/schema.prisma"), "utf8");
const migration = readFileSync(join(root, "apps/web/prisma/migrations/20260823120000_add_stud_contract_litter_qualification/migration.sql"), "utf8");
for (const field of [
  "litterId                    String?              @unique",
  "qualificationCheckpointAt   DateTime?",
  "qualifyingSurvivingPuppyCount Int?",
  "puppyBackMinimumMet         Boolean?",
  "smallLitterReturnServiceMet Boolean?",
  'litter             Litter?                         @relation("StudContractLitter"',
  'studContract    StudContract?    @relation("StudContractLitter")',
]) assert.ok(schema.includes(field), field);
for (const column of [
  '"litterId" TEXT',
  '"qualificationCheckpointAt" TIMESTAMP(3)',
  '"qualifyingSurvivingPuppyCount" INTEGER',
  '"puppyBackMinimumMet" BOOLEAN',
  '"smallLitterReturnServiceMet" BOOLEAN',
]) assert.ok(migration.includes(column), column);
assert.ok(migration.includes('CREATE UNIQUE INDEX "StudContract_litterId_key"'));
console.log("Stud Contract litter qualification persistence checks passed.");
