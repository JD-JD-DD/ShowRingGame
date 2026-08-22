import type { Prisma } from "@prisma/client";

import { PLAYER_STUD_LISTING_TYPE } from "@/server/services/market.service";

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
