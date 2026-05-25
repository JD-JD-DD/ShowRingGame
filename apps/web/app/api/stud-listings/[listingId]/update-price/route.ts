import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { updatePlayerStudListingPrice } from "@/server/services/market.service";

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

    const studFeeAmount = parseWholeDollarPrice(formData.get("studFeeAmount"));

    if (studFeeAmount === null || studFeeAmount < 1) {
      return redirectWithSaleError(
        request,
        dogIdForError,
        "Stud fee must be a whole dollar amount of at least $1."
      );
    }

    const dogId = await updatePlayerStudListingPrice({
      listingId,
      sellerKennelId: kennel.id,
      studFeeAmount,
    });

    return redirectWithSaleMessage(request, dogId, "Stud fee updated.");
  } catch (error) {
    console.error(
      "POST /api/stud-listings/[listingId]/update-price failed:",
      error
    );

    return redirectWithSaleError(
      request,
      dogIdForError,
      error instanceof Error ? error.message : "Failed to update stud fee."
    );
  }
}
