import { db } from "@/lib/db";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { assertDogHasNoPendingVeterinaryCare } from "@/server/services/emergencyVetCare.service";
import {
  getBreedingEligibilityMessage,
  getIndividualBreedingEligibility,
} from "@/server/services/breedingEligibility.service";
import { resolvePublicStudForSire } from "@/server/services/publicStud.service";
import { assertDamMeetsStudContractRequirements } from "@/server/services/studContractEligibility.service";

const MANUAL_APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function createManualStudContractRequest(args: {
  kennelId: string;
  sireDogId: string;
  damDogId: string;
  currentEpoch: number;
}) {
  const publicStud = await resolvePublicStudForSire({ sireDogId: args.sireDogId });
  if (!publicStud || publicStud.sireDogId !== args.sireDogId) {
    throw new Error("This stud and dam are no longer eligible for a request.");
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Dog" WHERE "id" = ${args.damDogId} FOR UPDATE`;
    const [dam, sire, offer] = await Promise.all([
      tx.dog.findUnique({
        where: { id: args.damDogId },
        select: {
          id: true,
          ownerKennelId: true,
          breedCode2: true,
          sex: true,
          lifecycleState: true,
          isBreedingActive: true,
          birthEpoch: true,
          breedingAttemptsAsDam: {
            where: { status: { in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"] } },
            take: 1,
            select: { status: true },
          },
          dammedLitters: {
            orderBy: { bornEpoch: "desc" },
            take: 1,
            select: { bornEpoch: true },
          },
          reproductiveEmergencies: {
            where: { status: { in: ["RESOLVED_TREATED", "RESOLVED_UNTREATED"] } },
            select: { id: true, status: true, resolvedEpoch: true, reproductiveConsequence: true },
          },
        },
      }),
      tx.dog.findUnique({
        where: { id: args.sireDogId },
        select: {
          id: true,
          ownerKennelId: true,
          breedCode2: true,
          sex: true,
          lifecycleState: true,
          isBreedingActive: true,
        },
      }),
      tx.studOffer.findFirst({
        where: { sireDogId: args.sireDogId, status: "PUBLISHED" },
        include: { healthRequirements: true },
      }),
    ]);

    if (!dam || dam.ownerKennelId !== args.kennelId) {
      throw new Error("You no longer own that dam.");
    }
    if (
      !sire ||
      sire.ownerKennelId !== publicStud.ownerKennelId ||
      sire.ownerKennelId === args.kennelId ||
      sire.sex !== "M" ||
      sire.lifecycleState !== "ALIVE" ||
      !sire.isBreedingActive ||
      dam.sex !== "F" ||
      dam.lifecycleState !== "ALIVE" ||
      !dam.isBreedingActive ||
      dam.breedCode2 !== sire.breedCode2
    ) {
      throw new Error("This stud and dam are no longer eligible for a request.");
    }
    const damEligibility = getIndividualBreedingEligibility({
      currentEpoch: args.currentEpoch,
      birthEpoch: dam.birthEpoch,
      lifecycleState: dam.lifecycleState,
      sex: dam.sex,
      activeBreedingAttemptStatus: dam.breedingAttemptsAsDam[0]?.status ?? null,
      lastWhelpedEpoch: dam.dammedLitters[0]?.bornEpoch ?? null,
      resolvedReproductiveEmergencies: dam.reproductiveEmergencies,
    });
    if (!damEligibility.isEligible) {
      throw new Error(
        getBreedingEligibilityMessage(damEligibility) ?? "This dam is no longer eligible to breed."
      );
    }
    const existing = await tx.studContract.findFirst({
      where: { damDogId: dam.id, status: "PENDING" },
      select: { id: true },
    });
    if (existing) throw new Error("This dam already has a Stud approval pending.");
    await assertDogHasNoPendingVeterinaryCare(dam.id, tx);
    await assertDogHasNoPendingVeterinaryCare(sire.id, tx);

    if (!offer || offer.ownerKennelId !== sire.ownerKennelId) {
      throw new Error("This Stud Offer is no longer available.");
    }
    if (offer.approvalMode !== "MANUAL") {
      throw new Error("This Stud Offer uses Automatic Approval.");
    }
    await assertDamMeetsStudContractRequirements({
      client: tx,
      damDogId: dam.id,
      currentEpoch: args.currentEpoch,
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
        sourceOfferId: offer.id,
        sourceOfferVersion: offer.version,
        sireDogId: sire.id,
        damDogId: dam.id,
        sireKennelId: offer.ownerKennelId,
        damKennelId: args.kennelId,
        status: "PENDING",
        compensationType: offer.compensationType,
        cashAmount: offer.cashAmount,
        puppyPickPosition: offer.puppyPickPosition,
        puppySex: offer.puppySex,
        minimumLitterSize: offer.minimumLitterSize,
        noLitterReturnService: offer.noLitterReturnService,
        smallLitterReturnThreshold: offer.smallLitterReturnThreshold,
        brucellosisNegativeRequired: offer.brucellosisNegativeRequired,
        titleRequirement: offer.titleRequirement,
        approvalMode: offer.approvalMode,
        requestedAt,
        approvalDeadlineAt,
        healthRequirements: {
          create: offer.healthRequirements.map((requirement) => ({
            healthTestCode: requirement.healthTestCode,
            requirementLevel: requirement.requirementLevel,
          })),
        },
      },
      select: { id: true, approvalDeadlineAt: true, sourceOfferVersion: true },
    });
    await Promise.all([
      createKennelNotice({
        client: tx,
        kennelId: offer.ownerKennelId,
        sourceKey: `STUD_MANUAL_REQUEST_OWNER:${contract.id}`,
        type: "KENNEL_SERVICE",
        title: "Manual Stud Approval requested",
        body: `A Manual Stud Approval request is awaiting your review until ${approvalDeadlineAt.toLocaleString()}.`,
        currentEpoch: args.currentEpoch,
        linkedDogId: sire.id,
        linkedListingId: null,
        metadataJson: { studContractId: contract.id, damDogId: dam.id, approvalDeadlineAt: approvalDeadlineAt.toISOString() },
      }),
      createKennelNotice({
        client: tx,
        kennelId: args.kennelId,
        sourceKey: `STUD_MANUAL_REQUEST_DAM:${contract.id}`,
        type: "KENNEL_SERVICE",
        title: "Stud approval pending",
        body: "Your request was submitted. No breeding or payment has occurred.",
        currentEpoch: args.currentEpoch,
        linkedDogId: dam.id,
        linkedListingId: null,
        metadataJson: { studContractId: contract.id, sireDogId: sire.id, approvalDeadlineAt: approvalDeadlineAt.toISOString() },
      }),
    ]);
    return contract;
  });
}
