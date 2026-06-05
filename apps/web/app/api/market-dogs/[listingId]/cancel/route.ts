import { NextResponse } from "next/server";

import {
  normalizeAreaId,
  redirectToDogPageWithField,
} from "@/lib/dogPageAreaContext";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { cancelPlayerDogListing } from "@/server/services/market.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  let dogIdForError = "";
  let areaId: string | null = null;

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
    areaId = normalizeAreaId(formData.get("areaId"));

    const dogId = await cancelPlayerDogListing({
      listingId,
      sellerKennelId: kennel.id,
    });

    return redirectToDogPageWithField(
      request,
      dogId,
      "saleMessage",
      "Listing cancelled.",
      areaId
    );
  } catch (error) {
    console.error("POST /api/market-dogs/[listingId]/cancel failed:", error);

    return redirectToDogPageWithField(
      request,
      dogIdForError,
      "saleError",
      error instanceof Error ? error.message : "Failed to cancel listing.",
      areaId
    );
  }
}
