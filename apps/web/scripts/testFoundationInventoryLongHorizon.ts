import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { reserveDogRegistrations } from "../server/services/dogRegistration.service";
import { cleanupExpiredFoundationInventoryCandidateInTransaction } from "../server/services/foundationDog.service";

const zeroCounts = { sireOf: 0, damOf: 0, breedingAttemptsAsSire: 0, breedingAttemptsAsDam: 0, reproductiveEmergencies: 0, siredLitters: 0, dammedLitters: 0, showEntries: 0, showResults: 0, showAwards: 0, grandChampionCredits: 0, showPrestigeCredits: 0, yearlyPrestigeStats: 0, ledgerTransactions: 0, healthTests: 0, infectiousDiseaseTests: 0, privateKennelNotes: 0, plannerTags: 0, serviceClaims: 0, groomingListings: 0, groomingServiceActions: 0, conditionEvents: 0 };

function disposableFixture(id: string, options: { sold?: boolean } = {}) {
  const state = { dogExists: true, listingExists: true, listingStatus: "ACTIVE", marketState: "LISTED_NPC", health: true, disease: true, emergency: true };
  const listings = () => [
    ...(state.listingExists ? [{ id: `listing-${id}`, sellerType: "SYSTEM", listingType: "FOUNDATION", status: state.listingStatus, buyerKennelId: null }] : []),
    ...(options.sold ? [{ id: `sold-${id}`, sellerType: "SYSTEM", listingType: "FOUNDATION", status: "SOLD", buyerKennelId: "kennel" }] : []),
  ];
  const tx = {
    dogListing: {
      findUnique: async () => state.listingExists ? { id: `listing-${id}`, dogId: id, sellerType: "SYSTEM", listingType: "FOUNDATION", status: state.listingStatus, expiresAtEpoch: 49, dog: { breedCode2: "AB", ownerKennelId: null, lifecycleState: "ALIVE", marketState: state.marketState, originType: "FOUNDATION", isFoundation: true } } : null,
      updateMany: async () => { if (state.listingStatus !== "ACTIVE") return { count: 0 }; state.listingStatus = "EXPIRED"; return { count: 1 }; },
      deleteMany: async () => { state.listingExists = false; return { count: 1 }; },
    },
    dog: {
      findUnique: async () => state.dogExists ? { originType: "FOUNDATION", isFoundation: true, ownerKennelId: null, lifecycleState: "ALIVE", marketState: state.marketState, listings: listings(), healthConditionTruths: state.health ? [{ id: `truth-${id}` }] : [], titleProgress: null, infectiousDiseaseStatuses: state.disease ? [{ id: `disease-${id}`, diseaseCode: "BRUCELLOSIS", status: "INFECTED", sourceDogId: null, sourceBreedingAttemptId: null }] : [], emergencyCareEvents: state.emergency ? [{ id: `emergency-${id}`, status: "PENDING", kennelIdAtEvent: null, ledgerTransactionId: null }] : [], _count: zeroCounts } : null,
      updateMany: async () => { if (state.marketState !== "LISTED_NPC") return { count: 0 }; state.marketState = "NOT_FOR_SALE"; return { count: 1 }; },
      delete: async () => { state.dogExists = false; },
    },
    dogEmergencyCareEvent: { deleteMany: async () => { state.emergency = false; return { count: 1 }; } },
    dogInfectiousDiseaseStatus: { deleteMany: async () => { state.disease = false; return { count: 1 }; } },
    dogHealthConditionTruth: { deleteMany: async () => { state.health = false; return { count: 1 }; } },
  };
  const database = { $transaction: async (action: (client: typeof tx) => Promise<unknown>) => action(tx) };
  return { state, database };
}

type InventoryDog = { id: string; regNumber: string; sex: "F" | "M"; fixture: ReturnType<typeof disposableFixture> };

async function clean(record: InventoryDog, currentEpoch: number) {
  return (record.fixture.database as { $transaction: (action: (client: never) => Promise<unknown>) => Promise<unknown> }).$transaction((tx) =>
    cleanupExpiredFoundationInventoryCandidateInTransaction(tx, { candidate: { listingId: `listing-${record.id}`, dogId: record.id }, currentEpoch })
  );
}

async function runNoPurchaseScenario(label: string, target: number) {
  const reservations = new Set<string>();
  const reservationClient = { dogRegistrationReservation: { createMany: async ({ data }: { data: Array<{ regNumber: string }> }) => {
    if (data.some(({ regNumber }) => reservations.has(regNumber))) throw { code: "P2002" };
    data.forEach(({ regNumber }) => reservations.add(regNumber)); return { count: data.length };
  } } };
  const issued = new Set<string>();
  const deleted = new Set<string>();
  const checkpoints = new Map<number, { active: number; expired: number; reservations: number; created: number; deleted: number }>();
  let sequence = 0;
  let active: InventoryDog[] = [];
  const create = async (sex: "F" | "M") => {
    sequence += 1;
    const regNumber = `AB${String(sequence).padStart(7, "0")}01`;
    assert.equal(issued.has(regNumber), false, `${label}: issued registration is unique`);
    assert.equal(deleted.has(regNumber), false, `${label}: deleted registration is never reissued`);
    await reserveDogRegistrations(reservationClient as never, [regNumber]);
    issued.add(regNumber);
    active.push({ id: `${label}-${sequence}`, regNumber, sex, fixture: disposableFixture(`${label}-${sequence}`) });
  };
  const fill = async () => {
    const females = active.filter((dog) => dog.sex === "F").length;
    const males = active.filter((dog) => dog.sex === "M").length;
    const required = Math.max(target - active.length, Math.max(0, 2 - females) + Math.max(0, 1 - males));
    for (let index = 0; index < required; index += 1) await create(index < Math.max(0, 2 - females) ? "F" : index < Math.max(0, 2 - females) + Math.max(0, 1 - males) ? "M" : "F");
    return required;
  };
  await fill();
  checkpoints.set(0, { active: active.length, expired: 0, reservations: reservations.size, created: issued.size, deleted: deleted.size });
  for (let cycle = 1; cycle <= 200; cycle += 1) {
    for (const dog of active) {
      const result = await clean(dog, cycle * 50);
      assert.equal(result, "DELETED_AFTER_EXPIRATION", `${label}: stale disposable inventory is deleted`);
      deleted.add(dog.regNumber);
      assert.equal(dog.fixture.state.health, false, `${label}: health truths do not accumulate`);
      assert.equal(dog.fixture.state.disease, false, `${label}: disposable disease does not accumulate`);
      assert.equal(dog.fixture.state.emergency, false, `${label}: disposable emergencies do not accumulate`);
    }
    active = [];
    await fill();
    assert.equal(await fill(), 0, `${label}: settled ensure is idempotent`);
    if ([0, 10, 100, 200].includes(cycle)) checkpoints.set(cycle, { active: active.length, expired: 0, reservations: reservations.size, created: issued.size, deleted: deleted.size });
  }
  const finalFemales = active.filter((dog) => dog.sex === "F").length;
  const finalMales = active.filter((dog) => dog.sex === "M").length;
  assert.equal(active.length, target, `${label}: active inventory stays bounded at current policy`);
  assert.ok(finalFemales >= 2 && finalMales >= 1, `${label}: active pool preserves 2F/1M`);
  assert.equal(reservations.size, issued.size, `${label}: reservations grow only with issued registrations`);
  assert.equal(issued.size - deleted.size, active.length, `${label}: created/deleted accounting conserves foundation Dogs`);
  return checkpoints;
}

async function main() {
  const source = readFileSync(resolve(process.cwd(), "server/services/foundationDog.service.ts"), "utf8");
  assert.match(source, /expireStaleFoundationListings/, "canonical ensure retains expiration/cleanup entrypoint");
  assert.match(source, /pg_advisory_xact_lock/, "canonical ensure retains FOUNDATION-05 database serialization");
  assert.match(source, /resolveFoundationPopulationContext\(breedCode2\)/, "replacement batches retain canonical contemporary context resolution");
  assert.match(source, /createFoundationDogProfile/, "replacement Dogs retain the canonical genetics generator");
  assert.match(source, /const FOUNDATION_LISTING_HOURS = 7 \* SHOW_WEEK_HOURS/, "49-hour lifetime remains unchanged");

  const startedAt = Date.now();
  const dense = await runNoPurchaseScenario("DENSE_NO_PURCHASE", 3);
  const thin = await runNoPurchaseScenario("THIN_NO_PURCHASE", 4);
  assert.equal(dense.get(10)?.expired, 0); assert.equal(dense.get(100)?.expired, 0); assert.equal(dense.get(200)?.expired, 0);
  assert.equal(thin.get(10)?.expired, 0); assert.equal(thin.get(100)?.expired, 0); assert.equal(thin.get(200)?.expired, 0);

  const protectedDog = disposableFixture("protected", { sold: true });
  const protectedResult = await (protectedDog.database as { $transaction: (action: (client: never) => Promise<unknown>) => Promise<unknown> }).$transaction((tx) => cleanupExpiredFoundationInventoryCandidateInTransaction(tx, { candidate: { listingId: "listing-protected", dogId: "protected" }, currentEpoch: 50 }));
  assert.equal(protectedResult, "PROTECTED_AFTER_EXPIRATION", "purchased/SOLD history survives cleanup");
  assert.equal(protectedDog.state.dogExists, true, "protected foundation Dog remains retained");
  assert.equal(protectedDog.state.marketState, "NOT_FOR_SALE", "protected expired Dog is not active inventory");
  console.log(JSON.stringify({ test: "FOUNDATION-07", rotationCycles: [10, 100, 200], dense: Object.fromEntries(dense), thin: Object.fromEntries(thin), durationMs: Date.now() - startedAt }, null, 2));
}

void main();
