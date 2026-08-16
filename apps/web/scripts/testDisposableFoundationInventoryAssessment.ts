import assert from "node:assert/strict";
import { assessDisposableFoundationInventoryDog } from "../server/services/disposableFoundationInventory.service";

const zeroCounts = { sireOf: 0, damOf: 0, breedingAttemptsAsSire: 0, breedingAttemptsAsDam: 0, reproductiveEmergencies: 0, siredLitters: 0, dammedLitters: 0, showEntries: 0, showResults: 0, showAwards: 0, grandChampionCredits: 0, showPrestigeCredits: 0, yearlyPrestigeStats: 0, ledgerTransactions: 0, healthTests: 0, infectiousDiseaseTests: 0, privateKennelNotes: 0, plannerTags: 0, serviceClaims: 0, groomingListings: 0, groomingServiceActions: 0, conditionEvents: 0 };
function candidate(overrides: Record<string, unknown> = {}) {
  return { originType: "FOUNDATION", isFoundation: true, ownerKennelId: null, lifecycleState: "ALIVE", marketState: "NOT_FOR_SALE", listings: [{ id: "expired", sellerType: "SYSTEM", listingType: "FOUNDATION", status: "EXPIRED", buyerKennelId: null }], healthConditionTruths: [{ id: "truth" }], titleProgress: null, infectiousDiseaseStatuses: [{ id: "disease", diseaseCode: "BRUCELLOSIS", status: "INFECTED", sourceDogId: null, sourceBreedingAttemptId: null }], emergencyCareEvents: [{ id: "emergency", status: "PENDING", kennelIdAtEvent: null, ledgerTransactionId: null }], _count: { ...zeroCounts }, ...overrides };
}
async function assess(row: unknown) { return assessDisposableFoundationInventoryDog({ dog: { findUnique: async () => row } } as never, "dog"); }

async function main() {
  const disposable = await assess(candidate());
  assert.equal(disposable.status, "DISPOSABLE");
  assert.deepEqual(disposable.disposableSystemChildren, { expiredFoundationListingIds: ["expired"], healthConditionTruthIds: ["truth"], foundationDiseaseStatusIds: ["disease"], pendingSystemEmergencyCareEventIds: ["emergency"] });
  assert.equal((await assess(candidate({ marketState: "LISTED_NPC", listings: [{ id: "active", sellerType: "SYSTEM", listingType: "FOUNDATION", status: "ACTIVE", buyerKennelId: null }] }))).status, "NOT_EXPIRED");
  assert.deepEqual((await assess(candidate({ ownerKennelId: "kennel" }))).protectedReasons, ["OWNED"]);
  assert.ok((await assess(candidate({ listings: [{ id: "sold", sellerType: "SYSTEM", listingType: "FOUNDATION", status: "SOLD", buyerKennelId: "kennel" }] }))).protectedReasons.includes("SOLD_LISTING"));
  assert.ok((await assess(candidate({ _count: { ...zeroCounts, sireOf: 1 } }))).protectedReasons.includes("PEDIGREE_OR_OFFSPRING"));
  assert.ok((await assess(candidate({ _count: { ...zeroCounts, showEntries: 1 } }))).protectedReasons.includes("SHOW_OR_TITLE_HISTORY"));
  assert.ok((await assess(candidate({ _count: { ...zeroCounts, privateKennelNotes: 1 } }))).protectedReasons.includes("PLAYER_NOTE_OR_TAG"));
  assert.ok((await assess(candidate({ emergencyCareEvents: [{ id: "resolved", status: "RESOLVED_TREATED", kennelIdAtEvent: null, ledgerTransactionId: null }] }))).protectedReasons.includes("PROTECTED_HEALTH_OR_EMERGENCY_HISTORY"));
  assert.equal((await assess(candidate({ originType: "PLAYER_BRED" }))).status, "NOT_FOUNDATION_INVENTORY");
  console.log("Disposable foundation inventory assessment checks passed.");
}
void main();
