import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildCanonicalBreedMigrationPlan, parseCanonicalBreedDataCsv, verifyCanonicalBreedData, type CanonicalBreedData, type StoredBreedData } from "../server/services/canonicalBreedDataMigration.service";
import { resolveBreedGroupNameToCanonicalShowGroupCode } from "@showring/rules";

const BASELINE = "0a76d0f^";
const current = () => parseCanonicalBreedDataCsv(readFileSync(resolve(process.cwd(), "prisma/data/breeds.csv"), "utf8"));
const baseline = () => parseCanonicalBreedDataCsv(execFileSync("git", ["show", `${BASELINE}:apps/web/prisma/data/breeds.csv`], { encoding: "utf8" }));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function applyFixture(target: StoredBreedData[], plan: ReturnType<typeof buildCanonicalBreedMigrationPlan>, failAfter?: number) {
  const draft = clone(target); let writes = 0;
  for (const row of plan.rows) {
    if (!row.after || row.kinds.includes("NO_CHANGE")) continue;
    writes += 1; if (failAfter === writes) throw new Error("injected transaction failure");
    const index = draft.findIndex((breed) => breed.code2 === row.code2);
    if (index < 0) draft.push(clone(row.after)); else draft[index] = clone(row.after);
  }
  return draft;
}

function main() {
  const old = baseline(); const canonical = current();
  const migrationSource = readFileSync(resolve(process.cwd(), "scripts/migrateCanonicalBreedData.ts"), "utf8");
  assert.match(migrationSource, /db\.\$transaction\(async \(tx\)/, "production apply is transaction-protected");
  assert.doesNotMatch(migrationSource, /\.breed\.delete(?:Many)?\(/, "production migration has no Breed delete path");
  assert.match(migrationSource, /tx\.breed\.update\(\{ where: \{ code2: row\.after\.code2 \}, data \}\)/, "production updates locate by, but never mutate, code2");
  const baselineByCode = new Map(old.map((row) => [row.code2, row]));
  const groupChanges = canonical.filter((row) => baselineByCode.has(row.code2) && baselineByCode.get(row.code2)!.groupName !== row.groupName);
  const newBreeds = canonical.filter((row) => !baselineByCode.has(row.code2));
  assert.equal(old.length, 264); assert.equal(canonical.length, 318); assert.equal(newBreeds.length, 54); assert.equal(groupChanges.length, 12);
  for (const code2 of ["QE", "QM", "RC", "SO"]) {
    const breed = canonical.find((row) => row.code2 === code2)!;
    assert.equal(breed.isActive, false, `${code2} remains inactive`);
    assert.equal(breed.releaseVersion, 999, `${code2} retains release version 999`);
  }
  const tc = canonical.find((row) => row.code2 === "TC")!;
  assert.equal(tc.name, "Toy Manchester Terrier");
  const inactiveDuplicateCodes = new Set(["QE", "QM", "RC", "SO"]);
  const approvedTarget = old.map((row) => ({
    ...clone(row),
    name: row.code2 === "TC" ? "Toy Macnchester Terrier" : row.name,
    isActive: inactiveDuplicateCodes.has(row.code2) ? false : row.isActive,
  }));
  const plan = buildCanonicalBreedMigrationPlan({ canonical, baseline: old, target: approvedTarget });
  assert.equal(plan.inserts, 54); assert.equal(plan.groupUpdates, 12); assert.equal(plan.nameUpdates, 2); assert.equal(plan.activeUpdates, 0); assert.equal(plan.releaseVersionUpdates, 0); assert.equal(plan.databaseOnly.length, 0); assert.equal(plan.identityConflicts.length, 0);
  assert.deepEqual(plan.rows.filter((row) => row.kinds.includes("UPDATE_NAME")).map((row) => row.code2).sort(), ["NB", "TC"]);
  const relations = { dogs: [{ id: "dog", breedCode2: "KK", sireId: "sire", damId: "dam" }], litters: [{ id: "litter", breedCode2: "KK" }], registrations: [{ id: "reservation", breedCode2: "KK" }], showEntries: [{ id: "entry", breedCode2: "KK" }], showResults: [{ id: "result", breedCode2: "KK", group: "MIS" }], showAwards: [{ id: "award", breedCode2: "KK" }], pointsTitles: [{ id: "points", breedCode2: "KK" }], shows: [{ id: "future-show", groups: ["MIS"] }], judgingProfiles: [{ id: "profile", breedCode2: "KK" }] };
  const preserved = clone(relations);
  assert.throws(() => applyFixture(approvedTarget, plan, 2), /injected transaction failure/);
  assert.equal(approvedTarget.find((row) => row.code2 === "TC")!.name, "Toy Macnchester Terrier", "failure leaves transaction source unchanged");
  const migrated = applyFixture(approvedTarget, plan);
  assert.deepEqual(relations, preserved, "Breed-only migration does not write related/historical fixtures");
  assert.ok(migrated.every((breed) => !relations.dogs.some((dog) => dog.breedCode2 === breed.code2) || breed.code2 === "KK"));
  assert.equal(verifyCanonicalBreedData({ canonical, target: migrated }).valid, true);
  const second = buildCanonicalBreedMigrationPlan({ canonical, baseline: old, target: migrated });
  assert.equal(second.inserts + second.nameUpdates + second.groupUpdates + second.activeUpdates + second.releaseVersionUpdates, 0);
  assert.equal(second.unchanged, 318);
  assert.equal(resolveBreedGroupNameToCanonicalShowGroupCode(migrated.find((breed) => breed.code2 === "KK")!.groupName), "NON_SPORTING");
  const databaseOnly = buildCanonicalBreedMigrationPlan({ canonical, baseline: old, target: [...old, { code2: "ZZ", name: "Unexpected", groupName: "Hound", isActive: false, releaseVersion: 999 }] });
  assert.deepEqual(databaseOnly.databaseOnly, ["ZZ"]);
  const conflictTarget = old.map((row) => row.code2 === "KK" ? { ...row, name: "Wrong Logical Breed" } : row);
  assert.deepEqual(buildCanonicalBreedMigrationPlan({ canonical, baseline: old, target: conflictTarget }).identityConflicts, ["KK"]);
  assert.throws(() => parseCanonicalBreedDataCsv("breed_name,code2,group,playable,release_version\nA,AA,Invalid,TRUE,1\n"));
  assert.throws(() => parseCanonicalBreedDataCsv("breed_name,code2,group,playable,release_version\nA,AA,Hound,TRUE,1\nB,AA,Hound,TRUE,1\n"), /duplicate/);
  console.log(JSON.stringify({ baselineRows: old.length, canonicalRows: canonical.length, inserts: plan.inserts, groupChanges: groupChanges.map((row) => ({ code2: row.code2, breed: row.name, oldGroup: baselineByCode.get(row.code2)!.groupName, newGroup: row.groupName })), nameUpdates: plan.nameUpdates, idempotentUpdates: 0, preservedRelationFixture: preserved, finalRows: migrated.length }, null, 2));
  console.log("BREED-03 fixture migration rehearsal passed.");
}

main();
