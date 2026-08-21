import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { PLAYER_STUD_LISTING_TYPE } from "@/server/services/market.service";
import { approveManualStudContractForKennel } from "@/server/services/breeding.service";

export async function POST(_: Request, { params }: { params: Promise<{ contractId: string }> }) {
  try {
    const userId = await getSessionUserId(); if (!userId) return fail("Unauthorized.", 401);
    const kennel = await getKennelForUser(userId); if (!kennel) return fail("Kennel not found.", 404);
    const { contractId } = await params;
    const contract = await db.studContract.findFirst({ where: { id: contractId, status: "PENDING", sireKennelId: kennel.id }, select: { sireDogId: true, damDogId: true, damKennelId: true } });
    if (!contract) return fail("This Stud approval request is no longer pending.", 400);
    const listing = await db.dogListing.findFirst({ where: { dogId: contract.sireDogId, sellerKennelId: kennel.id, sellerType: "PLAYER", listingType: PLAYER_STUD_LISTING_TYPE, status: "ACTIVE" }, select: { id: true } });
    if (!listing) return fail("This stud is no longer available.", 400);
    const attempt = await approveManualStudContractForKennel({ contractId, damKennelId: contract.damKennelId, sireDogId: contract.sireDogId, damDogId: contract.damDogId, studListingId: listing.id, currentEpoch: getCurrentEpoch() });
    return ok({ attempt, message: "Stud approval accepted and breeding initiated." });
  } catch (error) { return fail(error instanceof Error ? error.message : "Unable to approve Stud approval.", 400); }
}
