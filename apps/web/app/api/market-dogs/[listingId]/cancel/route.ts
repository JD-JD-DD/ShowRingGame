import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { cancelPlayerDogListing } from "@/server/services/market.service";

function redirectWithSaleError(request: Request, dogId: string, error: string) {
  const url = new URL(`/dogs/${dogId}`, request.url);
  url.searchParams.set("saleError", error);
  return NextResponse.redirect(url);
}

function redirectWithSaleMessage(
  request: Request,
  dogId: string,
  message: string
) {
  const url = new URL(`/dogs/${dogId}`, request.url);
  url.searchParams.set("saleMessage", message);
  return NextResponse.redirect(url);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  let dogIdForError = "";

  try {
    const { listingId } = await params;
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const formData = await request.formData();
    dogIdForError = String(formData.get("dogId") ?? "");

    const dogId = await cancelPlayerDogListing({
      listingId,
      sellerKennelId: kennel.id,
    });

    return redirectWithSaleMessage(request, dogId, "Listing cancelled.");
  } catch (error) {
    console.error("POST /api/market-dogs/[listingId]/cancel failed:", error);

    return redirectWithSaleError(
      request,
      dogIdForError,
      error instanceof Error ? error.message : "Failed to cancel listing."
    );
  }
}
