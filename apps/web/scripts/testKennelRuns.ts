import { strict as assert } from "node:assert";

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

function projectRun(run: FakeKennelRun): FakeKennelRun {
  return { ...run };
}

function createFakeClient() {
  const rows: FakeKennelRun[] = [];
  let nextId = 1;

  return {
    rows,
    client: {
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
        }) {
          return rows
            .filter((row) => row.kennelId === args.where.kennelId)
            .filter((row) =>
              args.where.name?.in ? args.where.name.in.includes(row.name) : true
            )
            .sort(
              (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
            )
            .map(projectRun);
        },
      },
    },
  };
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

  console.log("Kennel run helper checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
