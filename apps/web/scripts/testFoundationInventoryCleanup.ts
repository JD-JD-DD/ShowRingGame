import assert from "node:assert/strict";

import { reserveDogRegistrations } from "../server/services/dogRegistration.service";
import { cleanupExpiredFoundationInventoryCandidateInTransaction } from "../server/services/foundationDog.service";

const zeroCounts = {
  sireOf: 0, damOf: 0, breedingAttemptsAsSire: 0, breedingAttemptsAsDam: 0,
  reproductiveEmergencies: 0, siredLitters: 0, dammedLitters: 0, showEntries: 0,
  showResults: 0, showAwards: 0, grandChampionCredits: 0, showPrestigeCredits: 0,
  yearlyPrestigeStats: 0, ledgerTransactions: 0, healthTests: 0,
  infectiousDiseaseTests: 0, privateKennelNotes: 0, plannerTags: 0,
  serviceClaims: 0, groomingListings: 0, groomingServiceActions: 0, conditionEvents: 0,
};

function fixture(options: { soldHistory?: boolean; failDogDelete?: boolean; alreadyExpired?: boolean } = {}) {
  const state = {
    dogExists: true,
    marketState: options.alreadyExpired ? "NOT_FOR_SALE" : "LISTED_NPC",
    listingExists: true,
    listingStatus: options.alreadyExpired ? "EXPIRED" : "ACTIVE",
    healthTruthExists: true,
    diseaseExists: true,
    emergencyExists: true,
  };
  const listings = () => [
    ...(state.listingExists ? [{ id: "listing", sellerType: "SYSTEM", listingType: "FOUNDATION", status: state.listingStatus, buyerKennelId: null }] : []),
    ...(options.soldHistory ? [{ id: "sold", sellerType: "SYSTEM", listingType: "FOUNDATION", status: "SOLD", buyerKennelId: "kennel" }] : []),
  ];
  const row = () => state.dogExists ? {
    originType: "FOUNDATION", isFoundation: true, ownerKennelId: null,
    lifecycleState: "ALIVE", marketState: state.marketState,
    listings: listings(),
    healthConditionTruths: state.healthTruthExists ? [{ id: "truth" }] : [],
    titleProgress: null,
    infectiousDiseaseStatuses: state.diseaseExists ? [{ id: "disease", diseaseCode: "BRUCELLOSIS", status: "INFECTED", sourceDogId: null, sourceBreedingAttemptId: null }] : [],
    emergencyCareEvents: state.emergencyExists ? [{ id: "emergency", status: "PENDING", kennelIdAtEvent: null, ledgerTransactionId: null }] : [],
    _count: zeroCounts,
  } : null;
  const tx = {
    dogListing: {
      findUnique: async () => state.listingExists ? { id: "listing", dogId: "dog", sellerType: "SYSTEM", listingType: "FOUNDATION", status: state.listingStatus, expiresAtEpoch: 49, dog: { breedCode2: "AB", ownerKennelId: null, lifecycleState: "ALIVE", marketState: state.marketState, originType: "FOUNDATION", isFoundation: true } } : null,
      updateMany: async () => {
        if (!state.listingExists || state.listingStatus !== "ACTIVE") return { count: 0 };
        state.listingStatus = "EXPIRED";
        return { count: 1 };
      },
      deleteMany: async () => { state.listingExists = false; return { count: 1 }; },
    },
    dog: {
      findUnique: async () => row(),
      updateMany: async () => {
        if (!state.dogExists || state.marketState !== "LISTED_NPC") return { count: 0 };
        state.marketState = "NOT_FOR_SALE";
        return { count: 1 };
      },
      delete: async () => {
        if (options.failDogDelete) throw new Error("unexpected restrictive FK");
        state.dogExists = false;
      },
    },
    dogEmergencyCareEvent: { deleteMany: async () => { state.emergencyExists = false; return { count: 1 }; } },
    dogInfectiousDiseaseStatus: { deleteMany: async () => { state.diseaseExists = false; return { count: 1 }; } },
    dogHealthConditionTruth: { deleteMany: async () => { state.healthTruthExists = false; return { count: 1 }; } },
  };
  const database = {
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => {
      const snapshot = { ...state };
      try { return await operation(tx); } catch (error) { Object.assign(state, snapshot); throw error; }
    },
  };
  return { state, database };
}

async function cleanup(database: unknown) {
  return (database as { $transaction: (operation: (client: never) => Promise<unknown>) => Promise<unknown> }).$transaction(
    (tx) => cleanupExpiredFoundationInventoryCandidateInTransaction(tx, {
      candidate: { listingId: "listing", dogId: "dog" }, currentEpoch: 49,
    })
  );
}

async function main() {
  const reservations = new Set<string>();
  const reservationClient = { dogRegistrationReservation: { createMany: async ({ data }: { data: Array<{ regNumber: string }> }) => {
    if (data.some(({ regNumber }) => reservations.has(regNumber))) throw { code: "P2002" };
    data.forEach(({ regNumber }) => reservations.add(regNumber)); return { count: data.length };
  } } };
  await reserveDogRegistrations(reservationClient as never, ["AB000000101"]);

  const pristine = fixture();
  assert.equal(await cleanup(pristine.database), "DELETED_AFTER_EXPIRATION");
  assert.deepEqual(pristine.state, { dogExists: false, marketState: "NOT_FOR_SALE", listingExists: false, listingStatus: "EXPIRED", healthTruthExists: false, diseaseExists: false, emergencyExists: false });
  assert.equal(reservations.has("AB000000101"), true, "cleanup does not release the permanent registration reservation");
  await assert.rejects(() => reserveDogRegistrations(reservationClient as never, ["AB000000101"]), "deleted Dog registration remains unavailable");

  const historical = fixture({ alreadyExpired: true });
  assert.equal(await cleanup(historical.database), "DELETED", "already-expired disposable inventory is cleaned");
  assert.equal(historical.state.dogExists, false);

  const protectedDog = fixture({ soldHistory: true });
  assert.equal(await cleanup(protectedDog.database), "PROTECTED_AFTER_EXPIRATION");
  assert.equal(protectedDog.state.dogExists, true, "SOLD history is retained");
  assert.equal(protectedDog.state.listingExists, true, "protected listing history is retained");

  const failing = fixture({ failDogDelete: true });
  await assert.rejects(() => cleanup(failing.database));
  assert.equal(failing.state.dogExists, true, "failed Dog deletion rolls back the candidate transaction");
  assert.equal(failing.state.healthTruthExists, true, "child deletion cannot partially commit");
  assert.equal(failing.state.listingExists, true, "listing deletion cannot partially commit");
  console.log("Foundation inventory cleanup checks passed.");
}

void main();
