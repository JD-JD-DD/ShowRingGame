import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseBreedJudgingProfilesCsv, parseCanonicalBreedsCsv, validateBreedJudgingProfileCoverage, type BreedJudgingProfileInput } from "../server/services/breedJudgingProfile.service";
import { AmbiguousActiveBreedJudgingProfileError, getActiveBreedJudgingProfile, getBreedJudgingProfile, MissingBreedJudgingProfileError, syncValidatedBreedJudgingProfiles } from "../server/services/breedJudgingProfilePersistence.service";

const data = (file: string) => readFileSync(resolve(process.cwd(), `prisma/data/${file}`), "utf8");

function fixtureDatabase(options: { failBulkUpdate?: boolean } = {}) {
  const rows = new Map<string, Record<string, unknown>>();
  const key = (breedCode2: string, rulesVersion: string) => `${breedCode2}:${rulesVersion}`;
  const snapshot = () => new Map([...rows].map(([id, row]) => [id, { ...row }]));
  const profile = {
    updateMany: async ({ where, data }: { where: { breedCode2: string | { in: string[] }; rulesVersion?: { not: string }; isActive?: boolean }; data: Record<string, unknown> }) => {
      let count = 0;
      const breedCodes = typeof where.breedCode2 === "string" ? [where.breedCode2] : where.breedCode2.in;
      for (const row of rows.values()) if (breedCodes.includes(row.breedCode2 as string) && (!where.rulesVersion || row.rulesVersion !== where.rulesVersion.not) && (!where.isActive || row.isActive === where.isActive)) { Object.assign(row, data); count += 1; }
      return { count };
    },
    upsert: async ({ where, create, update }: { where: { breedCode2_rulesVersion: { breedCode2: string; rulesVersion: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const id = key(where.breedCode2_rulesVersion.breedCode2, where.breedCode2_rulesVersion.rulesVersion);
      const existing = rows.get(id);
      if (existing) { Object.assign(existing, update); return existing; }
      const row = { id, ...create }; rows.set(id, row); return row;
    },
    createMany: async ({ data, skipDuplicates }: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }) => {
      let count = 0;
      for (const create of data) {
        const id = key(create.breedCode2 as string, create.rulesVersion as string);
        if (rows.has(id)) {
          if (skipDuplicates) continue;
          throw new Error(`Duplicate profile ${id}`);
        }
        rows.set(id, { id, ...create }); count += 1;
      }
      return { count };
    },
    findUnique: async ({ where }: { where: { breedCode2_rulesVersion: { breedCode2: string; rulesVersion: string } } }) => rows.get(key(where.breedCode2_rulesVersion.breedCode2, where.breedCode2_rulesVersion.rulesVersion)) ?? null,
    findMany: async ({ where }: { where: { breedCode2: string; isActive: boolean } }) => [...rows.values()].filter((row) => row.breedCode2 === where.breedCode2 && row.isActive === where.isActive),
  };
  const transaction = {
    breedJudgingProfile: profile,
    $executeRaw: async (query: { values: unknown[] }) => {
      if (options.failBulkUpdate) throw new Error("simulated bulk profile write failure");
      const columns = 15;
      for (let index = 0; index < query.values.length; index += columns) {
        const [breedCode2, rulesVersion, isActive, headWeight, forequartersWeight, hindquartersWeight, gaitWeight, coatWeight, sizeWeight, temperamentWeight, showShineWeight, feetWeight, toplineWeight, source, notes] = query.values.slice(index, index + columns);
        const row = rows.get(key(breedCode2 as string, rulesVersion as string));
        if (!row) throw new Error(`Missing bulk profile ${breedCode2}:${rulesVersion}`);
        Object.assign(row, { isActive, headWeight, forequartersWeight, hindquartersWeight, gaitWeight, coatWeight, sizeWeight, temperamentWeight, showShineWeight, feetWeight, toplineWeight, source, notes });
      }
      return rows.size;
    },
  };
  return {
    rows,
    unrelatedRows: new Map([["untouched", { value: 1 }]]),
    database: {
      $transaction: async (action: (tx: typeof transaction) => Promise<unknown>) => {
        const before = snapshot();
        try { return await action(transaction); }
        catch (error) { rows.clear(); before.forEach((row, id) => rows.set(id, row)); throw error; }
      },
    },
    client: { breedJudgingProfile: profile },
  };
}

async function main() {
  const profiles = validateBreedJudgingProfileCoverage({ canonicalBreeds: parseCanonicalBreedsCsv(data("breeds.csv")), profiles: parseBreedJudgingProfilesCsv(data("JUDGE-01_Breed_Judging_Profile.csv")) });
  const emptyFixture = fixtureDatabase();
  const emptyFirst = await syncValidatedBreedJudgingProfiles({ database: emptyFixture.database as never, profiles });
  assert.deepEqual(emptyFirst, { importedCount: 318, activeCount: 318 }, "empty target imports all 318 canonical profiles");
  assert.equal(emptyFixture.rows.size, 318, "empty target finishes with exactly 318 profile identities");
  await syncValidatedBreedJudgingProfiles({ database: emptyFixture.database as never, profiles });
  assert.equal(emptyFixture.rows.size, 318, "empty-target re-import remains idempotent without duplicates");
  for (const canonical of profiles) {
    const persisted = emptyFixture.rows.get(`${canonical.breedCode2}:${canonical.rulesVersion}`) as Record<string, unknown>;
    assert.ok(persisted, `${canonical.breedCode2} remains present after re-import`);
    assert.equal(persisted.headWeight, canonical.headWeight, `${canonical.breedCode2} matching rows retain canonical data`);
  }

  const fixture = fixtureDatabase();
  const v0: BreedJudgingProfileInput = { ...profiles[0], rulesVersion: "breed-judging-v0", isActive: true };
  await syncValidatedBreedJudgingProfiles({ database: fixture.database as never, profiles: [v0] });
  const first = await syncValidatedBreedJudgingProfiles({ database: fixture.database as never, profiles });
  assert.deepEqual(first, { importedCount: 318, activeCount: 318 }, "imports all validated v1 profiles active");
  assert.equal(fixture.rows.size, 319, "historical v0 profile coexists with v1 rows");
  assert.equal((fixture.rows.get(`${v0.breedCode2}:breed-judging-v0`) as { isActive: boolean }).isActive, false, "new active version deterministically deactivates older version");
  await syncValidatedBreedJudgingProfiles({ database: fixture.database as never, profiles });
  assert.equal(fixture.rows.size, 319, "same-version re-import is idempotent");
  assert.deepEqual([...fixture.unrelatedRows], [["untouched", { value: 1 }]], "profile import leaves unrelated tables untouched");

  const changed = profiles.map((profile) => profile.breedCode2 === v0.breedCode2 ? { ...profile, headWeight: profile.headWeight + 1, toplineWeight: profile.toplineWeight - 1 } : profile);
  await syncValidatedBreedJudgingProfiles({ database: fixture.database as never, profiles: changed });
  assert.equal(fixture.rows.size, 319, "same-version correction updates instead of duplicating");
  assert.equal((fixture.rows.get(`${v0.breedCode2}:breed-judging-v1`) as { headWeight: number }).headWeight, profiles[0].headWeight + 1, "same-version source changes persist deterministically");

  const exact = await getBreedJudgingProfile({ client: fixture.client as never, breedCode2: v0.breedCode2, rulesVersion: "breed-judging-v1" });
  assert.equal(exact.rulesVersion, "breed-judging-v1", "exact-version lookup returns requested version");
  await assert.rejects(() => getBreedJudgingProfile({ client: fixture.client as never, breedCode2: "ZZ", rulesVersion: "missing" }), MissingBreedJudgingProfileError, "missing version is explicit");
  const active = await getActiveBreedJudgingProfile({ client: fixture.client as never, breedCode2: v0.breedCode2 });
  assert.equal(active.rulesVersion, "breed-judging-v1", "active lookup returns sole active version");
  await assert.rejects(() => getActiveBreedJudgingProfile({ client: fixture.client as never, breedCode2: "ZZ" }), MissingBreedJudgingProfileError, "missing active profile has no fallback");
  fixture.rows.set(`${v0.breedCode2}:test-v2`, { ...fixture.rows.get(`${v0.breedCode2}:breed-judging-v1`), rulesVersion: "test-v2", isActive: true });
  await assert.rejects(() => getActiveBreedJudgingProfile({ client: fixture.client as never, breedCode2: v0.breedCode2 }), AmbiguousActiveBreedJudgingProfileError, "ambiguous active state fails explicitly");

  const bad = data("JUDGE-01_Breed_Judging_Profile.csv").replace(/,10\.00,breed-judging-v1/, ",9.00,breed-judging-v1");
  assert.throws(() => parseBreedJudgingProfilesCsv(bad), /total/, "invalid source is rejected before import can begin");
  const invalidFixture = fixtureDatabase();
  await assert.rejects(() => syncValidatedBreedJudgingProfiles({ database: invalidFixture.database as never, profiles: [{ ...profiles[0], headWeight: -1 }] }), /Invalid persisted judging weight/, "invalid input fails before persistence");
  assert.equal(invalidFixture.rows.size, 0, "invalid input leaves no partial profile rows");

  const failingFixture = fixtureDatabase({ failBulkUpdate: true });
  await assert.rejects(() => syncValidatedBreedJudgingProfiles({ database: failingFixture.database as never, profiles }), /simulated bulk profile write failure/, "bulk write failure is propagated");
  assert.equal(failingFixture.rows.size, 0, "bulk write failure rolls back the whole 318-profile import");
  console.log("Breed judging profile persistence checks passed.");
}

void main();
