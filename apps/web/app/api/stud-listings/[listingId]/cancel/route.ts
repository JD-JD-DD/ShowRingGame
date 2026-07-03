import { NextResponse } from "next/server";

import { redirectToDogPageWithField } from "@/lib/dogPageRedirect";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { cancelPlayerStudListing } from "@/server/services/market.service";

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

    const dogId = await cancelPlayerStudListing({
      listingId,
      sellerKennelId: kennel.id,
    });

    return redirectToDogPageWithField(
      request,
      dogId,
      "saleMessage",
      "Stud listing cancelled."
    );
  } catch (error) {
    console.error("POST /api/stud-listings/[listingId]/cancel failed:", error);

    return redirectToDogPageWithField(
      request,
      dogIdForError,
      "saleError",
      error instanceof Error ? error.message : "Failed to cancel stud listing."
    );
  }
}
