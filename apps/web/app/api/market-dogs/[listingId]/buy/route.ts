import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { buyFoundationDog } from "@/server/services/foundationDog.service";
import { buyPlayerDogListing } from "@/server/services/market.service";

function wantsHtmlRedirect(request: Request): boolean {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

function getMarketContextSuffix(request: Request): string {
  return new URL(request.url).searchParams.get("from") === "market"
    ? "?from=market"
    : "";
}

function isProfilePurchase(request: Request): boolean {
  return new URL(request.url).searchParams.get("from") === "profile";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  let listingDogId: string | null = null;
  try {
    const { listingId } = await params;

    const userId = await getSessionUserId();
    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);
    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const listing = await db.dogListing.findUnique({
      where: { id: listingId },
      select: {
        dogId: true,
        sellerType: true,
      },
    });

    if (!listing) {
      return fail("Listing not found.", 404);
    }

    listingDogId = listing.dogId;

    const currentEpoch = getCurrentEpoch();
    const marketContextSuffix = getMarketContextSuffix(request);

    if (listing.sellerType === "SYSTEM") {
      const dog = await buyFoundationDog({
        dogId: listing.dogId,
        kennelId: kennel.id,
        currentEpoch,
      });

      if (wantsHtmlRedirect(request)) {
        return Response.redirect(
          new URL(`/dogs/${dog.dogId}${marketContextSuffix}`, request.url)
        );
      }

      return ok({ dog });
    }

    const dogId = await buyPlayerDogListing({
      listingId,
      buyerKennelId: kennel.id,
      currentEpoch,
    });

    if (wantsHtmlRedirect(request)) {
      return Response.redirect(
        new URL(`/dogs/${dogId}${marketContextSuffix}`, request.url)
      );
    }

    return ok({ dogId });
  } catch (error) {
    console.error("POST /api/market-dogs/[listingId]/buy failed", error);
    const message = error instanceof Error ? error.message : "Unable to buy dog.";

    if (wantsHtmlRedirect(request) && isProfilePurchase(request) && listingDogId) {
      return Response.redirect(
        new URL(
          `/dogs/${listingDogId}?saleError=${encodeURIComponent(message)}`,
          request.url
        )
      );
    }

    return fail(message, 400);
  }
}
