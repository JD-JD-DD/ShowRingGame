import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { formatCompactStudOfferSummary } from "@/lib/studOfferPresentation";
import { PLAYER_STUD_LISTING_TYPE } from "@/server/services/market.service";

export type PublicStudReadModel = {
  sireDogId: string;
  ownerKennelId: string;
  breedCode2: string;
  legacyFeeAmount: number | null;
  legacyRequirements: {
    brucellosisNegativeDam: boolean;
    damHealthTestsCompleted: boolean;
    damHealthAllGreen: boolean;
    damHealthGreenOrYellow: boolean;
    damChampionTitle: boolean;
  } | null;
} & (
  | {
      source: "LEGACY_PLAYER_STUD";
      legacyListingId: string;
      studOfferId?: never;
      offerVersion?: never;
      terms: null;
    }
  | {
      source: "STUD_OFFER";
      legacyListingId?: never;
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
    }
);

export type LegacyPublicStudReadModel = Extract<
  PublicStudReadModel,
  { source: "LEGACY_PLAYER_STUD" }
>;

export type StudOfferPublicStudReadModel = Extract<
  PublicStudReadModel,
  { source: "STUD_OFFER" }
>;

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

const publicStudLegacyListingSelect = Prisma.validator<Prisma.DogListingSelect>()({
  id: true,
  askingPrice: true,
  sellerKennelId: true,
  requiresBrucellosisNegativeDam: true,
  requiresDamHealthTestsCompleted: true,
  requiresDamHealthAllGreen: true,
  requiresDamHealthGreenOrYellow: true,
  requiresDamChampionTitle: true,
  dog: {
    select: {
      id: true,
      ownerKennelId: true,
      breedCode2: true,
    },
  },
});

type PublicStudLegacyListingInput = Prisma.DogListingGetPayload<{
  select: typeof publicStudLegacyListingSelect;
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
    legacyFeeAmount: null,
    legacyRequirements: null,
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

export function adaptLegacyPublicStudListing(listing: {
  id: string;
  askingPrice: number;
  sellerKennelId: string | null;
  requiresBrucellosisNegativeDam: boolean;
  requiresDamHealthTestsCompleted: boolean;
  requiresDamHealthAllGreen: boolean;
  requiresDamHealthGreenOrYellow: boolean;
  requiresDamChampionTitle: boolean;
  dog: { id: string; ownerKennelId: string | null; breedCode2: string };
}): LegacyPublicStudReadModel | null {
  if (!listing.sellerKennelId || listing.dog.ownerKennelId !== listing.sellerKennelId) {
    return null;
  }

  return {
    source: "LEGACY_PLAYER_STUD",
    legacyListingId: listing.id,
    sireDogId: listing.dog.id,
    ownerKennelId: listing.sellerKennelId,
    breedCode2: listing.dog.breedCode2,
    legacyFeeAmount: listing.askingPrice,
    legacyRequirements: {
      brucellosisNegativeDam: listing.requiresBrucellosisNegativeDam,
      damHealthTestsCompleted: listing.requiresDamHealthTestsCompleted,
      damHealthAllGreen: listing.requiresDamHealthAllGreen,
      damHealthGreenOrYellow: listing.requiresDamHealthGreenOrYellow,
      damChampionTitle: listing.requiresDamChampionTitle,
    },
    terms: null,
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
  legacyListings: readonly PublicStudLegacyListingInput[];
}): PublicStudReadModel | null {
  assertAtMostOnePublishedStudOffer(args.publishedOffers, args.sireDogId);

  const publishedOffer = args.publishedOffers[0];
  const publicStudFromOffer = publishedOffer
    ? adaptPublishedStudOfferToPublicStud(publishedOffer)
    : null;
  if (publicStudFromOffer) return publicStudFromOffer;

  for (const listing of args.legacyListings) {
    const publicStudFromListing = adaptLegacyPublicStudListing(listing);
    if (publicStudFromListing) return publicStudFromListing;
  }

  return null;
}

export async function resolvePublicStudForSire(args: {
  sireDogId: string;
  legacyListingId?: string;
}): Promise<PublicStudReadModel | null> {
  const [publishedOffers, legacyListings] = await Promise.all([
    db.studOffer.findMany({
      where: { sireDogId: args.sireDogId, status: "PUBLISHED" },
      select: publishedStudOfferPublicSelect,
    }),
    db.dogListing.findMany({
      where: {
        ...activePublicStudListingWhere({ dogId: args.sireDogId }),
        ...(args.legacyListingId ? { id: args.legacyListingId } : {}),
      },
      select: publicStudLegacyListingSelect,
    }),
  ]);

  return resolvePublicStudFromCandidates({
    sireDogId: args.sireDogId,
    publishedOffers,
    legacyListings,
  });
}

export async function resolvePublicStudInventory(
  sireDogIds: readonly string[]
): Promise<PublicStudReadModel[]> {
  const uniqueSireDogIds = [...new Set(sireDogIds)];
  if (uniqueSireDogIds.length === 0) return [];

  const [publishedOffers, legacyListings] = await Promise.all([
    db.studOffer.findMany({
      where: { sireDogId: { in: uniqueSireDogIds }, status: "PUBLISHED" },
      select: publishedStudOfferPublicSelect,
    }),
    db.dogListing.findMany({
      where: {
        ...activePublicStudListingWhere(),
        dogId: { in: uniqueSireDogIds },
      },
      select: publicStudLegacyListingSelect,
    }),
  ]);

  const publishedOffersBySire = new Map<
    string,
    PublishedStudOfferPublicAdapterInput[]
  >();
  for (const offer of publishedOffers) {
    const offersForSire = publishedOffersBySire.get(offer.sireDogId) ?? [];
    offersForSire.push(offer);
    publishedOffersBySire.set(offer.sireDogId, offersForSire);
  }

  const legacyListingsBySire = new Map<string, PublicStudLegacyListingInput[]>();
  for (const listing of legacyListings) {
    const listingsForSire = legacyListingsBySire.get(listing.dog.id) ?? [];
    listingsForSire.push(listing);
    legacyListingsBySire.set(listing.dog.id, listingsForSire);
  }

  const publicStuds: PublicStudReadModel[] = [];
  for (const sireDogId of uniqueSireDogIds) {
    const publicStud = resolvePublicStudFromCandidates({
      sireDogId,
      publishedOffers: publishedOffersBySire.get(sireDogId) ?? [],
      legacyListings: legacyListingsBySire.get(sireDogId) ?? [],
    });
    if (publicStud) publicStuds.push(publicStud);
  }

  return publicStuds;
}

export function activePublicStudListingWhere(args: {
  dogId?: string;
  excludeKennelId?: string;
} = {}): Prisma.DogListingWhereInput {
  return {
    sellerType: "PLAYER",
    listingType: PLAYER_STUD_LISTING_TYPE,
    status: "ACTIVE",
    ...(args.dogId ? { dogId: args.dogId } : {}),
    ...(args.excludeKennelId
      ? { sellerKennelId: { not: args.excludeKennelId } }
      : {}),
  };
}
