import { NextResponse } from "next/server";

import {
  normalizeAreaId,
  redirectToDogPageWithField,
} from "@/lib/dogPageAreaContext";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { updatePlayerDogListingPrice } from "@/server/services/market.service";

function parseWholeDollarPrice(value: FormDataEntryValue | null): number | null {
  const rawValue = String(value ?? "").trim();

  if (!/^\d+$/.test(rawValue)) {
    return null;
  }

  const price = Number.parseInt(rawValue, 10);
  return Number.isSafeInteger(price) ? price : null;
}

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

    const askingPrice = parseWholeDollarPrice(formData.get("askingPrice"));

    if (askingPrice === null || askingPrice < 1) {
      return redirectToDogPageWithField(
        request,
        dogIdForError,
        "saleError",
        "Sale price must be a whole dollar amount of at least $1.",
        areaId
      );
    }

    const dogId = await updatePlayerDogListingPrice({
      listingId,
      sellerKennelId: kennel.id,
      askingPrice,
    });

    return redirectToDogPageWithField(
      request,
      dogId,
      "saleMessage",
      "Listing price updated.",
      areaId
    );
  } catch (error) {
    console.error("POST /api/market-dogs/[listingId]/update-price failed:", error);

    return redirectToDogPageWithField(
      request,
      dogIdForError,
      "saleError",
      error instanceof Error ? error.message : "Failed to update listing price.",
      areaId
    );
  }
}
