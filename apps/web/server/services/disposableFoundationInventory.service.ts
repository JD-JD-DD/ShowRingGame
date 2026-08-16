import type { Prisma } from "@prisma/client";

export type DisposableFoundationAssessmentStatus =
  | "DISPOSABLE"
  | "PROTECTED"
  | "NOT_FOUNDATION_INVENTORY"
  | "NOT_EXPIRED";

export type DisposableFoundationProtectedReason =
  | "OWNED"
  | "ACTIVE_LISTING"
  | "SOLD_LISTING"
  | "PLAYER_LISTING_HISTORY"
  | "PEDIGREE_OR_OFFSPRING"
  | "BREEDING_OR_LITTER_HISTORY"
  | "SHOW_OR_TITLE_HISTORY"
  | "PURCHASE_OR_LEDGER_HISTORY"
  | "PLAYER_NOTE_OR_TAG"
  | "PLAYER_SERVICE_HISTORY"
  | "PROTECTED_HEALTH_OR_EMERGENCY_HISTORY";

export type DisposableFoundationAssessment = {
  status: DisposableFoundationAssessmentStatus;
  protectedReasons: DisposableFoundationProtectedReason[];
  /** FOUNDATION-04 may remove only these system-created rows, transactionally. */
  disposableSystemChildren: {
    expiredFoundationListingIds: string[];
    healthConditionTruthIds: string[];
    foundationDiseaseStatusIds: string[];
    pendingSystemEmergencyCareEventIds: string[];
  };
};

type AssessmentClient = Pick<Prisma.TransactionClient, "dog">;

/**
 * Read-only preflight. FOUNDATION-04 must repeat this assessment inside its
 * deletion transaction; a preflight result is never deletion authorization.
 */
export async function assessDisposableFoundationInventoryDog(
  client: AssessmentClient,
  dogId: string
): Promise<DisposableFoundationAssessment> {
  const dog = await client.dog.findUnique({
    where: { id: dogId },
    select: {
      originType: true, isFoundation: true, ownerKennelId: true, lifecycleState: true, marketState: true,
      listings: { select: { id: true, sellerType: true, listingType: true, status: true, buyerKennelId: true } },
      healthConditionTruths: { select: { id: true } },
      titleProgress: { select: { dogId: true } },
      infectiousDiseaseStatuses: { select: { id: true, diseaseCode: true, status: true, sourceDogId: true, sourceBreedingAttemptId: true } },
      emergencyCareEvents: { select: { id: true, status: true, kennelIdAtEvent: true, ledgerTransactionId: true } },
      _count: { select: {
        sireOf: true, damOf: true, breedingAttemptsAsSire: true, breedingAttemptsAsDam: true, reproductiveEmergencies: true, siredLitters: true, dammedLitters: true,
        showEntries: true, showResults: true, showAwards: true, grandChampionCredits: true, showPrestigeCredits: true, yearlyPrestigeStats: true,
        ledgerTransactions: true, healthTests: true, infectiousDiseaseTests: true, privateKennelNotes: true, plannerTags: true,
        serviceClaims: true, groomingListings: true, groomingServiceActions: true, conditionEvents: true,
      } },
    },
  });
  const empty = { expiredFoundationListingIds: [], healthConditionTruthIds: [], foundationDiseaseStatusIds: [], pendingSystemEmergencyCareEventIds: [] };
  if (!dog) return { status: "NOT_FOUNDATION_INVENTORY", protectedReasons: [], disposableSystemChildren: empty };
  const foundationBase = dog.originType === "FOUNDATION" && dog.isFoundation && dog.ownerKennelId === null && dog.lifecycleState === "ALIVE";
  if (!foundationBase) return { status: "NOT_FOUNDATION_INVENTORY", protectedReasons: dog.ownerKennelId ? ["OWNED"] : [], disposableSystemChildren: empty };

  const listings = dog.listings;
  const expired = listings.filter(listing => listing.sellerType === "SYSTEM" && listing.listingType === "FOUNDATION" && listing.status === "EXPIRED");
  const reasons = new Set<DisposableFoundationProtectedReason>();
  if (listings.some(listing => listing.status === "SOLD" || listing.buyerKennelId !== null)) reasons.add("SOLD_LISTING");
  if (listings.some(listing => listing.sellerType === "PLAYER" || listing.listingType !== "FOUNDATION" || listing.status === "CANCELLED")) reasons.add("PLAYER_LISTING_HISTORY");
  if (listings.some(listing => listing.status === "ACTIVE")) reasons.add("ACTIVE_LISTING");
  const counts = dog._count;
  if (counts.sireOf + counts.damOf > 0) reasons.add("PEDIGREE_OR_OFFSPRING");
  if (counts.breedingAttemptsAsSire + counts.breedingAttemptsAsDam + counts.reproductiveEmergencies + counts.siredLitters + counts.dammedLitters > 0) reasons.add("BREEDING_OR_LITTER_HISTORY");
  if (counts.showEntries + counts.showResults + counts.showAwards + counts.grandChampionCredits + counts.showPrestigeCredits + counts.yearlyPrestigeStats > 0 || dog.titleProgress !== null) reasons.add("SHOW_OR_TITLE_HISTORY");
  if (counts.ledgerTransactions > 0) reasons.add("PURCHASE_OR_LEDGER_HISTORY");
  if (counts.privateKennelNotes + counts.plannerTags > 0) reasons.add("PLAYER_NOTE_OR_TAG");
  if (counts.serviceClaims + counts.groomingListings + counts.groomingServiceActions + counts.conditionEvents > 0) reasons.add("PLAYER_SERVICE_HISTORY");
  if (counts.healthTests + counts.infectiousDiseaseTests > 0) reasons.add("PROTECTED_HEALTH_OR_EMERGENCY_HISTORY");

  const approvedDisease = dog.infectiousDiseaseStatuses.filter(record => record.diseaseCode === "BRUCELLOSIS" && record.status === "INFECTED" && record.sourceDogId === null && record.sourceBreedingAttemptId === null);
  if (approvedDisease.length !== dog.infectiousDiseaseStatuses.length) reasons.add("PROTECTED_HEALTH_OR_EMERGENCY_HISTORY");
  const approvedEmergencies = dog.emergencyCareEvents.filter(event => event.status === "PENDING" && event.kennelIdAtEvent === null && event.ledgerTransactionId === null);
  if (approvedEmergencies.length !== dog.emergencyCareEvents.length) reasons.add("PROTECTED_HEALTH_OR_EMERGENCY_HISTORY");
  if (reasons.has("SOLD_LISTING") || reasons.has("PLAYER_LISTING_HISTORY") || [...reasons].some(reason => reason !== "ACTIVE_LISTING")) return { status: "PROTECTED", protectedReasons: [...reasons].sort(), disposableSystemChildren: empty };
  if (dog.marketState !== "NOT_FOR_SALE" || expired.length === 0 || reasons.has("ACTIVE_LISTING")) return { status: "NOT_EXPIRED", protectedReasons: [...reasons].sort(), disposableSystemChildren: empty };
  return { status: "DISPOSABLE", protectedReasons: [], disposableSystemChildren: { expiredFoundationListingIds: expired.map(listing => listing.id), healthConditionTruthIds: dog.healthConditionTruths.map(record => record.id), foundationDiseaseStatusIds: approvedDisease.map(record => record.id), pendingSystemEmergencyCareEventIds: approvedEmergencies.map(event => event.id) } };
}
