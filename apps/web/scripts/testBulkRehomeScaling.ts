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
    returnServiceUpdates: 0,
    ledgerRows: [] as Array<{ dogId: string; amount: number }>,
  };
  const returnServices = [
    { id: "sire-match", sireDogId: "dog-0", damDogId: "unrelated-dam", status: "AVAILABLE", reason: null as string | null },
    { id: "dam-match", sireDogId: "unrelated-sire", damDogId: `dog-${Math.min(1, size - 1)}`, status: "AVAILABLE", reason: null as string | null },
    { id: "both-match", sireDogId: "dog-0", damDogId: "dog-0", status: "AVAILABLE", reason: null as string | null },
    { id: "unrelated", sireDogId: "unrelated-sire", damDogId: "unrelated-dam", status: "AVAILABLE", reason: null as string | null },
  ];
  const tx = {
    dog: {
      async findMany() {
        return dogs.map((dog) => ({
          id: dog.id,
          birthEpoch: dog.birthEpoch,
          lifecycleState: dog.lifecycleState,
          kennelRunId: dog.kennelRunId,
        }));
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
      async findMany() {
        state.ordinaryQueries += 1;
        return blocked === "ordinary" ? [{ dogId: "dog-0" }] : [];
      },
    },
    reproductiveEmergencyEvent: {
      async findMany() {
        state.reproductiveQueries += 1;
        return blocked === "reproductive" ? [{ damId: "dog-0" }] : [];
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
    studContractReturnService: {
      async updateMany(args: {
        where: { status: string; contract: { sireDogId?: { in: string[] }; damDogId?: { in: string[] } } };
        data: { status: string; extinguishmentReason: string };
      }) {
        state.returnServiceUpdates += 1;
        const matchingDogIds = args.where.contract.sireDogId?.in ?? args.where.contract.damDogId?.in ?? [];
        const side = args.where.contract.sireDogId ? "sireDogId" : "damDogId";
        const matches = returnServices.filter((service) => service.status === args.where.status && matchingDogIds.includes(service[side]));
        for (const service of matches) {
          service.status = args.data.status;
          service.reason = args.data.extinguishmentReason;
        }
        return { count: matches.length };
      },
    },
  };
  return {
    client: { async $transaction(callback: (transaction: typeof tx) => unknown) { return callback(tx); } },
    dogs, state, returnServices,
  };
}

async function checkSuccessfulBatch(size: number, duplicateFirstId = false) {
  const { client, dogs, state, returnServices } = createRehomeClient(size);
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
  assert.equal(state.returnServiceUpdates, 2, "return-service cleanup stays constant regardless of batch size");
  assert.equal(returnServices.find((service) => service.id === "sire-match")?.reason, "SIRE_OWNERSHIP_CHANGED");
  assert.equal(returnServices.find((service) => service.id === "dam-match")?.reason, "DAM_OWNERSHIP_CHANGED");
  assert.equal(returnServices.find((service) => service.id === "both-match")?.reason, "SIRE_OWNERSHIP_CHANGED", "a row matching both sides is safely extinguished once");
  assert.equal(returnServices.find((service) => service.id === "unrelated")?.status, "AVAILABLE", "unrelated return services remain available");
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
  const returnService = readFileSync("server/services/studContractReturnService.service.ts", "utf8");
  const kennelRuns = readFileSync("server/services/kennelRun.service.ts", "utf8");
  const route = readFileSync("app/api/dogs/bulk-rehome/route.ts", "utf8");
  assert.match(rehome, /hasPendingVeterinaryCareForDogs\(dogIds, tx\)/);
  assert.doesNotMatch(rehome, /for \(const dogId of dogIds\)[\s\S]{0,160}assertDogHasNoPendingVeterinaryCare/);
  assert.match(rehome, /dogListing\.updateMany/);
  assert.match(rehome, /dog\.updateMany/);
  assert.match(rehome, /deleteEmptyLitterRuns/);
  assert.match(rehome, /extinguishStudContractReturnServicesForDogs/);
  assert.doesNotMatch(rehome, /for \(const dogId of dogIds\)[\s\S]{0,300}studContractReturnService/);
  assert.match(returnService, /contract: \{ sireDogId: \{ in: args\.dogIds \} \}/);
  assert.match(returnService, /contract: \{ damDogId: \{ in: args\.dogIds \} \}/);
  assert.match(kennelRuns, /kennelRun\.deleteMany/);
  assert.match(route, /error instanceof RehomeError/);
  assert.doesNotMatch(route, /error instanceof Error\s*\? error\.message/);
  console.log("Bulk re-home scaling checks passed for 1, 30, 100, and 200 dogs.");
}

void main();
