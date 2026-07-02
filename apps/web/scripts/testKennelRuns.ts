import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  backfillKennelRuns,
  resetKennelRunsToUncategorized,
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
  isPlayerVisible: boolean;
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
  memberships?: FakeKennelAreaDog[];
}) {
  const kennels = seed?.kennels ?? [];
  const rows: FakeKennelRun[] = seed?.runs ?? [];
  const dogs = seed?.dogs ?? [];
  const memberships = seed?.memberships ?? [];
  let nextId = 1;

  return {
    kennels,
    rows,
    dogs,
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
          where: {
            kennelId: string | { in: string[] };
            name?: string | { in: string[] };
            isSystem?: boolean;
          };
          orderBy?: { sortOrder: "desc" } | Array<Record<string, string>>;
          take?: number;
        }) {
          const kennelIds =
            typeof args.where.kennelId === "string"
              ? [args.where.kennelId]
              : args.where.kennelId.in;
          const names =
            typeof args.where.name === "string"
              ? [args.where.name]
              : args.where.name?.in;
          let result = rows
            .filter((row) => kennelIds.includes(row.kennelId))
            .filter((row) => (names ? names.includes(row.name) : true))
            .filter((row) =>
              args.where.isSystem === undefined
                ? true
                : row.isSystem === args.where.isSystem
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
      },
      dog: {
        async findMany(args?: {
          where?: {
            ownerKennelId?: { in?: string[]; not?: null };
            lifecycleState?: string;
            isPlayerVisible?: boolean;
            kennelRunId?: { not: null };
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
            .filter((dog) =>
              args?.where?.isPlayerVisible === undefined
                ? true
                : dog.isPlayerVisible === args.where.isPlayerVisible
            )
            .filter((dog) =>
              args?.where?.kennelRunId?.not === null
                ? dog.kennelRunId !== null
                : true
            )
            .map((dog) => ({
              ...dog,
              kennelRun: dog.kennelRunId
                ? {
                    kennelId:
                      rows.find((row) => row.id === dog.kennelRunId)
                        ?.kennelId ?? null,
                  }
                : null,
            }));
        },
        async updateMany(args: {
          where: {
            id: string;
            ownerKennelId: string;
            lifecycleState: string;
            isPlayerVisible: boolean;
            OR: Array<
              { kennelRunId: null } | { kennelRunId: { not: string } }
            >;
          };
          data: { kennelRunId: string | null };
        }) {
          if (args.where.id === "stale-owner") {
            const staleDog = dogs.find(
              (candidate) => candidate.id === args.where.id
            );

            if (staleDog) {
              staleDog.ownerKennelId = null;
              staleDog.kennelRunId = null;
            }
          }

          const dog = dogs.find(
            (candidate) =>
              candidate.id === args.where.id &&
              candidate.ownerKennelId === args.where.ownerKennelId &&
              candidate.lifecycleState === args.where.lifecycleState &&
              candidate.isPlayerVisible === args.where.isPlayerVisible &&
              args.where.OR.some((condition) =>
                condition.kennelRunId === null
                  ? candidate.kennelRunId === null
                  : candidate.kennelRunId !== condition.kennelRunId.not
              )
          );

          if (!dog) {
            return { count: 0 };
          }

          dog.kennelRunId = args.data.kennelRunId;
          return { count: 1 };
        },
        async count(args?: {
          where?: {
            ownerKennelId?: { in?: string[]; not?: null } | null;
            lifecycleState?: string;
            isPlayerVisible?: boolean;
            kennelRunId?: null | { not: null };
          };
        }) {
          return dogs.filter((dog) => {
            const ownerMatches = args?.where?.ownerKennelId?.in
              ? dog.ownerKennelId !== null &&
                args.where.ownerKennelId.in.includes(dog.ownerKennelId)
              : args?.where?.ownerKennelId?.not === null
                ? dog.ownerKennelId !== null
                : args?.where?.ownerKennelId === null
                  ? dog.ownerKennelId === null
                  : true;
            const visibleMatches =
              args?.where?.isPlayerVisible === undefined
                ? true
                : dog.isPlayerVisible === args.where.isPlayerVisible;
            const runMatches =
              args?.where?.kennelRunId &&
              typeof args.where.kennelRunId === "object" &&
              args.where.kennelRunId.not === null
                ? dog.kennelRunId !== null
                : args?.where?.kennelRunId === null
                  ? dog.kennelRunId === null
                  : true;
            const lifecycleMatches = args?.where?.lifecycleState
              ? dog.lifecycleState === args.where.lifecycleState
              : true;

            return (
              ownerMatches && visibleMatches && runMatches && lifecycleMatches
            );
          }).length;
        },
      },
      kennelAreaDog: {
        async findMany() {
          assert.fail(
            "Kennel Run reset must ignore legacy KennelAreaDog memberships"
          );
        },
      },
    },
  };
}

function countActiveOwnedRunOwnerMismatches(
  fake: ReturnType<typeof createFakeClient>
) {
  return fake.dogs.filter((dog) => {
    if (
      !dog.ownerKennelId ||
      dog.lifecycleState !== "ALIVE" ||
      !dog.isPlayerVisible ||
      !dog.kennelRunId
    ) {
      return false;
    }

    return (
      fake.rows.find((run) => run.id === dog.kennelRunId)?.kennelId !==
      dog.ownerKennelId
    );
  }).length;
}

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), label);
}

function dogRunName(fake: ReturnType<typeof createFakeClient>, dogId: string) {
  const dog = fake.dogs.find((candidate) => candidate.id === dogId);

  return dog?.kennelRunId
    ? fake.rows.find((run) => run.id === dog.kennelRunId)?.name ?? null
    : null;
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

  const resetFake = createFakeClient({
    kennels: [
      { id: kennelId, isNpc: false },
      { id: "other-kennel", isNpc: false },
      { id: "npc-1", isNpc: true },
    ],
    runs: [
      {
        id: "uncat-run",
        kennelId,
        name: UNCATEGORIZED_KENNEL_RUN_NAME,
        sortOrder: 0,
        isSystem: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      {
        id: "specials-run",
        kennelId,
        name: "Specials",
        sortOrder: 1,
        isSystem: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      {
        id: "custom-run",
        kennelId,
        name: "Custom Yard",
        sortOrder: 99,
        isSystem: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      {
        id: "other-uncat-run",
        kennelId: "other-kennel",
        name: UNCATEGORIZED_KENNEL_RUN_NAME,
        sortOrder: 0,
        isSystem: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ],
    dogs: [
      {
        id: "already-uncategorized",
        ownerKennelId: kennelId,
        kennelRunId: "uncat-run",
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
      },
      {
        id: "single-legacy",
        ownerKennelId: kennelId,
        kennelRunId: "specials-run",
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
      },
      {
        id: "multi-legacy",
        ownerKennelId: kennelId,
        kennelRunId: "custom-run",
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
      },
      {
        id: "missing-run",
        ownerKennelId: kennelId,
        kennelRunId: null,
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
      },
      {
        id: "stale-owner",
        ownerKennelId: kennelId,
        kennelRunId: null,
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
      },
      {
        id: "hidden-active",
        ownerKennelId: kennelId,
        kennelRunId: null,
        lifecycleState: "ALIVE",
        isPlayerVisible: false,
      },
      {
        id: "deceased",
        ownerKennelId: kennelId,
        kennelRunId: null,
        lifecycleState: "DECEASED",
        isPlayerVisible: true,
      },
      {
        id: "unowned",
        ownerKennelId: null,
        kennelRunId: null,
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
      },
    ],
    memberships: [
      { dogId: "single-legacy", areaId: "area-specials" },
      { dogId: "multi-legacy", areaId: "area-specials" },
      { dogId: "multi-legacy", areaId: "area-puppies" },
    ],
  });
  const firstReset = await resetKennelRunsToUncategorized({
    client: resetFake.client as never,
  });
  const secondReset = await resetKennelRunsToUncategorized({
    client: resetFake.client as never,
  });
  const aliasReset = await backfillKennelRuns({
    client: resetFake.client as never,
  });

  assert.equal(firstReset.kennelsScanned, 2);
  assert.equal(firstReset.activeOwnedDogsScanned, 5);
  assert.equal(firstReset.dogsAlreadyInUncategorized, 1);
  assert.equal(firstReset.dogsMovedToUncategorized, 3);
  assert.equal(firstReset.dogsSkipped, 1);
  assert.equal(firstReset.activeOwnedDogsMissingKennelRunIdAfterReset, 0);
  assert.equal(firstReset.activeOwnedDogsWithRunOwnerMismatchAfterReset, 0);
  assert.equal(firstReset.unownedDogsWithKennelRunIdAfterReset, 0);
  assert.equal(secondReset.dogsMovedToUncategorized, 0);
  assert.equal(secondReset.dogsAlreadyInUncategorized, 4);
  assert.equal(aliasReset.dogsMovedToUncategorized, 0);

  assert.equal(
    dogRunName(resetFake, "single-legacy"),
    UNCATEGORIZED_KENNEL_RUN_NAME,
    "legacy single-area membership is ignored for Kennel Run placement"
  );
  assert.equal(
    dogRunName(resetFake, "multi-legacy"),
    UNCATEGORIZED_KENNEL_RUN_NAME,
    "legacy multi-area membership is ignored for Kennel Run placement"
  );
  assert.equal(dogRunName(resetFake, "missing-run"), UNCATEGORIZED_KENNEL_RUN_NAME);
  assert.equal(dogRunName(resetFake, "hidden-active"), null);
  assert.equal(dogRunName(resetFake, "deceased"), null);
  assert.equal(dogRunName(resetFake, "unowned"), null);
  assert.equal(
    resetFake.rows.some((run) => run.id === "custom-run"),
    true,
    "custom non-Uncategorized runs remain valid"
  );
  assert.equal(
    resetFake.dogs.some((dog) => dog.kennelRunId === "custom-run"),
    false,
    "custom non-Uncategorized runs are emptied by initial reset"
  );
  assert.equal(
    countActiveOwnedRunOwnerMismatches(resetFake),
    0,
    "live ownership guard avoids stale-owner run assignment"
  );

  const foundationDogService = source(
    "apps/web/server/services/foundationDog.service.ts"
  );
  const marketService = source("apps/web/server/services/market.service.ts");
  const breedingService = source("apps/web/server/services/breeding.service.ts");
  const rehomeService = source("apps/web/server/services/rehome.service.ts");
  const dogService = source("apps/web/server/services/dog.service.ts");
  const backfillService = source(
    "apps/web/server/services/kennelRunBackfill.service.ts"
  );

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
  assert.equal(
    backfillService.includes("kennelAreaDog"),
    false,
    "Kennel Run reset does not read legacy KennelAreaDog memberships"
  );

  console.log("Kennel run helper checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
