import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  KennelRunServiceError,
  createKennelRun,
  deleteKennelRun,
  listKennelRuns,
  moveDogsToKennelRun,
  updateKennelRun,
} from "@/server/services/kennelRunManagement.service";
import {
  STARTER_KENNEL_RUNS,
  UNCATEGORIZED_KENNEL_RUN_NAME,
} from "@/server/services/kennelRun.service";

type FakeRun = {
  id: string;
  kennelId: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type FakeDog = {
  id: string;
  ownerKennelId: string | null;
  kennelRunId: string | null;
  lifecycleState: string;
  isPlayerVisible: boolean;
  marketState: string;
};

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), label);
}

function assertExcludes(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), label);
}

async function assertRejectsServiceError(
  fn: () => Promise<unknown>,
  label: string
) {
  await assert.rejects(
    fn,
    (error) => error instanceof KennelRunServiceError,
    label
  );
}

function createFakeClient(seed: { runs: FakeRun[]; dogs: FakeDog[] }) {
  const runs = seed.runs;
  const dogs = seed.dogs;
  let nextRunId = 1;

  const client: any = {
    kennelRun: {
      async upsert(args: {
        where: { kennelId_name: { kennelId: string; name: string } };
        update: Pick<FakeRun, "sortOrder" | "isSystem">;
        create: Pick<FakeRun, "kennelId" | "name" | "sortOrder" | "isSystem">;
        select?: Record<string, boolean>;
      }) {
        const key = args.where.kennelId_name;
        const existing = runs.find(
          (run) => run.kennelId === key.kennelId && run.name === key.name
        );

        if (existing) {
          existing.sortOrder = args.update.sortOrder;
          existing.isSystem = args.update.isSystem;
          return { ...existing };
        }

        const created = {
          id: `created-run-${nextRunId}`,
          kennelId: args.create.kennelId,
          name: args.create.name,
          sortOrder: args.create.sortOrder,
          isSystem: args.create.isSystem,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        };
        nextRunId += 1;
        runs.push(created);
        return { ...created };
      },
      async findMany(args: {
        where: {
          kennelId?: string | { in: string[] };
          id?: { in: string[] };
          name?: string | { in: string[] };
          isSystem?: boolean;
        };
        orderBy?: Array<Record<string, string>>;
      }) {
        const kennelIds =
          typeof args.where.kennelId === "string"
            ? [args.where.kennelId]
            : args.where.kennelId?.in;
        const names =
          typeof args.where.name === "string"
            ? [args.where.name]
            : args.where.name?.in;

        return runs
          .filter((run) => (kennelIds ? kennelIds.includes(run.kennelId) : true))
          .filter((run) => (args.where.id?.in ? args.where.id.in.includes(run.id) : true))
          .filter((run) => (names ? names.includes(run.name) : true))
          .filter((run) =>
            args.where.isSystem === undefined
              ? true
              : run.isSystem === args.where.isSystem
          )
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
          .map((run) => ({ ...run }));
      },
      async findFirst(args: {
        where: { kennelId: string; name?: string; id?: { not: string } };
        orderBy?: { sortOrder: "desc" };
      }) {
        let result = runs
          .filter((run) => run.kennelId === args.where.kennelId)
          .filter((run) => (args.where.name ? run.name === args.where.name : true))
          .filter((run) => (args.where.id?.not ? run.id !== args.where.id.not : true));

        if (args.orderBy?.sortOrder === "desc") {
          result = result.sort((a, b) => b.sortOrder - a.sortOrder);
        }

        return result[0] ? { ...result[0] } : null;
      },
      async findUnique(args: { where: { id: string } }) {
        const run = runs.find((candidate) => candidate.id === args.where.id);
        return run ? { ...run } : null;
      },
      async create(args: {
        data: Pick<FakeRun, "kennelId" | "name" | "sortOrder" | "isSystem">;
      }) {
        const created = {
          id: `custom-run-${nextRunId}`,
          kennelId: args.data.kennelId,
          name: args.data.name,
          sortOrder: args.data.sortOrder,
          isSystem: args.data.isSystem,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        };
        nextRunId += 1;
        runs.push(created);
        return { ...created };
      },
      async update(args: {
        where: { id: string };
        data: Partial<Pick<FakeRun, "name" | "sortOrder">>;
      }) {
        const run = runs.find((candidate) => candidate.id === args.where.id);
        assert.ok(run, "fake run should exist before update");
        Object.assign(run, args.data);
        return { ...run };
      },
      async delete(args: { where: { id: string } }) {
        const index = runs.findIndex((run) => run.id === args.where.id);
        assert.ok(index >= 0, "fake run should exist before delete");
        const [deleted] = runs.splice(index, 1);
        return { ...deleted };
      },
    },
    dog: {
      async findMany(args: {
        where: {
          id?: { in: string[] };
          ownerKennelId?: string;
          lifecycleState?: string;
          isPlayerVisible?: boolean;
          kennelRunId?: { in: string[] };
        };
      }) {
        return dogs
          .filter((dog) =>
            args.where.id?.in ? args.where.id.in.includes(dog.id) : true
          )
          .filter((dog) =>
            args.where.ownerKennelId
              ? dog.ownerKennelId === args.where.ownerKennelId
              : true
          )
          .filter((dog) =>
            args.where.lifecycleState
              ? dog.lifecycleState === args.where.lifecycleState
              : true
          )
          .filter((dog) =>
            args.where.isPlayerVisible === undefined
              ? true
              : dog.isPlayerVisible === args.where.isPlayerVisible
          )
          .filter((dog) =>
            args.where.kennelRunId?.in
              ? dog.kennelRunId !== null &&
                args.where.kennelRunId.in.includes(dog.kennelRunId)
              : true
          )
          .map((dog) => ({ ...dog }));
      },
      async updateMany(args: {
        where: {
          id?: { in: string[] };
          ownerKennelId?: string;
          kennelRunId?: string;
        };
        data: { kennelRunId: string | null };
      }) {
        let count = 0;

        for (const dog of dogs) {
          const matchesId = args.where.id?.in
            ? args.where.id.in.includes(dog.id)
            : true;
          const matchesOwner = args.where.ownerKennelId
            ? dog.ownerKennelId === args.where.ownerKennelId
            : true;
          const matchesRun = args.where.kennelRunId
            ? dog.kennelRunId === args.where.kennelRunId
            : true;

          if (matchesId && matchesOwner && matchesRun) {
            dog.kennelRunId = args.data.kennelRunId;
            count += 1;
          }
        }

        return { count };
      },
    },
    async $transaction<T>(fn: (tx: typeof client) => Promise<T>): Promise<T> {
      return fn(client);
    },
  };

  return {
    client,
    runs,
    dogs,
  };
}

async function main() {
  const kennelId = "kennel-1";
  const otherKennelId = "kennel-2";
  const emptyFake = createFakeClient({
    runs: [],
    dogs: [],
  });
  const initializedRuns = await listKennelRuns({
    kennelId: "empty-kennel",
    client: emptyFake.client as never,
  });

  assert.ok(
    STARTER_KENNEL_RUNS.every((starterRun) =>
      initializedRuns.some((run) => run.name === starterRun.name)
    ),
    "GET-style list initializes starter runs for a kennel with no runs"
  );

  const fake = createFakeClient({
    runs: [
      {
        id: "uncategorized",
        kennelId,
        name: UNCATEGORIZED_KENNEL_RUN_NAME,
        sortOrder: 0,
        isSystem: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      {
        id: "specials",
        kennelId,
        name: "Specials",
        sortOrder: 1,
        isSystem: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      ...STARTER_KENNEL_RUNS.filter(
        (run) => ![UNCATEGORIZED_KENNEL_RUN_NAME, "Specials"].includes(run.name)
      ).map((run) => ({
        id: `starter-${run.sortOrder}`,
        kennelId,
        name: run.name,
        sortOrder: run.sortOrder,
        isSystem: run.isSystem,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })),
      {
        id: "other-run",
        kennelId: otherKennelId,
        name: UNCATEGORIZED_KENNEL_RUN_NAME,
        sortOrder: 0,
        isSystem: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ],
    dogs: [
      {
        id: "dog-a",
        ownerKennelId: kennelId,
        kennelRunId: "uncategorized",
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
        marketState: "NOT_FOR_SALE",
      },
      {
        id: "dog-b",
        ownerKennelId: kennelId,
        kennelRunId: "specials",
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
        marketState: "NOT_FOR_SALE",
      },
      {
        id: "dog-c",
        ownerKennelId: otherKennelId,
        kennelRunId: "other-run",
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
        marketState: "NOT_FOR_SALE",
      },
    ],
  });

  const listed = await listKennelRuns({
    kennelId,
    client: fake.client as never,
  });

  assert.ok(
    STARTER_KENNEL_RUNS.every((starterRun) =>
      listed.some((run) => run.name === starterRun.name)
    ),
    "GET-style list returns existing starter runs"
  );
  assert.equal(
    listed.find((run) => run.id === "uncategorized")?.dogCount,
    1,
    "list includes active visible dog counts"
  );
  assert.equal(
    listed.find((run) => run.name === "Brood Bitches")?.dogCount,
    0,
    "empty starter runs are returned with dogCount 0"
  );

  const customRun = await createKennelRun({
    kennelId,
    name: " Sale Prospects 2 ",
    client: fake.client as never,
  });
  assert.equal(customRun.name, "Sale Prospects 2");
  assert.equal(customRun.isSystem, false);

  await assertRejectsServiceError(
    () => createKennelRun({ kennelId, name: "Specials", client: fake.client as never }),
    "duplicate run names are rejected"
  );

  const renamed = await updateKennelRun({
    kennelId,
    runId: customRun.id,
    name: "Yearlings",
    sortOrder: 42,
    client: fake.client as never,
  });
  assert.equal(renamed.name, "Yearlings");
  assert.equal(renamed.sortOrder, 42);

  await assertRejectsServiceError(
    () =>
      updateKennelRun({
        kennelId,
        runId: "uncategorized",
        name: "Inbox",
        client: fake.client as never,
      }),
    "system run cannot be renamed"
  );

  await assertRejectsServiceError(
    () =>
      deleteKennelRun({
        kennelId,
        runId: "uncategorized",
        client: fake.client as never,
      }),
    "system run cannot be deleted"
  );

  const deleteResult = await deleteKennelRun({
    kennelId,
    runId: "specials",
    client: fake.client as never,
  });
  assert.equal(deleteResult.movedCount, 1);
  assert.equal(
    fake.dogs.find((dog) => dog.id === "dog-b")?.kennelRunId,
    "uncategorized",
    "delete moves dogs to Uncategorized"
  );
  assert.equal(
    fake.runs.some((run) => run.id === "specials"),
    false,
    "deleted run is removed"
  );

  const moveResult = await moveDogsToKennelRun({
    kennelId,
    dogIds: ["dog-a", "dog-b"],
    targetRunId: customRun.id,
    client: fake.client as never,
  });
  assert.equal(moveResult.movedCount, 2);
  assert.ok(
    fake.dogs
      .filter((dog) => ["dog-a", "dog-b"].includes(dog.id))
      .every((dog) => dog.kennelRunId === customRun.id),
    "bulk move changes kennelRunId only"
  );
  assert.equal(
    fake.dogs.find((dog) => dog.id === "dog-a")?.marketState,
    "NOT_FOR_SALE",
    "bulk move does not alter market state"
  );

  await assertRejectsServiceError(
    () =>
      moveDogsToKennelRun({
        kennelId,
        dogIds: ["dog-c"],
        targetRunId: customRun.id,
        client: fake.client as never,
      }),
    "bulk move rejects another kennel's dog"
  );
  await assertRejectsServiceError(
    () =>
      moveDogsToKennelRun({
        kennelId,
        dogIds: ["dog-a"],
        targetRunId: "other-run",
        client: fake.client as never,
      }),
    "bulk move rejects another kennel's target run"
  );

  const mineRoute = source("apps/web/app/api/dogs/mine/route.ts");
  assertIncludes(mineRoute, 'url.searchParams.get("runId")', "mine API supports one run filter");
  assertIncludes(mineRoute, 'url.searchParams.get("runIds")', "mine API supports multiple run filter");
  assertIncludes(mineRoute, "Use either runId or runIds", "mine API rejects mixed filters");
  assertIncludes(mineRoute, "kennelRunId: dog.kennelRunId", "mine API returns kennelRunId");
  assertIncludes(mineRoute, "currentRun:", "mine API returns current run details");
  assertExcludes(mineRoute, "areaIds", "mine API no longer returns legacy areaIds");
  assertExcludes(mineRoute, "areas,", "mine API no longer returns legacy areas");

  const newApiSources = [
    source("apps/web/app/api/kennel/runs/route.ts"),
    source("apps/web/app/api/kennel/runs/[runId]/route.ts"),
    source("apps/web/app/api/kennel/dogs/run/route.ts"),
    source("apps/web/server/services/kennelRunManagement.service.ts"),
  ].join("\n");
  assert.equal(
    newApiSources.includes("areaIds"),
    false,
    "new Kennel Run APIs do not return legacy area IDs"
  );

  console.log("Kennel Run API checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
