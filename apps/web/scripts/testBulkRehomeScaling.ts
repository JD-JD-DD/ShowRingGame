import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  RehomeError,
  rehomeOwnedDogsWithClient,
} from "../server/services/rehome.service";

type CareKind = "none" | "ordinary" | "reproductive";

function createRehomeClient(size: number, blocked: CareKind = "none") {
  const dogs = Array.from({ length: size }, (_, index) => ({
    id: `dog-${index}`,
    birthEpoch: 50,
    lifecycleState: "ALIVE",
    kennelRunId: index % 2 === 0 ? "litter-run" : null,
    ownerKennelId: "kennel-1" as string | null,
  }));
  const state = {
    ordinaryQueries: 0, reproductiveQueries: 0, listingUpdates: 0,
    dogUpdates: 0, runDeletes: 0, kennelUpdates: 0,
    ledgerRows: [] as Array<{ dogId: string; amount: number }>,
  };
  const tx = {
    dog: {
      async findMany() {
        return dogs.map(({ ownerKennelId: _ownerKennelId, ...dog }) => dog);
      },
      async updateMany(args: { data: { ownerKennelId: null; lifecycleState: string } }) {
        state.dogUpdates += 1;
        for (const dog of dogs) {
          dog.ownerKennelId = args.data.ownerKennelId;
          dog.lifecycleState = args.data.lifecycleState;
          dog.kennelRunId = null;
        }
        return { count: dogs.length };
      },
    },
    dogEmergencyCareEvent: {
      async findFirst() {
        state.ordinaryQueries += 1;
        return blocked === "ordinary" ? { id: "ordinary-care" } : null;
      },
    },
    reproductiveEmergencyEvent: {
      async findFirst() {
        state.reproductiveQueries += 1;
        return blocked === "reproductive" ? { id: "reproductive-care" } : null;
      },
    },
    breedingAttempt: { async findFirst() { return null; } },
    dogListing: {
      async updateMany() { state.listingUpdates += 1; return { count: size }; },
    },
    kennelRun: {
      async deleteMany() { state.runDeletes += 1; return { count: 1 }; },
    },
    kennel: {
      async update() { state.kennelUpdates += 1; return { balance: 10_000 + size * 100 }; },
    },
    ledgerTransaction: {
      async createMany(args: { data: Array<{ dogId: string; amount: number }> }) {
        state.ledgerRows.push(...args.data);
        return { count: args.data.length };
      },
    },
  };
  return {
    client: { async $transaction(callback: (transaction: typeof tx) => unknown) { return callback(tx); } },
    dogs, state,
  };
}

async function checkSuccessfulBatch(size: number, duplicateFirstId = false) {
  const { client, dogs, state } = createRehomeClient(size);
  const dogIds = dogs.map((dog) => dog.id);
  if (duplicateFirstId) dogIds.push(dogIds[0]);
  const result = await rehomeOwnedDogsWithClient(
    { kennelId: "kennel-1", dogIds, currentEpoch: 150 }, client as never
  );
  assert.equal(result.rehomedCount, size);
  assert.equal(result.creditsAdded, size * 100);
  assert.equal(result.dogIds.length, size, "duplicate IDs do not increase payout");
  assert.equal(state.ordinaryQueries, 1);
  assert.equal(state.reproductiveQueries, 1);
  assert.equal(state.listingUpdates, 1);
  assert.equal(state.dogUpdates, 1);
  assert.equal(state.runDeletes, 1, "litter-run cleanup is set-based");
  assert.equal(state.kennelUpdates, 1, "kennel receives one aggregate credit");
  assert.equal(state.ledgerRows.length, size);
  assert.equal(state.ledgerRows.reduce((total, row) => total + row.amount, 0), size * 100);
  assert.ok(dogs.every((dog) => dog.ownerKennelId === null && dog.lifecycleState === "TRANSFERRED"));
}

async function checkBlockedBatch(blocked: Exclude<CareKind, "none">) {
  const { client, state } = createRehomeClient(100, blocked);
  await assert.rejects(
    rehomeOwnedDogsWithClient(
      { kennelId: "kennel-1", dogIds: Array.from({ length: 100 }, (_, index) => `dog-${index}`), currentEpoch: 150 },
      client as never
    ),
    (error: unknown) =>
      error instanceof RehomeError &&
      error.message === "This dog is awaiting emergency veterinary care."
  );
  assert.equal(state.listingUpdates, 0);
  assert.equal(state.dogUpdates, 0);
  assert.equal(state.kennelUpdates, 0);
  assert.equal(state.ledgerRows.length, 0);
}

async function main() {
  await checkSuccessfulBatch(1);
  await checkSuccessfulBatch(30);
  await checkSuccessfulBatch(100);
  await checkSuccessfulBatch(200);
  await checkSuccessfulBatch(30, true);
  await checkBlockedBatch("ordinary");
  await checkBlockedBatch("reproductive");

  const rehome = readFileSync("server/services/rehome.service.ts", "utf8");
  const route = readFileSync("app/api/dogs/bulk-rehome/route.ts", "utf8");
  assert.match(rehome, /hasPendingVeterinaryCareForDogs\(dogIds, tx\)/);
  assert.doesNotMatch(rehome, /for \(const dogId of dogIds\)[\s\S]{0,160}assertDogHasNoPendingVeterinaryCare/);
  assert.match(rehome, /dogListing\.updateMany/);
  assert.match(rehome, /dog\.updateMany/);
  assert.match(rehome, /kennelRun\.deleteMany/);
  assert.match(route, /error instanceof RehomeError/);
  assert.doesNotMatch(route, /error instanceof Error\s*\? error\.message/);
  console.log("Bulk re-home scaling checks passed for 1, 30, 100, and 200 dogs.");
}

void main();
