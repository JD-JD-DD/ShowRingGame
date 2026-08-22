import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const schema = readFileSync(join(root, "apps/web/prisma/schema.prisma"), "utf8");
const migration = readFileSync(join(root, "apps/web/prisma/migrations/20260825120000_replace_stud_contract_day8_qualification/migration.sql"), "utf8");
for (const field of [
  "litterId                    String?              @unique",
  "whelpQualificationAt        DateTime?",
  "liveBornPuppyCount          Int?",
  "puppyBackMinimumMet         Boolean?",
  "smallLitterReturnServiceMet Boolean?",
  'litter             Litter?                         @relation("StudContractLitter"',
  'studContract    StudContract?    @relation("StudContractLitter")',
]) assert.ok(schema.includes(field), field);
for (const column of [
  '"litterId" TEXT',
  '"whelpQualificationAt" TIMESTAMP(3)',
  '"liveBornPuppyCount" INTEGER',
  '"puppyBackMinimumMet" BOOLEAN',
  '"smallLitterReturnServiceMet" BOOLEAN',
]) assert.ok(migration.includes(column), column);
assert.ok(migration.includes('CREATE UNIQUE INDEX "StudContract_litterId_key"'));
console.log("Stud Contract litter qualification persistence checks passed.");
