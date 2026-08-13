import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  KennelRunServiceError,
  updateKennelRunDogCallNames,
} from "../server/services/kennelRunManagement.service";

type Dog = {
  id: string;
  ownerKennelId: string;
  kennelRunId: string;
  callName: string | null;
};

type FakeClient = {
  kennelRun: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; kennelId: string } | null>;
  };
  dog: {
    findMany(args: { where: { id: { in: string[] } } }): Promise<Array<Pick<Dog, "id" | "ownerKennelId" | "kennelRunId">>>;
    updateMany(args: {
      where: { id: string; ownerKennelId: string; kennelRunId: string };
      data: { callName: string | null };
    }): Promise<{ count: number }>;
  };
  $transaction<T>(work: (tx: FakeClient) => Promise<T>): Promise<T>;
};

function createClient(seedDogs: Dog[]) {
  const dogs = seedDogs.map((dog) => ({ ...dog }));
  const runs = [
    { id: "run-a", kennelId: "kennel-a" },
    { id: "run-b", kennelId: "kennel-b" },
  ];
  const client: FakeClient = {
    kennelRun: {
      async findUnique({ where }: { where: { id: string } }) {
        return runs.find((run) => run.id === where.id) ?? null;
      },
    },
    dog: {
      async findMany({ where }: { where: { id: { in: string[] } } }) {
        return dogs.filter((dog) => where.id.in.includes(dog.id)).map((dog) => ({
          id: dog.id,
          ownerKennelId: dog.ownerKennelId,
          kennelRunId: dog.kennelRunId,
        }));
      },
      async updateMany(args: {
        where: { id: string; ownerKennelId: string; kennelRunId: string };
        data: { callName: string | null };
      }) {
        const dog = dogs.find(
          (candidate) =>
            candidate.id === args.where.id &&
            candidate.ownerKennelId === args.where.ownerKennelId &&
            candidate.kennelRunId === args.where.kennelRunId
        );
        if (!dog) return { count: 0 };
        dog.callName = args.data.callName;
        return { count: 1 };
      },
    },
    async $transaction<T>(work: (tx: FakeClient) => Promise<T>) {
      const snapshot = dogs.map((dog) => ({ ...dog }));
      try {
        return await work(client);
      } catch (error) {
        dogs.splice(0, dogs.length, ...snapshot);
        throw error;
      }
    },
  };

  return { client, dogs };
}

async function assertRejects(work: () => Promise<unknown>, message: string) {
  await assert.rejects(work, KennelRunServiceError, message);
}

async function main() {
  const valid = createClient([
    { id: "dog-a", ownerKennelId: "kennel-a", kennelRunId: "run-a", callName: "Old" },
    { id: "dog-b", ownerKennelId: "kennel-a", kennelRunId: "run-a", callName: "Keep" },
  ]);

  const result = await updateKennelRunDogCallNames({
    kennelId: "kennel-a",
    kennelRunId: "run-a",
    updates: [
      { dogId: "dog-a", callName: "  New Name  " },
      { dogId: "dog-b", callName: "" },
      { dogId: "dog-a", callName: "Final Name" },
    ],
    client: valid.client as never,
  });
  assert.equal(result.updatedCount, 2, "duplicate IDs produce one write per dog");
  assert.equal(valid.dogs[0]?.callName, "Final Name", "last duplicate value is retained");
  assert.equal(valid.dogs[1]?.callName, null, "empty call names clear to null");

  const foreignRun = createClient([{ id: "dog-a", ownerKennelId: "kennel-a", kennelRunId: "run-a", callName: null }]);
  await assertRejects(
    () => updateKennelRunDogCallNames({ kennelId: "kennel-a", kennelRunId: "run-b", updates: [{ dogId: "dog-a", callName: "Name" }], client: foreignRun.client as never }),
    "foreign kennel runs are rejected"
  );

  const stale = createClient([
    { id: "dog-a", ownerKennelId: "kennel-a", kennelRunId: "run-a", callName: "Before" },
    { id: "dog-b", ownerKennelId: "kennel-a", kennelRunId: "other-run", callName: "Other" },
  ]);
  await assertRejects(
    () => updateKennelRunDogCallNames({ kennelId: "kennel-a", kennelRunId: "run-a", updates: [{ dogId: "dog-a", callName: "Changed" }, { dogId: "dog-b", callName: "Invalid" }], client: stale.client as never }),
    "foreign or stale dogs reject the complete request"
  );
  assert.equal(stale.dogs[0]?.callName, "Before", "rejected updates are atomic");

  await assertRejects(
    () => updateKennelRunDogCallNames({ kennelId: "kennel-a", kennelRunId: "run-a", updates: [{ dogId: "dog-a", callName: "x".repeat(46) }], client: valid.client as never }),
    "canonical overlength validation rejects the request"
  );

  const root = process.cwd().endsWith(`${join("apps", "web")}`)
    ? join(process.cwd(), "..", "..")
    : process.cwd();
  const route = readFileSync(join(root, "apps/web/app/api/kennel/dogs/bulk-call-names/route.ts"), "utf8");
  assert.ok(route.includes("getSessionUserId"), "route authenticates requests");
  assert.ok(route.includes("getKennelForUser"), "route resolves the current kennel");
  assert.ok(route.includes("updateKennelRunDogCallNames"), "route delegates to the guarded bulk helper");

  console.log("Bulk call-name checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
