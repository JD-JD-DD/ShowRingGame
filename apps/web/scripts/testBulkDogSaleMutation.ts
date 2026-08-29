import assert from "node:assert/strict";

import {
  BulkDogSaleError,
  bulkListDogsForSaleWithClient,
  getDogSaleEligibility,
} from "../server/services/market.service";

type DogState = {
  ownerKennelId: string;
  birthEpoch?: number;
  lifecycleState?: "ALIVE" | "DECEASED" | "TRANSFERRED";
  marketState?: "NOT_FOR_SALE" | "LISTED_PLAYER";
  pendingCare?: boolean;
  protectedSelection?: boolean;
  breedingStatus?: "INITIATED" | "PREGNANT" | "REPRODUCTIVE_EMERGENCY";
};

function createClient(dogs: Record<string, DogState>, options: { updateCount?: number } = {}) {
  const records = Object.fromEntries(
    Object.entries(dogs).map(([id, dog]) => [id, {
      id,
      litterId: dog.protectedSelection ? `litter-${id}` : null,
      regNumber: `REG-${id}`,
      sex: "F",
      ownerKennelId: dog.ownerKennelId,
      birthEpoch: dog.birthEpoch ?? 44,
      lifecycleState: dog.lifecycleState ?? "ALIVE",
      marketState: dog.marketState ?? "NOT_FOR_SALE",
      pendingCare: dog.pendingCare ?? false,
      protectedSelection: dog.protectedSelection ?? false,
      breedingStatus: dog.breedingStatus ?? null,
    }]),
  );
  const createdListings: Array<Record<string, unknown>> = [];
  const calls = {
    dogFindMany: 0,
    listingFindMany: 0,
    breedingFindMany: 0,
    breedingFindFirst: 0,
    ordinaryCareFindMany: 0,
    reproductiveCareFindMany: 0,
    protectionFindMany: 0,
  };

  const tx = {
    dog: {
      async findUnique(args: { where: { id: string } }) {
        return records[args.where.id] ?? null;
      },
      async findMany(args: { where: { id: { in: string[] } } }) {
        calls.dogFindMany += 1;
        return args.where.id.in.flatMap((id) => records[id] ? [records[id]] : []);
      },
      async updateMany(args: {
        where: { id: { in: string[] }; ownerKennelId: string; lifecycleState: string; marketState: string };
        data: { marketState: "LISTED_PLAYER" };
      }) {
        const matching = args.where.id.in.filter((id) => {
          const dog = records[id];
          return dog && dog.ownerKennelId === args.where.ownerKennelId && dog.lifecycleState === args.where.lifecycleState && dog.marketState === args.where.marketState;
        });
        for (const id of matching) records[id].marketState = args.data.marketState;
        return { count: options.updateCount ?? matching.length };
      },
    },
    dogEmergencyCareEvent: {
      async findFirst(args: { where: { dogId: string } }) {
        return records[args.where.dogId]?.pendingCare ? { id: "care-1" } : null;
      },
      async findMany(args: { where: { dogId: { in: string[] } } }) {
        calls.ordinaryCareFindMany += 1;
        return args.where.dogId.in.flatMap((id) => records[id]?.pendingCare ? [{ dogId: id }] : []);
      },
    },
    reproductiveEmergencyEvent: {
      async findFirst() { return null; },
      async findMany() {
        calls.reproductiveCareFindMany += 1;
        return [];
      },
    },
    studContractPuppySelection: {
      async findMany() {
        calls.protectionFindMany += 1;
        return Object.values(records)
          .filter((dog) => dog.protectedSelection)
          .map((dog) => ({
            id: `selection-${dog.id}`,
            litterId: dog.litterId,
            status: "DAM_FIRST_PICK",
            damFirstPickDogId: null,
            selectedDogId: null,
            contract: { id: `contract-${dog.id}`, puppyPickPosition: "FIRST", puppySex: "EITHER" },
          }));
      },
    },
    breedingAttempt: {
      async findFirst(args: { where: { damId: string } }) {
        calls.breedingFindFirst += 1;
        return records[args.where.damId]?.breedingStatus ? { id: "attempt-1" } : null;
      },
      async findMany(args: { where: { damId: { in: string[] } } }) {
        calls.breedingFindMany += 1;
        return args.where.damId.in.flatMap((id) => records[id]?.breedingStatus ? [{ damId: id }] : []);
      },
    },
    dogListing: {
      async findFirst(args: { where: { dogId: string } }) {
        return createdListings.find((listing) => listing.dogId === args.where.dogId && listing.status === "ACTIVE") ?? null;
      },
      async findMany(args: { where: { dogId: { in: string[] } } }) {
        calls.listingFindMany += 1;
        return createdListings.filter((listing) => args.where.dogId.in.includes(listing.dogId as string) && listing.status === "ACTIVE").map((listing) => ({ dogId: listing.dogId }));
      },
      async createMany(args: { data: Array<Record<string, unknown>> }) {
        createdListings.push(...args.data);
        return { count: args.data.length };
      },
    },
  };

  return {
    client: {
      async $transaction(callback: (transaction: typeof tx) => unknown) {
        const recordsBefore = structuredClone(records);
        const listingsBefore = structuredClone(createdListings);
        try {
          return await callback(tx);
        } catch (error) {
          Object.assign(records, recordsBefore);
          createdListings.splice(0, createdListings.length, ...listingsBefore);
          throw error;
        }
      },
    },
    records,
    createdListings,
    calls,
  };
}

const saleArgs = (updates: Array<{ dogId: string; askingPrice: number }>) => ({
  sellerKennelId: "kennel-1",
  currentEpoch: 100,
  updates,
});

async function expectIneligible(
  client: ReturnType<typeof createClient>,
  updates: Array<{ dogId: string; askingPrice: number }>,
  reasonCode: string,
) {
  await assert.rejects(
    bulkListDogsForSaleWithClient(saleArgs(updates), client.client as never),
    (error: unknown) => error instanceof BulkDogSaleError && error.details?.reasonCode === reasonCode,
  );
  assert.equal(client.createdListings.length, 0, "ineligible cohorts create no listings");
  assert.ok(Object.values(client.records).every((dog) => dog.marketState !== "LISTED_PLAYER"), "ineligible cohorts change no market states");
}

async function main() {
  const valid = createClient({ a: { ownerKennelId: "kennel-1" }, b: { ownerKennelId: "kennel-1" } });
  const result = await bulkListDogsForSaleWithClient(saleArgs([
    { dogId: "a", askingPrice: 1 }, { dogId: "b", askingPrice: 999_999_999 },
  ]), valid.client as never);
  assert.equal(result.listedCount, 2);
  assert.deepEqual(valid.createdListings.map((listing) => listing.askingPrice), [1, 999_999_999]);
  assert.ok(valid.createdListings.every((listing) =>
    listing.sellerKennelId === "kennel-1" && listing.sellerType === "PLAYER" && listing.listingType === "PLAYER_PUBLIC" && listing.status === "ACTIVE" && listing.listedAtEpoch === 100
  ));
  assert.deepEqual(valid.createdListings.map((listing) => listing.descriptionPublic), ["Player listing for REG-a.", "Player listing for REG-b."]);
  assert.equal(valid.records.a.marketState, "LISTED_PLAYER");
  assert.equal(valid.records.b.marketState, "LISTED_PLAYER");
  assert.deepEqual(valid.calls, {
    dogFindMany: 1,
    listingFindMany: 1,
    breedingFindMany: 1,
    breedingFindFirst: 0,
    ordinaryCareFindMany: 1,
    reproductiveCareFindMany: 1,
    protectionFindMany: 0,
  }, "bulk eligibility reads are set-based");

  const large = createClient(Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`dog-${index}`, { ownerKennelId: "kennel-1" }])));
  await bulkListDogsForSaleWithClient(saleArgs(Array.from({ length: 100 }, (_, index) => ({ dogId: `dog-${index}`, askingPrice: index + 1 }))), large.client as never);
  assert.equal(large.calls.dogFindMany, 1);
  assert.equal(large.calls.listingFindMany, 1);
  assert.equal(large.calls.breedingFindMany, 1);
  assert.equal(large.calls.breedingFindFirst, 0);
  assert.equal(large.calls.ordinaryCareFindMany, 1);
  assert.equal(large.calls.reproductiveCareFindMany, 1);

  const boundary = createClient({ boundary: { ownerKennelId: "kennel-1", birthEpoch: 44 } });
  await bulkListDogsForSaleWithClient(saleArgs([{ dogId: "boundary", askingPrice: 1 }]), boundary.client as never);
  assert.equal(boundary.createdListings.length, 1, "exact shared sale-age boundary is eligible");
  await expectIneligible(createClient({ young: { ownerKennelId: "kennel-1", birthEpoch: 45 } }), [{ dogId: "young", askingPrice: 1 }], "UNDER_SALE_AGE");
  await expectIneligible(createClient({ deceased: { ownerKennelId: "kennel-1", lifecycleState: "DECEASED" } }), [{ dogId: "deceased", askingPrice: 1 }], "NOT_ACTIVE");
  await expectIneligible(createClient({ foreign: { ownerKennelId: "kennel-2" } }), [{ dogId: "foreign", askingPrice: 1 }], "NOT_OWNED");
  await expectIneligible(createClient({ pending: { ownerKennelId: "kennel-1", pendingCare: true } }), [{ dogId: "pending", askingPrice: 1 }], "PENDING_VET_CARE");
  await expectIneligible(createClient({ protected: { ownerKennelId: "kennel-1", protectedSelection: true } }), [{ dogId: "protected", askingPrice: 1 }], "STUD_CONTRACT_SELECTION_PROTECTED");
  for (const breedingStatus of ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"] as const) {
    await expectIneligible(createClient({ dam: { ownerKennelId: "kennel-1", breedingStatus } }), [{ dogId: "dam", askingPrice: 1 }], "BREEDING_CONFLICT");
  }

  const stale = createClient({ stale: { ownerKennelId: "kennel-1" }, good: { ownerKennelId: "kennel-1" } });
  assert.equal((await getDogSaleEligibility({ dogId: "stale", sellerKennelId: "kennel-1", currentEpoch: 100, client: stale.client as never })).eligible, true, "preflight is initially eligible");
  stale.records.stale.ownerKennelId = "kennel-2";
  await expectIneligible(stale, [{ dogId: "good", askingPrice: 10 }, { dogId: "stale", askingPrice: 20 }], "NOT_OWNED");

  const pendingAfterPreflight = createClient({ dog: { ownerKennelId: "kennel-1" } });
  assert.equal((await getDogSaleEligibility({ dogId: "dog", sellerKennelId: "kennel-1", currentEpoch: 100, client: pendingAfterPreflight.client as never })).eligible, true);
  pendingAfterPreflight.records.dog.pendingCare = true;
  await expectIneligible(pendingAfterPreflight, [{ dogId: "dog", askingPrice: 10 }], "PENDING_VET_CARE");

  const protectedAfterPreflight = createClient({ dog: { ownerKennelId: "kennel-1" } });
  protectedAfterPreflight.records.dog.protectedSelection = true;
  await expectIneligible(protectedAfterPreflight, [{ dogId: "dog", askingPrice: 10 }], "STUD_CONTRACT_SELECTION_PROTECTED");

  const mixed = createClient(Object.fromEntries([
    ...Array.from({ length: 10 }, (_, index) => [`valid-${index}`, { ownerKennelId: "kennel-1" }]),
    ["foreign", { ownerKennelId: "kennel-2" }],
  ]));
  await expectIneligible(mixed, [
    ...Array.from({ length: 10 }, (_, index) => ({ dogId: `valid-${index}`, askingPrice: index + 1 })),
    { dogId: "foreign", askingPrice: 99 },
  ], "NOT_OWNED");

  const rollback = createClient({ a: { ownerKennelId: "kennel-1" }, b: { ownerKennelId: "kennel-1" } }, { updateCount: 1 });
  await assert.rejects(bulkListDogsForSaleWithClient(saleArgs([{ dogId: "a", askingPrice: 1 }, { dogId: "b", askingPrice: 2 }]), rollback.client as never), BulkDogSaleError);
  assert.equal(rollback.createdListings.length, 0, "late guarded-update failure rolls back created listings");
  assert.equal(rollback.records.a.marketState, "NOT_FOR_SALE", "late guarded-update failure rolls back state changes");

  for (const price of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, "not-a-number" as never]) {
    await assert.rejects(bulkListDogsForSaleWithClient(saleArgs([{ dogId: "a", askingPrice: price }]), createClient({ a: { ownerKennelId: "kennel-1" } }).client as never), /whole dollar amount/);
  }
  console.log("Bulk dog sale mutation checks passed.");
}

void main();
