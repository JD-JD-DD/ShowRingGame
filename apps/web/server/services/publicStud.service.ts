import type { Prisma } from "@prisma/client";

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
      };
    }
);

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
}): PublicStudReadModel | null {
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
