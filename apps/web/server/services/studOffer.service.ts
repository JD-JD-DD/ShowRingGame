import { db } from "@/lib/db";
import { assertDogHasNoPendingVeterinaryCare } from "@/server/services/emergencyVetCare.service";
import {
  getRequiredHealthTestsForBreed,
  areStudOfferTermsEqual,
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
      | "ALREADY_PUBLISHED"
      | "CURRENT_OFFER_MISSING"
      | "STALE_EDIT"
      | "NO_CHANGES",
    message: string
  ) {
    super(message);
  }
}

export async function getCurrentPublishedStudOfferForOwnedDog(args: {
  dogId: string;
  ownerKennelId: string;
}) {
  return db.studOffer.findFirst({
    where: {
      sireDogId: args.dogId,
      ownerKennelId: args.ownerKennelId,
      status: "PUBLISHED",
      sireDog: { ownerKennelId: args.ownerKennelId },
    },
    include: { healthRequirements: true },
  });
}

export async function publishStudOffer(args: {
  dogId: string;
  ownerKennelId: string;
  currentEpoch: number;
  terms: EditableStudOfferTerms;
  baseVersion?: number | null;
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
      include: { healthRequirements: true },
    });
    const isEditing = args.baseVersion !== null && args.baseVersion !== undefined;
    if (publishedOffer && !isEditing) {
      throw new StudOfferPublishError(
        "ALREADY_PUBLISHED",
        "This dog already has a published Stud Offer."
      );
    }

    if (!publishedOffer && isEditing) {
      throw new StudOfferPublishError(
        "CURRENT_OFFER_MISSING",
        "The current Stud Offer is no longer available. Reload the worksheet."
      );
    }
    if (publishedOffer && publishedOffer.version !== args.baseVersion) {
      throw new StudOfferPublishError(
        "STALE_EDIT",
        "This Stud Offer changed after you opened the worksheet. Reload the current terms before publishing your changes."
      );
    }
    if (publishedOffer) {
      const currentTerms: EditableStudOfferTerms = {
        compensationType: publishedOffer.compensationType,
        cashAmount: publishedOffer.cashAmount,
        puppyPickPosition: publishedOffer.puppyPickPosition,
        puppySex: publishedOffer.puppySex,
        minimumLitterSize: publishedOffer.minimumLitterSize,
        noLitterReturnService: publishedOffer.noLitterReturnService,
        smallLitterReturnThreshold: publishedOffer.smallLitterReturnThreshold,
        brucellosisNegativeRequired: publishedOffer.brucellosisNegativeRequired,
        titleRequirement: publishedOffer.titleRequirement,
        approvalMode: publishedOffer.approvalMode,
        healthRequirements: publishedOffer.healthRequirements.map((requirement) => ({
          healthTestCode: requirement.healthTestCode,
          requirementLevel: requirement.requirementLevel,
        })),
      };
      if (areStudOfferTermsEqual(currentTerms, args.terms)) {
        throw new StudOfferPublishError("NO_CHANGES", "No changes to publish.");
      }
      await tx.studOffer.update({
        where: { id: publishedOffer.id },
        data: { status: "RETIRED" },
      });
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
        version: publishedOffer ? publishedOffer.version + 1 : (latestOffer?.version ?? 0) + 1,
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
