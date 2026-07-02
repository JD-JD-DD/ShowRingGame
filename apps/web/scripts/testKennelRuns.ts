import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  backfillKennelRuns,
  selectLegacyKennelRunCandidate,
} from "@/server/services/kennelRunBackfill.service";
import {
  STARTER_KENNEL_RUNS,
  UNCATEGORIZED_KENNEL_RUN_NAME,
  ensureStarterKennelRuns,
  ensureUncategorizedKennelRun,
} from "@/server/services/kennelRun.service";

type FakeKennelRun = {
  id: string;
  kennelId: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type FakeKennel = {
  id: string;
  isNpc: boolean;
};

type FakeDog = {
  id: string;
  ownerKennelId: string | null;
  kennelRunId: string | null;
  lifecycleState: string;
};

type FakeKennelArea = {
  id: string;
  kennelId: string;
  name: string;
  sortOrder: number;
};

type FakeKennelAreaDog = {
  dogId: string;
  areaId: string;
};

function projectRun(run: FakeKennelRun): FakeKennelRun {
  return { ...run };
}

function createFakeClient(seed?: {
  kennels?: FakeKennel[];
  runs?: FakeKennelRun[];
  dogs?: FakeDog[];
  areas?: FakeKennelArea[];
  memberships?: FakeKennelAreaDog[];
}) {
  const kennels = seed?.kennels ?? [];
  const rows: FakeKennelRun[] = seed?.runs ?? [];
  const dogs = seed?.dogs ?? [];
  const areas = seed?.areas ?? [];
  const memberships = seed?.memberships ?? [];
  let nextId = 1;

  return {
    kennels,
    rows,
    dogs,
    areas,
    memberships,
    client: {
      kennel: {
        async findMany() {
          return kennels
            .filter((kennel) => !kennel.isNpc)
            .map((kennel) => ({ id: kennel.id }));
        },
      },
      kennelRun: {
        async upsert(args: {
          where: { kennelId_name: { kennelId: string; name: string } };
          update: Pick<FakeKennelRun, "sortOrder" | "isSystem">;
          create: Pick<
            FakeKennelRun,
            "kennelId" | "name" | "sortOrder" | "isSystem"
          >;
        }) {
          const key = args.where.kennelId_name;
          const existing = rows.find(
            (row) => row.kennelId === key.kennelId && row.name === key.name
          );

          if (existing) {
            existing.sortOrder = args.update.sortOrder;
            existing.isSystem = args.update.isSystem;
            existing.updatedAt = new Date(existing.updatedAt.getTime() + 1);
            return projectRun(existing);
          }

          const created = {
            id: `run-${nextId}`,
            kennelId: args.create.kennelId,
            name: args.create.name,
            sortOrder: args.create.sortOrder,
            isSystem: args.create.isSystem,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          };
          nextId += 1;
          rows.push(created);
          return projectRun(created);
        },
        async findMany(args: {
          where: { kennelId: string; name?: { in: string[] } };
          orderBy?: { sortOrder: "desc" } | Array<Record<string, string>>;
          take?: number;
        }) {
          let result = rows
            .filter((row) => row.kennelId === args.where.kennelId)
            .filter((row) =>
              args.where.name?.in ? args.where.name.in.includes(row.name) : true
            );

          if (
            !Array.isArray(args.orderBy) &&
            args.orderBy?.sortOrder === "desc"
          ) {
            result = result.sort((a, b) => b.sortOrder - a.sortOrder);
          } else {
            result = result.sort(
              (a, b) =>
                a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
            );
          }

          return result.slice(0, args.take ?? result.length).map(projectRun);
        },
        async findUnique(args: {
          where: { kennelId_name: { kennelId: string; name: string } };
        }) {
          const key = args.where.kennelId_name;
          const existing = rows.find(
            (row) => row.kennelId === key.kennelId && row.name === key.name
          );

          return existing ? projectRun(existing) : null;
        },
        async create(args: {
          data: Pick<
            FakeKennelRun,
            "kennelId" | "name" | "sortOrder" | "isSystem"
          >;
        }) {
          const created = {
            id: `run-${nextId}`,
            kennelId: args.data.kennelId,
            name: args.data.name,
            sortOrder: args.data.sortOrder,
            isSystem: args.data.isSystem,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          };
          nextId += 1;
          rows.push(created);
          return projectRun(created);
        },
      },
      dog: {
        async findMany(args?: {
          where?: {
            ownerKennelId?: { in?: string[]; not?: null };
            lifecycleState?: string;
          };
        }) {
          return dogs
            .filter((dog) =>
              args?.where?.ownerKennelId?.in
                ? dog.ownerKennelId !== null &&
                  args.where.ownerKennelId.in.includes(dog.ownerKennelId)
                : args?.where?.ownerKennelId?.not === null
                  ? dog.ownerKennelId !== null
                  : true
            )
            .filter((dog) =>
              args?.where?.lifecycleState
                ? dog.lifecycleState === args.where.lifecycleState
                : true
            )
            .map((dog) => ({ ...dog }));
        },
        async updateMany(args: {
          where: {
            id: string;
            ownerKennelId: string;
            lifecycleState: string;
            kennelRunId: null;
          };
          data: { kennelRunId: string | null };
        }) {
          const dog = dogs.find(
            (candidate) =>
              candidate.id === args.where.id &&
              candidate.ownerKennelId === args.where.ownerKennelId &&
              candidate.lifecycleState === args.where.lifecycleState &&
              candidate.kennelRunId === args.where.kennelRunId
          );

          if (!dog) {
            return { count: 0 };
          }

          dog.kennelRunId = args.data.kennelRunId;
          return { count: 1 };
        },
        async count(args?: {
          where?: {
            ownerKennelId?: { in?: string[] };
            lifecycleState?: string;
            kennelRunId?: null;
          };
        }) {
          return dogs.filter(
            (dog) =>
              (args?.where?.ownerKennelId?.in
                ? dog.ownerKennelId !== null &&
                  args.where.ownerKennelId.in.includes(dog.ownerKennelId)
                : true) &&
              (args?.where?.lifecycleState
                ? dog.lifecycleState === args.where.lifecycleState
                : true) &&
              (args?.where?.kennelRunId === null
                ? dog.kennelRunId === null
                : true)
          ).length;
        },
      },
      kennelAreaDog: {
        async findMany(args: {
          where: { dogId: string | { in: string[] }; area?: { kennelId: string } };
        }) {
          const dogIds =
            typeof args.where.dogId === "string"
              ? [args.where.dogId]
              : args.where.dogId.in;

          return memberships
            .filter((membership) => dogIds.includes(membership.dogId))
            .flatMap((membership) => {
              const area = areas.find(
                (candidate) => candidate.id === membership.areaId
              );

              if (
                !area ||
                (args.where.area && area.kennelId !== args.where.area.kennelId)
              ) {
                return [];
              }

              return [
                {
                  dogId: membership.dogId,
                  area: {
                    id: area.id,
                    kennelId: area.kennelId,
                    name: area.name,
                    sortOrder: area.sortOrder,
                  },
                },
              ];
            });
        },
      },
    },
  };
}

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), label);
}

async function main() {
  const kennelId = "kennel-1";
  const fake = createFakeClient();

  const uncategorizedA = await ensureUncategorizedKennelRun({
    kennelId,
    client: fake.client as never,
  });
  const uncategorizedB = await ensureUncategorizedKennelRun({
    kennelId,
    client: fake.client as never,
  });

  assert.equal(
    uncategorizedA.id,
    uncategorizedB.id,
    "ensureUncategorizedKennelRun is idempotent"
  );
  assert.equal(fake.rows.length, 1, "uncategorized helper creates one run once");
  assert.equal(uncategorizedA.name, UNCATEGORIZED_KENNEL_RUN_NAME);
  assert.equal(uncategorizedA.isSystem, true);
  assert.equal(uncategorizedA.sortOrder, 0);

  const starterA = await ensureStarterKennelRuns({
    kennelId,
    client: fake.client as never,
  });
  const starterB = await ensureStarterKennelRuns({
    kennelId,
    client: fake.client as never,
  });

  assert.equal(
    fake.rows.length,
    STARTER_KENNEL_RUNS.length,
    "ensureStarterKennelRuns does not duplicate starter runs"
  );
  assert.deepEqual(
    starterA.map((run) => run.name),
    STARTER_KENNEL_RUNS.map((run) => run.name)
  );
  assert.deepEqual(
    starterB.map((run) => run.name),
    STARTER_KENNEL_RUNS.map((run) => run.name),
    "ensureStarterKennelRuns remains stable on repeated calls"
  );

  const uncategorized = fake.rows.find(
    (run) => run.name === UNCATEGORIZED_KENNEL_RUN_NAME
  );
  assert.ok(uncategorized, "Uncategorized exists");
  assert.equal(uncategorized.isSystem, true, "Uncategorized is protected");

  const nonSystemStarterRuns = fake.rows.filter(
    (run) => run.name !== UNCATEGORIZED_KENNEL_RUN_NAME
  );
  assert.ok(nonSystemStarterRuns.length > 0);
  assert.ok(
    nonSystemStarterRuns.every((run) => run.isSystem === false),
    "starter runs other than Uncategorized are not system runs"
  );

  assert.deepEqual(
    selectLegacyKennelRunCandidate([
      { id: "z", name: "Zeta", sortOrder: 2 },
      { id: "b", name: "Beta", sortOrder: 1 },
      { id: "a", name: "Alpha", sortOrder: 1 },
    ]),
    { id: "a", name: "Alpha", sortOrder: 1 },
    "multiple legacy memberships pick lowest sort order, then name/id"
  );

  const backfillFake = createFakeClient({
    kennels: [
      { id: kennelId, isNpc: false },
      { id: "npc-1", isNpc: true },
    ],
    runs: [
      {
        id: "existing-run",
        kennelId,
        name: "Existing",
        sortOrder: 99,
        isSystem: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ],
    dogs: [
      {
        id: "no-legacy",
        ownerKennelId: kennelId,
        kennelRunId: null,
        lifecycleState: "ALIVE",
      },
      {
        id: "single-legacy",
        ownerKennelId: kennelId,
        kennelRunId: null,
        lifecycleState: "ALIVE",
      },
      {
        id: "multi-legacy",
        ownerKennelId: kennelId,
        kennelRunId: null,
        lifecycleState: "ALIVE",
      },
      {
        id: "custom-legacy",
        ownerKennelId: kennelId,
        kennelRunId: null,
        lifecycleState: "ALIVE",
      },
      {
        id: "already-assigned",
        ownerKennelId: kennelId,
        kennelRunId: "existing-run",
        lifecycleState: "ALIVE",
      },
      {
        id: "unowned",
        ownerKennelId: null,
        kennelRunId: null,
        lifecycleState: "ALIVE",
      },
    ],
    areas: [
      { id: "area-specials", kennelId, name: "Specials", sortOrder: 2 },
      { id: "area-puppies", kennelId, name: "Puppies", sortOrder: 1 },
      { id: "area-custom", kennelId, name: "Custom Yard", sortOrder: 7 },
    ],
    memberships: [
      { dogId: "single-legacy", areaId: "area-specials" },
      { dogId: "multi-legacy", areaId: "area-specials" },
      { dogId: "multi-legacy", areaId: "area-puppies" },
      { dogId: "custom-legacy", areaId: "area-custom" },
    ],
  });
  const firstBackfill = await backfillKennelRuns({
    client: backfillFake.client as never,
  });
  const secondBackfill = await backfillKennelRuns({
    client: backfillFake.client as never,
  });

  assert.equal(firstBackfill.kennelsScanned, 1);
  assert.equal(firstBackfill.starterRunsCreated, STARTER_KENNEL_RUNS.length);
  assert.equal(firstBackfill.dogsAssignedToUncategorized, 1);
  assert.equal(firstBackfill.dogsAssignedFromLegacySingleMembership, 2);
  assert.equal(firstBackfill.dogsAssignedFromLegacyMultipleMemberships, 1);
  assert.equal(firstBackfill.activeOwnedDogsStillMissingKennelRunId, 0);
  assert.equal(secondBackfill.starterRunsCreated, 0);
  assert.equal(secondBackfill.dogsAssignedToUncategorized, 0);
  assert.equal(
    secondBackfill.dogsSkipped,
    5,
    "second backfill skips all already assigned active owned dogs"
  );

  const runNameById = new Map(
    backfillFake.rows.map((run) => [run.id, run.name])
  );
  const dogRunName = (dogId: string) => {
    const dog = backfillFake.dogs.find((candidate) => candidate.id === dogId);
    return dog?.kennelRunId ? runNameById.get(dog.kennelRunId) : null;
  };

  assert.equal(dogRunName("no-legacy"), UNCATEGORIZED_KENNEL_RUN_NAME);
  assert.equal(dogRunName("single-legacy"), "Specials");
  assert.equal(dogRunName("multi-legacy"), "Puppies");
  assert.equal(dogRunName("custom-legacy"), "Custom Yard");

  const foundationDogService = source(
    "apps/web/server/services/foundationDog.service.ts"
  );
  const marketService = source("apps/web/server/services/market.service.ts");
  const breedingService = source("apps/web/server/services/breeding.service.ts");
  const rehomeService = source("apps/web/server/services/rehome.service.ts");
  const dogService = source("apps/web/server/services/dog.service.ts");

  assertIncludes(
    foundationDogService,
    "kennelRunId: kennelRun.id",
    "foundation purchase assigns the buyer Uncategorized run"
  );
  assertIncludes(
    marketService,
    "kennelRunId: buyerKennelRun.id",
    "player-market purchase assigns the buyer Uncategorized run"
  );
  assertIncludes(
    breedingService,
    "fresh.dam.kennelRunId ??",
    "whelping falls back when the dam has no Kennel Run"
  );
  assertIncludes(
    breedingService,
    "kennelRunId: puppyKennelRunId",
    "whelped puppies inherit the selected Kennel Run"
  );
  assertIncludes(
    rehomeService,
    "kennelRunId: null",
    "rehome clears Kennel Run assignment"
  );
  assertIncludes(
    dogService,
    "kennelRunId?: string;",
    "saveEngineDog can accept an explicit Kennel Run"
  );
  assertIncludes(
    dogService,
    "await ensureUncategorizedKennelRun({ kennelId: ownerKennelId })",
    "saveEngineDog defaults owned dogs to Uncategorized"
  );

  console.log("Kennel run helper checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
