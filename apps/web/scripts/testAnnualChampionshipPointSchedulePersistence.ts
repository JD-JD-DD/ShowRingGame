import assert from "node:assert/strict";

import {
  annualChampionshipPointScheduleExists,
  createAnnualChampionshipPointSchedule,
  getAnnualChampionshipPointSchedule,
  getAnnualChampionshipPointSchedulePublication,
  listAnnualChampionshipPointSchedules,
  persistAnnualChampionshipPointSchedule,
  PublishedAnnualChampionshipPointScheduleError,
  type AnnualChampionshipPointScheduleInput,
} from "../server/services/annualChampionshipPointSchedule.service";

type Publication = {
  id: string;
  sourceYear: number;
  effectiveYear: number;
  calculationVersion: string;
  status: "DRAFT" | "PUBLISHED";
  calculatedAt: Date | null;
  publishedAt: Date | null;
};

const keyOf = (schedule: Pick<AnnualChampionshipPointScheduleInput, "effectiveYear" | "district" | "breedCode2" | "sex">) =>
  `${schedule.effectiveYear}:${schedule.district}:${schedule.breedCode2}:${schedule.sex}`;

function fixtureDatabase() {
  const publications = new Map<string, Publication>([
    [
      "year-17",
      {
        id: "year-17",
        sourceYear: 16,
        effectiveYear: 17,
        calculationVersion: "points-v1",
        status: "DRAFT",
        calculatedAt: new Date("2026-08-19T00:00:00.000Z"),
        publishedAt: null,
      },
    ],
    [
      "year-18",
      {
        id: "year-18",
        sourceYear: 17,
        effectiveYear: 18,
        calculationVersion: "points-v2",
        status: "DRAFT",
        calculatedAt: new Date("2027-08-19T00:00:00.000Z"),
        publishedAt: null,
      },
    ],
  ]);
  const schedules = new Map<string, Record<string, unknown>>();
  const publication = {
    findUnique: async ({ where }: { where: { id?: string; effectiveYear?: number } }) =>
      [...publications.values()].find((item) =>
        where.id ? item.id === where.id : item.effectiveYear === where.effectiveYear
      ) ?? null,
  };
  const schedule = {
    findUnique: async ({ where }: { where: { effectiveYear_district_breedCode2_sex: AnnualChampionshipPointScheduleInput } }) => {
      const row = schedules.get(keyOf(where.effectiveYear_district_breedCode2_sex));
      return row ? { ...row, publication: publications.get(row.publicationId as string) } : null;
    },
    findMany: async ({ where }: { where: { effectiveYear: number } }) =>
      [...schedules.values()]
        .filter((row) => row.effectiveYear === where.effectiveYear)
        .sort((left, right) => keyOf(left as AnnualChampionshipPointScheduleInput).localeCompare(keyOf(right as AnnualChampionshipPointScheduleInput)))
        .map((row) => ({ ...row, publication: publications.get(row.publicationId as string) })),
    create: async ({ data }: { data: AnnualChampionshipPointScheduleInput }) => {
      const key = keyOf(data);
      if (schedules.has(key)) throw new Error(`Duplicate canonical schedule key ${key}`);
      const row = { id: key, ...data };
      schedules.set(key, row);
      return row;
    },
    upsert: async ({ where, create, update }: { where: { effectiveYear_district_breedCode2_sex: AnnualChampionshipPointScheduleInput }; create: AnnualChampionshipPointScheduleInput; update: Record<string, unknown> }) => {
      const key = keyOf(where.effectiveYear_district_breedCode2_sex);
      const existing = schedules.get(key);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row = { id: key, ...create };
      schedules.set(key, row);
      return row;
    },
  };
  const client = { annualChampionshipPointSchedule: schedule, annualChampionshipPointSchedulePublication: publication };
  return {
    publications,
    schedules,
    client,
    database: { $transaction: async (action: (tx: typeof client) => Promise<unknown>) => action(client) },
  };
}

function schedule(overrides: Partial<AnnualChampionshipPointScheduleInput> = {}): AnnualChampionshipPointScheduleInput {
  return {
    publicationId: "year-17",
    effectiveYear: 17,
    district: 4,
    breedCode2: "GR",
    sex: "M",
    onePointThreshold: 2,
    twoPointThreshold: 4,
    threePointThreshold: 7,
    fourPointThreshold: 10,
    fivePointThreshold: 14,
    observationCount: 120,
    achievedOnePointRate: 0.95,
    achievedMajorRate: 0.18,
    achievedFivePointRate: 0.02,
    ...overrides,
  };
}

async function main() {
  const fixture = fixtureDatabase();
  const male = schedule();
  const female = schedule({ sex: "F" });
  const otherDistrict = schedule({ district: 5 });
  const otherYear = schedule({ publicationId: "year-18", effectiveYear: 18 });
  await createAnnualChampionshipPointSchedule({ database: fixture.database as never, schedule: male });
  await createAnnualChampionshipPointSchedule({ database: fixture.database as never, schedule: female });
  await createAnnualChampionshipPointSchedule({ database: fixture.database as never, schedule: otherDistrict });
  await createAnnualChampionshipPointSchedule({ database: fixture.database as never, schedule: otherYear });
  assert.equal(fixture.schedules.size, 4, "M and F schedules coexist, districts remain independent, and effective years remain independent");
  await assert.rejects(
    () => createAnnualChampionshipPointSchedule({ database: fixture.database as never, schedule: male }),
    /Duplicate canonical schedule key/,
    "duplicate canonical keys are rejected"
  );

  const fetched = await getAnnualChampionshipPointSchedule({ client: fixture.client as never, effectiveYear: 17, district: 4, breedCode2: "GR", sex: "M" });
  assert.equal(fetched?.fivePointThreshold, 14, "threshold values round-trip");
  assert.equal(fetched?.publication.sourceYear, 16, "annual provenance is inherited from the publication");
  assert.equal(await annualChampionshipPointScheduleExists({ client: fixture.client as never, effectiveYear: 17, district: 4, breedCode2: "GR", sex: "F" }), true, "canonical existence lookup works");
  assert.equal((await listAnnualChampionshipPointSchedules({ client: fixture.client as never, effectiveYear: 17 })).length, 3, "annual listing returns all schedules for an effective year");
  assert.equal((await getAnnualChampionshipPointSchedulePublication({ client: fixture.client as never, effectiveYear: 17 }))?.calculationVersion, "points-v1", "publication state is readable");

  await persistAnnualChampionshipPointSchedule({ database: fixture.database as never, schedule: schedule({ fivePointThreshold: 15 }) });
  assert.equal((await getAnnualChampionshipPointSchedule({ client: fixture.client as never, effectiveYear: 17, district: 4, breedCode2: "GR", sex: "M" }))?.fivePointThreshold, 15, "draft schedules can be persisted idempotently");
  const publication = fixture.publications.get("year-17") as Publication;
  publication.status = "PUBLISHED";
  publication.publishedAt = new Date("2026-09-01T00:00:00.000Z");
  await assert.rejects(
    () => persistAnnualChampionshipPointSchedule({ database: fixture.database as never, schedule: schedule({ fivePointThreshold: 16 }) }),
    PublishedAnnualChampionshipPointScheduleError,
    "published schedules cannot be overwritten through the normal service API"
  );
  assert.equal(fixture.schedules.get(keyOf(male))?.fivePointThreshold, 15, "published-write rejection preserves the stored threshold");
  console.log("Annual Championship Point Schedule persistence checks passed.");
}

void main();
