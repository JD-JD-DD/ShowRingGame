import { db } from "@/lib/db";
import { assertDogHasNoPendingVeterinaryCare } from "@/server/services/emergencyVetCare.service";
import {
  getRequiredHealthTestsForBreed,
  MIN_BREED_AGE_HOURS,
  validateStudOfferDamRequirementsStep,
  validateStudOfferTerms,
  type EditableStudOfferTerms,
} from "@showring/rules";

export class StudOfferPublishError extends Error {
  constructor(
    readonly code:
      | "NOT_OWNER"
      | "SIRE_NOT_ELIGIBLE"
      | "INVALID_TERMS"
      | "HEALTH_REQUIREMENTS_INVALID"
      | "ALREADY_PUBLISHED",
    message: string
  ) {
    super(message);
  }
}

export async function publishStudOffer(args: {
  dogId: string;
  ownerKennelId: string;
  currentEpoch: number;
  terms: EditableStudOfferTerms;
}): Promise<{ offerId: string; version: number }> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Dog" WHERE "id" = ${args.dogId} FOR UPDATE`;

    const sire = await tx.dog.findUnique({
      where: { id: args.dogId },
      select: {
        id: true,
        ownerKennelId: true,
        breedCode2: true,
        sex: true,
        lifecycleState: true,
        isBreedingActive: true,
        birthEpoch: true,
        marketState: true,
      },
    });

    if (!sire || sire.ownerKennelId !== args.ownerKennelId) {
      throw new StudOfferPublishError("NOT_OWNER", "You no longer own this dog.");
    }

    if (
      sire.lifecycleState !== "ALIVE" ||
      sire.sex !== "M" ||
      !sire.isBreedingActive ||
      args.currentEpoch - sire.birthEpoch < MIN_BREED_AGE_HOURS ||
      sire.marketState !== "NOT_FOR_SALE"
    ) {
      throw new StudOfferPublishError(
        "SIRE_NOT_ELIGIBLE",
        "This dog is no longer eligible to be offered at stud."
      );
    }

    try {
      await assertDogHasNoPendingVeterinaryCare(sire.id, tx);
    } catch {
      throw new StudOfferPublishError(
        "SIRE_NOT_ELIGIBLE",
        "This dog is no longer eligible to be offered at stud."
      );
    }

    const activeListing = await tx.dogListing.findFirst({
      where: { dogId: sire.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (activeListing) {
      throw new StudOfferPublishError(
        "SIRE_NOT_ELIGIBLE",
        "This dog is no longer eligible to be offered at stud."
      );
    }

    const termsValidation = validateStudOfferTerms(args.terms);
    if (!termsValidation.valid) {
      throw new StudOfferPublishError("INVALID_TERMS", "Stud Offer terms are invalid.");
    }

    const applicableHealthTestCodes = getRequiredHealthTestsForBreed(
      sire.breedCode2
    );
    const healthValidation = validateStudOfferDamRequirementsStep(
      args.terms,
      applicableHealthTestCodes,
      {
        brucellosisNegativeRequiredAnswered: true,
        titleRequirementAnswered: true,
        healthRequirementAnsweredCodes: applicableHealthTestCodes,
      }
    );
    if (!healthValidation.valid) {
      throw new StudOfferPublishError(
        "HEALTH_REQUIREMENTS_INVALID",
        "Health requirements no longer match this dog's breed."
      );
    }

    const publishedOffer = await tx.studOffer.findFirst({
      where: { sireDogId: sire.id, status: "PUBLISHED" },
      select: { id: true },
    });
    if (publishedOffer) {
      throw new StudOfferPublishError(
        "ALREADY_PUBLISHED",
        "This dog already has a published Stud Offer."
      );
    }

    const latestOffer = await tx.studOffer.findFirst({
      where: { sireDogId: sire.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const publishedAt = new Date();
    const offer = await tx.studOffer.create({
      data: {
        sireDogId: sire.id,
        ownerKennelId: args.ownerKennelId,
        status: "PUBLISHED",
        version: (latestOffer?.version ?? 0) + 1,
        compensationType: args.terms.compensationType!,
        cashAmount: args.terms.cashAmount,
        puppyPickPosition: args.terms.puppyPickPosition,
        puppySex: args.terms.puppySex,
        minimumLitterSize: args.terms.minimumLitterSize,
        noLitterReturnService: args.terms.noLitterReturnService,
        smallLitterReturnThreshold: args.terms.smallLitterReturnThreshold,
        brucellosisNegativeRequired: args.terms.brucellosisNegativeRequired,
        titleRequirement: args.terms.titleRequirement!,
        approvalMode: args.terms.approvalMode!,
        publishedAt,
        healthRequirements: {
          create: args.terms.healthRequirements.map((requirement) => ({
            healthTestCode: requirement.healthTestCode,
            requirementLevel: requirement.requirementLevel!,
          })),
        },
      },
      select: { id: true, version: true },
    });

    return { offerId: offer.id, version: offer.version };
  });
}
