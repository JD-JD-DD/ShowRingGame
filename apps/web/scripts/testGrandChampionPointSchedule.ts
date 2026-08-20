import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  resolveGrandChampionPointSchedule,
  resolveGrandChampionPointSchedules,
  GrandChampionPointScheduleYearBoundaryError,
  usesDynamicGrandChampionPointSchedule,
} from "../server/services/grandChampionPointSchedule.service";
import { UnavailablePublishedAnnualChampionshipPointScheduleError } from "../server/services/annualChampionshipPointSchedule.service";

type Schedule = {
  id: string; publicationId: string; effectiveYear: number; district: number; breedCode2: string; sex: "M" | "F";
  onePointThreshold: number; twoPointThreshold: number; threePointThreshold: number; fourPointThreshold: number; fivePointThreshold: number;
  publication: { effectiveYear: number; status: "DRAFT" | "PUBLISHED"; publishedAt: Date | null; calculationVersion: string };
};

function fixture(rows: Schedule[]) {
  let reads = 0;
  return {
    client: {
      annualChampionshipPointSchedule: {
        findUnique: async ({ where }: { where: { effectiveYear_district_breedCode2_sex: Pick<Schedule, "effectiveYear" | "district" | "breedCode2" | "sex"> } }) => {
          reads += 1;
          const key = where.effectiveYear_district_breedCode2_sex;
          return rows.find((row) => row.effectiveYear === key.effectiveYear && row.district === key.district && row.breedCode2 === key.breedCode2 && row.sex === key.sex) ?? null;
        },
      },
      annualChampionshipPointSchedulePublication: {},
    },
    reads: () => reads,
  };
}

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "schedule-17-4-GR-M", publicationId: "publication-17", effectiveYear: 17, district: 4, breedCode2: "GR", sex: "M",
    onePointThreshold: 3, twoPointThreshold: 5, threePointThreshold: 7, fourPointThreshold: 9, fivePointThreshold: 11,
    publication: { effectiveYear: 17, status: "PUBLISHED", publishedAt: new Date("2026-01-01T00:00:00.000Z"), calculationVersion: "points-03-v1" },
    ...overrides,
  };
}

async function main() {
  const male = schedule();
  const female = schedule({ id: "schedule-17-4-GR-F", sex: "F" });
  const otherDistrict = schedule({ id: "schedule-17-5-GR-M", district: 5 });
  const otherBreed = schedule({ id: "schedule-17-4-BC-M", breedCode2: "BC" });
  const nextYear = schedule({ id: "schedule-18-4-GR-M", effectiveYear: 18, publicationId: "publication-18", publication: { effectiveYear: 18, status: "PUBLISHED", publishedAt: new Date("2027-01-01T00:00:00.000Z"), calculationVersion: "points-03-v1" } });
  const live = fixture([male, female, otherDistrict, otherBreed, nextYear]);
  const resolved = await resolveGrandChampionPointSchedule({ client: live.client as never, effectiveYear: 17, district: 4, breedCode2: "GR", sex: "M" });
  assert.deepEqual(resolved.thresholds, { onePointThreshold: 3, twoPointThreshold: 5, threePointThreshold: 7, fourPointThreshold: 9, fivePointThreshold: 11 }, "Year 17 resolver returns the exact published schedule thresholds");
  assert.equal(resolved.publicationId, "publication-17", "resolver preserves publication provenance");
  const bySex = await resolveGrandChampionPointSchedules({ client: live.client as never, effectiveYear: 17, district: 4, breedCode2: "GR", sexes: ["M", "F", "M"] });
  assert.equal(bySex.size, 2, "breed resolver deduplicates required M/F reads");
  assert.equal(live.reads(), 3, "one single read plus at most one read per requested sex");
  assert.equal(usesDynamicGrandChampionPointSchedule(16), false, "Year 16 uses isolated legacy GCH conversion without a schedule");
  assert.equal(usesDynamicGrandChampionPointSchedule(17), true, "Year 17 starts exact published GCH schedule resolution");

  for (const args of [
    { effectiveYear: 17, district: 6, breedCode2: "GR", sex: "M" as const },
    { effectiveYear: 17, district: 4, breedCode2: "XX", sex: "M" as const },
    { effectiveYear: 17, district: 4, breedCode2: "GR", sex: "F" as const },
    { effectiveYear: 18, district: 4, breedCode2: "GR", sex: "F" as const },
  ]) {
    await assert.rejects(() => resolveGrandChampionPointSchedule({ client: fixture([male, otherDistrict, otherBreed, nextYear]).client as never, ...args }), UnavailablePublishedAnnualChampionshipPointScheduleError, "resolver never substitutes another exact-key schedule");
  }
  await assert.rejects(() => resolveGrandChampionPointSchedule({ client: fixture([male]).client as never, effectiveYear: 16, district: 4, breedCode2: "GR", sex: "M" }), GrandChampionPointScheduleYearBoundaryError, "Year 16 does not query or require an annual schedule");
  await assert.rejects(() => resolveGrandChampionPointSchedule({ client: fixture([schedule({ publication: { ...male.publication, status: "DRAFT", publishedAt: null } })]).client as never, effectiveYear: 17, district: 4, breedCode2: "GR", sex: "M" }), UnavailablePublishedAnnualChampionshipPointScheduleError, "DRAFT annual publication fails closed");

  const invitationalSource = readFileSync(join(process.cwd(), "apps/web/server/services/invitational.service.ts"), "utf8");
  assert.ok(invitationalSource.includes("const INVITATIONAL_HOST_DISTRICT = 1"), "Invitational host district is canonical");
  assert.ok(invitationalSource.includes("district: INVITATIONAL_HOST_DISTRICT"), "Invitational persists its canonical district on ShowCluster");
  console.log("Grand Champion point schedule resolver checks passed.");
}

void main();
