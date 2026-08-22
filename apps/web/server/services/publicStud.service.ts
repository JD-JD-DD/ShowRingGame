import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { formatCompactStudOfferSummary } from "@/lib/studOfferPresentation";

export type PublicStudReadModel = {
  sireDogId: string;
  ownerKennelId: string;
  breedCode2: string;
  source: "STUD_OFFER";
  studOfferId: string;
  offerVersion: number;
  terms: {
    compensationType: "CASH" | "PUPPY_BACK" | "CASH_AND_PUPPY_BACK";
    cashAmount: number | null;
    puppyBackSummary: string | null;
    approvalMode: "AUTOMATIC" | "MANUAL";
    requirementsSummary: string | null;
    requirements: {
      brucellosisNegativeRequired: boolean;
      healthRequirements: Array<{
        healthTestCode: string;
        requirementLevel: "NONE" | "GREEN_OR_YELLOW" | "GREEN_ONLY";
      }>;
      titleRequirement: "NONE" | "CH_OR_HIGHER" | "GCH_OR_HIGHER";
    };
  };
};

export type StudOfferPublicStudReadModel = PublicStudReadModel;

export const publishedStudOfferPublicSelect = Prisma.validator<Prisma.StudOfferSelect>()({
  id: true,
  sireDogId: true,
  ownerKennelId: true,
  version: true,
  compensationType: true,
  cashAmount: true,
  puppyPickPosition: true,
  puppySex: true,
  brucellosisNegativeRequired: true,
  titleRequirement: true,
  approvalMode: true,
  healthRequirements: {
    select: {
      healthTestCode: true,
      requirementLevel: true,
    },
  },
  sireDog: {
    select: {
      id: true,
      ownerKennelId: true,
      breedCode2: true,
    },
  },
});

export type PublishedStudOfferPublicAdapterInput = Prisma.StudOfferGetPayload<{
  select: typeof publishedStudOfferPublicSelect;
}>;

export function adaptPublishedStudOfferToPublicStud(
  offer: PublishedStudOfferPublicAdapterInput
): StudOfferPublicStudReadModel | null {
  if (
    !offer.sireDog.ownerKennelId ||
    offer.sireDog.ownerKennelId !== offer.ownerKennelId
  ) {
    return null;
  }

  const summary = formatCompactStudOfferSummary({
    compensationType: offer.compensationType,
    cashAmount: offer.cashAmount,
    puppyPickPosition: offer.puppyPickPosition,
    puppySex: offer.puppySex,
    brucellosisNegativeRequired: offer.brucellosisNegativeRequired,
    titleRequirement: offer.titleRequirement,
    approvalMode: offer.approvalMode,
    healthRequirements: offer.healthRequirements,
  });

  return {
    source: "STUD_OFFER",
    sireDogId: offer.sireDogId,
    ownerKennelId: offer.ownerKennelId,
    breedCode2: offer.sireDog.breedCode2,
    studOfferId: offer.id,
    offerVersion: offer.version,
    terms: {
      compensationType: offer.compensationType,
      cashAmount: offer.cashAmount,
      puppyBackSummary: summary?.puppyTermsSummary ?? null,
      approvalMode: offer.approvalMode,
      requirementsSummary: summary?.restrictionsSummary ?? null,
      requirements: {
        brucellosisNegativeRequired: offer.brucellosisNegativeRequired,
        healthRequirements: offer.healthRequirements,
        titleRequirement: offer.titleRequirement,
      },
    },
  };
}

function assertAtMostOnePublishedStudOffer(
  offers: readonly PublishedStudOfferPublicAdapterInput[],
  sireDogId: string
) {
  if (offers.length > 1) {
    throw new Error(
      `Multiple published Stud Offers exist for sire ${sireDogId}; current offer authority is ambiguous.`
    );
  }
}

export function resolvePublicStudFromCandidates(args: {
  sireDogId: string;
  publishedOffers: readonly PublishedStudOfferPublicAdapterInput[];
}): PublicStudReadModel | null {
  assertAtMostOnePublishedStudOffer(args.publishedOffers, args.sireDogId);

  const publishedOffer = args.publishedOffers[0];
  const publicStudFromOffer = publishedOffer
    ? adaptPublishedStudOfferToPublicStud(publishedOffer)
    : null;
  return publicStudFromOffer;
}

export async function resolvePublicStudForSire(args: {
  sireDogId: string;
}): Promise<PublicStudReadModel | null> {
  const publishedOffers = await db.studOffer.findMany({
    where: { sireDogId: args.sireDogId, status: "PUBLISHED" },
    select: publishedStudOfferPublicSelect,
  });

  return resolvePublicStudFromCandidates({
    sireDogId: args.sireDogId,
    publishedOffers,
  });
}

export async function resolvePublicStudInventory(
  sireDogIds: readonly string[]
): Promise<PublicStudReadModel[]> {
  const uniqueSireDogIds = [...new Set(sireDogIds)];
  if (uniqueSireDogIds.length === 0) return [];

  const publishedOffers = await db.studOffer.findMany({
    where: { sireDogId: { in: uniqueSireDogIds }, status: "PUBLISHED" },
    select: publishedStudOfferPublicSelect,
  });

  const publishedOffersBySire = new Map<
    string,
    PublishedStudOfferPublicAdapterInput[]
  >();
  for (const offer of publishedOffers) {
    const offersForSire = publishedOffersBySire.get(offer.sireDogId) ?? [];
    offersForSire.push(offer);
    publishedOffersBySire.set(offer.sireDogId, offersForSire);
  }

  const publicStuds: PublicStudReadModel[] = [];
  for (const sireDogId of uniqueSireDogIds) {
    const publicStud = resolvePublicStudFromCandidates({
      sireDogId,
      publishedOffers: publishedOffersBySire.get(sireDogId) ?? [],
    });
    if (publicStud) publicStuds.push(publicStud);
  }

  return publicStuds;
}
