import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const schema = readFileSync(
  join(repoRoot, "apps/web/prisma/schema.prisma"),
  "utf8"
);
const migration = readFileSync(
  join(
    repoRoot,
    "apps/web/prisma/migrations/20260821120000_add_stud_contract_persistence/migration.sql"
  ),
  "utf8"
);

function requireSchema(fragment: string) {
  assert.ok(schema.includes(fragment), `schema contains ${fragment}`);
}

function requireMigration(fragment: string) {
  assert.ok(migration.includes(fragment), `migration contains ${fragment}`);
}

for (const [enumName, values] of [
  ["StudCompensationType", ["CASH", "PUPPY_BACK", "CASH_AND_PUPPY_BACK"]],
  ["StudPuppyPickPosition", ["FIRST", "SECOND"]],
  ["StudPuppySexRequirement", ["EITHER", "MALE", "FEMALE"]],
  ["StudApprovalMode", ["AUTOMATIC", "MANUAL"]],
  ["StudHealthRequirementLevel", ["NONE", "GREEN_OR_YELLOW", "GREEN_ONLY"]],
  ["StudTitleRequirement", ["NONE", "CH_OR_HIGHER", "GCH"]],
  ["StudOfferStatus", ["PUBLISHED", "RETIRED"]],
  ["StudContractStatus", ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"]],
] as const) {
  requireSchema(`enum ${enumName} {`);
  requireMigration(`CREATE TYPE "${enumName}"`);

  for (const value of values) {
    requireSchema(`  ${value}`);
    requireMigration(`'${value}'`);
  }
}

for (const field of [
  "sireDogId",
  "ownerKennelId",
  "status",
  "version",
  "compensationType",
  "cashAmount",
  "puppyPickPosition",
  "puppySex",
  "minimumLitterSize",
  "noLitterReturnService",
  "smallLitterReturnThreshold",
  "brucellosisNegativeRequired",
  "titleRequirement",
  "approvalMode",
  "publishedAt",
]) {
  requireSchema(`  ${field}`);
}

requireSchema("model StudOffer {");
requireSchema("@@unique([sireDogId, version])");
requireSchema("@@index([sireDogId, status])");
requireSchema("model StudOfferHealthRequirement {");
requireSchema("  healthTestCode   String");
requireSchema("@@unique([offerId, healthTestCode])");

requireSchema("model StudContract {");
for (const field of [
  "sourceOfferId",
  "sourceOfferVersion",
  "sireDogId",
  "damDogId",
  "sireKennelId",
  "damKennelId",
  "requestedAt",
  "approvalDeadlineAt",
  "acceptedAt",
  "declinedAt",
  "expiredAt",
  "breedingAttemptId           String?              @unique",
]) {
  requireSchema(`  ${field}`);
}
requireSchema("model StudContractHealthRequirement {");
requireSchema("@@unique([contractId, healthTestCode])");
requireSchema('@relation("StudContractBreedingAttempt"');

for (const constraint of [
  "StudOffer_sireDogId_version_key",
  "StudOfferHealthRequirement_offerId_healthTestCode_key",
  "StudContract_breedingAttemptId_key",
  "StudContractHealthRequirement_contractId_healthTestCode_key",
]) {
  requireMigration(constraint);
}

assert.equal(
  /ALTER TABLE "DogListing"|INSERT INTO "DogListing"|UPDATE "DogListing"/.test(
    migration
  ),
  false,
  "migration leaves legacy DogListing data and behavior untouched"
);
assert.equal(
  /INSERT INTO "StudOffer"|INSERT INTO "StudContract"/.test(migration),
  false,
  "migration does not seed or backfill offers or contracts"
);
assert.equal(schema.includes("ReturnServiceCredit"), false);
assert.equal(schema.includes("PuppySelection"), false);
assert.equal(schema.includes("StudContractTransfer"), false);

console.log("Stud contract persistence checks passed.");
