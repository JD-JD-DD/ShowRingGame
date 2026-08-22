import { db } from "@/lib/db";
import { assertDogHasNoPendingVeterinaryCare } from "@/server/services/emergencyVetCare.service";
import { getBreedingEligibilityMessage, getIndividualBreedingEligibility } from "@/server/services/breedingEligibility.service";
import { getCurrentEpoch } from "@/lib/gameClock";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { activePublicStudListingWhere } from "@/server/services/publicStud.service";
import { adaptLegacyPublicStudListing } from "@/server/services/publicStud.service";
import { assertDamMeetsStudContractRequirements } from "@/server/services/studContractEligibility.service";

const MANUAL_APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function createManualStudContractRequest(args: {
  kennelId: string;
  studListingId: string;
  sireDogId: string;
  damDogId: string;
  currentEpoch: number;
}) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Dog" WHERE "id" = ${args.damDogId} FOR UPDATE`;
    const [dam, listing] = await Promise.all([
      tx.dog.findUnique({
        where: { id: args.damDogId },
        select: {
          id: true, ownerKennelId: true, breedCode2: true, sex: true,
          lifecycleState: true, isBreedingActive: true, birthEpoch: true,
          breedingAttemptsAsDam: { where: { status: { in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"] } }, take: 1, select: { status: true } },
          dammedLitters: { orderBy: { bornEpoch: "desc" }, take: 1, select: { bornEpoch: true } },
          reproductiveEmergencies: { where: { status: { in: ["RESOLVED_TREATED", "RESOLVED_UNTREATED"] } }, select: { id: true, status: true, resolvedEpoch: true, reproductiveConsequence: true } },
        },
      }),
      tx.dogListing.findFirst({
        where: { id: args.studListingId, ...activePublicStudListingWhere({ dogId: args.sireDogId }) },
        select: {
          id: true,
          sellerKennelId: true,
          askingPrice: true,
          requiresBrucellosisNegativeDam: true,
          requiresDamHealthTestsCompleted: true,
          requiresDamHealthAllGreen: true,
          requiresDamHealthGreenOrYellow: true,
          requiresDamChampionTitle: true,
          dog: { select: { id: true, ownerKennelId: true, breedCode2: true, sex: true, lifecycleState: true, isBreedingActive: true } },
        },
      }),
    ]);
    if (!dam || dam.ownerKennelId !== args.kennelId) throw new Error("You no longer own that dam.");
    const publicStud = listing ? adaptLegacyPublicStudListing(listing) : null;
    if (!publicStud || publicStud.legacyListingId !== args.studListingId || publicStud.sireDogId !== args.sireDogId) throw new Error("This stud and dam are no longer eligible for a request.");
    if (!listing?.sellerKennelId || listing.sellerKennelId === args.kennelId ||
      listing.dog.ownerKennelId !== listing.sellerKennelId ||
      listing.dog.sex !== "M" || listing.dog.lifecycleState !== "ALIVE" ||
      !listing.dog.isBreedingActive || dam.sex !== "F" ||
      dam.lifecycleState !== "ALIVE" || !dam.isBreedingActive ||
      dam.breedCode2 !== listing.dog.breedCode2) {
      throw new Error("This stud and dam are no longer eligible for a request.");
    }
    const damEligibility = getIndividualBreedingEligibility({
      currentEpoch: args.currentEpoch, birthEpoch: dam.birthEpoch,
      lifecycleState: dam.lifecycleState as "ALIVE" | "RETIRED" | "DECEASED" | "TRANSFERRED",
      sex: dam.sex, activeBreedingAttemptStatus: dam.breedingAttemptsAsDam[0]?.status ?? null,
      lastWhelpedEpoch: dam.dammedLitters[0]?.bornEpoch ?? null,
      resolvedReproductiveEmergencies: dam.reproductiveEmergencies,
    });
    if (!damEligibility.isEligible) {
      throw new Error(getBreedingEligibilityMessage(damEligibility) ?? "This dam is no longer eligible to breed.");
    }
    const existing = await tx.studContract.findFirst({
      where: { damDogId: dam.id, status: "PENDING" },
      select: { id: true },
    });
    if (existing) throw new Error("This dam already has a Stud approval pending.");
    await assertDogHasNoPendingVeterinaryCare(dam.id, tx);
    await assertDogHasNoPendingVeterinaryCare(listing.dog.id, tx);

    const offer = await tx.studOffer.findFirst({
      where: { sireDogId: listing.dog.id, status: "PUBLISHED" },
      include: { healthRequirements: true },
    });
    if (!offer) throw new Error("This Stud Offer is no longer published.");
    if (offer.ownerKennelId !== listing.sellerKennelId) throw new Error("This Stud Offer is no longer available.");
    if (offer.approvalMode !== "MANUAL") throw new Error("This Stud Offer uses Automatic Approval.");
    await assertDamMeetsStudContractRequirements({
      client: tx, damDogId: dam.id, currentEpoch: args.currentEpoch,
      requirements: {
        brucellosisNegativeRequired: offer.brucellosisNegativeRequired,
        healthRequirements: offer.healthRequirements,
        titleRequirement: offer.titleRequirement,
      },
    });

    const requestedAt = new Date();
    const approvalDeadlineAt = new Date(requestedAt.getTime() + MANUAL_APPROVAL_WINDOW_MS);
    const contract = await tx.studContract.create({
      data: {
        sourceOfferId: offer.id, sourceOfferVersion: offer.version,
        sireDogId: listing.dog.id, damDogId: dam.id,
        sireKennelId: offer.ownerKennelId, damKennelId: args.kennelId,
        status: "PENDING", compensationType: offer.compensationType,
        cashAmount: offer.cashAmount, puppyPickPosition: offer.puppyPickPosition,
        puppySex: offer.puppySex, minimumLitterSize: offer.minimumLitterSize,
        noLitterReturnService: offer.noLitterReturnService,
        smallLitterReturnThreshold: offer.smallLitterReturnThreshold,
        brucellosisNegativeRequired: offer.brucellosisNegativeRequired,
        titleRequirement: offer.titleRequirement, approvalMode: offer.approvalMode,
        requestedAt, approvalDeadlineAt,
        healthRequirements: { create: offer.healthRequirements.map((requirement) => ({
          healthTestCode: requirement.healthTestCode,
          requirementLevel: requirement.requirementLevel,
        })) },
      },
      select: { id: true, approvalDeadlineAt: true, sourceOfferVersion: true },
    });
    await Promise.all([
      createKennelNotice({ client: tx, kennelId: offer.ownerKennelId, sourceKey: `STUD_MANUAL_REQUEST_OWNER:${contract.id}`, type: "KENNEL_SERVICE", title: "Manual Stud Approval requested", body: `A Manual Stud Approval request is awaiting your review until ${approvalDeadlineAt.toLocaleString()}.`, currentEpoch: args.currentEpoch, linkedDogId: listing.dog.id, linkedListingId: args.studListingId, metadataJson: { studContractId: contract.id, damDogId: dam.id, approvalDeadlineAt: approvalDeadlineAt.toISOString() } }),
      createKennelNotice({ client: tx, kennelId: args.kennelId, sourceKey: `STUD_MANUAL_REQUEST_DAM:${contract.id}`, type: "KENNEL_SERVICE", title: "Stud approval pending", body: `Your request was submitted. No breeding or payment has occurred.`, currentEpoch: args.currentEpoch, linkedDogId: dam.id, linkedListingId: args.studListingId, metadataJson: { studContractId: contract.id, sireDogId: listing.dog.id, approvalDeadlineAt: approvalDeadlineAt.toISOString() } }),
    ]);
    return contract;
  });
}
