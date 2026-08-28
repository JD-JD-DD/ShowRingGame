import assert from "node:assert/strict";

import {
  BulkDogSaleError,
  bulkListDogsForSaleWithClient,
} from "../server/services/market.service";

type Scenario = { underageId?: string; listedId?: string };

function createClient(scenario: Scenario = {}) {
  const createdListings: Array<Record<string, unknown>> = [];
  const state = { marketStateUpdates: 0 };
  const dogFor = (id: string) => ({
    id,
    litterId: null,
    sex: "F",
    ownerKennelId: "kennel-1",
    birthEpoch: scenario.underageId === id ? 45 : 44,
    lifecycleState: "ALIVE",
    marketState: "NOT_FOR_SALE",
  });
  const tx = {
    dog: {
      async findUnique(args: { where: { id: string } }) { return dogFor(args.where.id); },
      async findMany(args: { where: { id: { in: string[] } } }) {
        return args.where.id.in.map((id) => ({ id, regNumber: `REG-${id}` }));
      },
      async updateMany(args: { where: { id: { in: string[] } } }) {
        state.marketStateUpdates += 1;
        return { count: args.where.id.in.length };
      },
    },
    dogEmergencyCareEvent: { async findFirst() { return null; } },
    reproductiveEmergencyEvent: { async findFirst() { return null; } },
    studContractPuppySelection: { async findMany() { return []; } },
    breedingAttempt: { async findFirst() { return null; } },
    dogListing: {
      async findFirst(args: { where: { dogId: string } }) {
        return scenario.listedId === args.where.dogId ? { id: "listing-1" } : null;
      },
      async createMany(args: { data: Array<Record<string, unknown>> }) {
        createdListings.push(...args.data);
        return { count: args.data.length };
      },
    },
  };
  return {
    client: { async $transaction(callback: (transaction: typeof tx) => unknown) { return callback(tx); } },
    createdListings,
    state,
  };
}

async function main() {
  const valid = createClient();
  const result = await bulkListDogsForSaleWithClient({
    sellerKennelId: "kennel-1", currentEpoch: 100,
    updates: [{ dogId: "a", askingPrice: 125 }, { dogId: "b", askingPrice: 999 }],
  }, valid.client as never);
  assert.equal(result.listedCount, 2);
  assert.deepEqual(valid.createdListings.map((listing) => listing.askingPrice), [125, 999]);
  assert.ok(valid.createdListings.every((listing) => listing.sellerType === "PLAYER" && listing.listingType === "PLAYER_PUBLIC" && listing.status === "ACTIVE"));
  assert.equal(valid.state.marketStateUpdates, 1);

  const invalid = createClient({ underageId: "too-young" });
  await assert.rejects(
    bulkListDogsForSaleWithClient({ sellerKennelId: "kennel-1", currentEpoch: 100, updates: [{ dogId: "good", askingPrice: 1 }, { dogId: "too-young", askingPrice: 1 }] }, invalid.client as never),
    (error: unknown) => error instanceof BulkDogSaleError && error.details?.reasonCode === "UNDER_SALE_AGE"
  );
  assert.equal(invalid.createdListings.length, 0, "invalid cohort creates no listings");
  assert.equal(invalid.state.marketStateUpdates, 0, "invalid cohort changes no market states");

  const boundary = createClient();
  await bulkListDogsForSaleWithClient({ sellerKennelId: "kennel-1", currentEpoch: 100, updates: [{ dogId: "boundary", askingPrice: 1 }] }, boundary.client as never);
  assert.equal(boundary.createdListings.length, 1, "exact 56-hour boundary is eligible");
  await assert.rejects(
    bulkListDogsForSaleWithClient({ sellerKennelId: "kennel-1", currentEpoch: 100, updates: [{ dogId: "a", askingPrice: 1.5 }] }, createClient().client as never),
    /whole dollar amount/
  );
  console.log("Bulk dog sale mutation checks passed.");
}

void main();
