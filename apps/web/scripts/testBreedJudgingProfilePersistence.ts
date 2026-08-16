import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseBreedJudgingProfilesCsv, parseCanonicalBreedsCsv, validateBreedJudgingProfileCoverage, type BreedJudgingProfileInput } from "../server/services/breedJudgingProfile.service";
import { AmbiguousActiveBreedJudgingProfileError, getActiveBreedJudgingProfile, getBreedJudgingProfile, MissingBreedJudgingProfileError, syncValidatedBreedJudgingProfiles } from "../server/services/breedJudgingProfilePersistence.service";

const data = (file: string) => readFileSync(resolve(process.cwd(), `prisma/data/${file}`), "utf8");

function fixtureDatabase() {
  const rows = new Map<string, Record<string, unknown>>();
  const key = (breedCode2: string, rulesVersion: string) => `${breedCode2}:${rulesVersion}`;
  const profile = {
    updateMany: async ({ where, data }: { where: { breedCode2: string; rulesVersion?: { not: string }; isActive?: boolean }; data: Record<string, unknown> }) => {
      let count = 0;
      for (const row of rows.values()) if (row.breedCode2 === where.breedCode2 && (!where.rulesVersion || row.rulesVersion !== where.rulesVersion.not) && (!where.isActive || row.isActive === where.isActive)) { Object.assign(row, data); count += 1; }
      return { count };
    },
    upsert: async ({ where, create, update }: { where: { breedCode2_rulesVersion: { breedCode2: string; rulesVersion: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const id = key(where.breedCode2_rulesVersion.breedCode2, where.breedCode2_rulesVersion.rulesVersion);
      const existing = rows.get(id);
      if (existing) { Object.assign(existing, update); return existing; }
      const row = { id, ...create }; rows.set(id, row); return row;
    },
    findUnique: async ({ where }: { where: { breedCode2_rulesVersion: { breedCode2: string; rulesVersion: string } } }) => rows.get(key(where.breedCode2_rulesVersion.breedCode2, where.breedCode2_rulesVersion.rulesVersion)) ?? null,
    findMany: async ({ where }: { where: { breedCode2: string; isActive: boolean } }) => [...rows.values()].filter((row) => row.breedCode2 === where.breedCode2 && row.isActive === where.isActive),
  };
  return { rows, database: { $transaction: async (action: (tx: { breedJudgingProfile: typeof profile }) => Promise<unknown>) => action({ breedJudgingProfile: profile }) }, client: { breedJudgingProfile: profile } };
}

async function main() {
  const profiles = validateBreedJudgingProfileCoverage({ canonicalBreeds: parseCanonicalBreedsCsv(data("breeds.csv")), profiles: parseBreedJudgingProfilesCsv(data("JUDGE-01_Breed_Judging_Profile.csv")) });
  const fixture = fixtureDatabase();
  const v0: BreedJudgingProfileInput = { ...profiles[0], rulesVersion: "breed-judging-v0", isActive: true };
  await syncValidatedBreedJudgingProfiles({ database: fixture.database as never, profiles: [v0] });
  const first = await syncValidatedBreedJudgingProfiles({ database: fixture.database as never, profiles });
  assert.deepEqual(first, { importedCount: 318, activeCount: 318 }, "imports all validated v1 profiles active");
  assert.equal(fixture.rows.size, 319, "historical v0 profile coexists with v1 rows");
  assert.equal((fixture.rows.get(`${v0.breedCode2}:breed-judging-v0`) as { isActive: boolean }).isActive, false, "new active version deterministically deactivates older version");
  await syncValidatedBreedJudgingProfiles({ database: fixture.database as never, profiles });
  assert.equal(fixture.rows.size, 319, "same-version re-import is idempotent");

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
  console.log("Breed judging profile persistence checks passed.");
}

void main();
