import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listDogAtStud } from "@/server/services/market.service";

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
  { params }: { params: Promise<{ dogId: string }> }
) {
  const { dogId } = await params;

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const studFeeAmount = parseWholeDollarPrice(formData.get("studFeeAmount"));
    const requiresBrucellosisNegativeDam =
      formData.get("requiresBrucellosisNegativeDam") === "on";

    if (studFeeAmount === null || studFeeAmount < 1) {
      return redirectWithSaleError(
        request,
        dogId,
        "Stud fee must be a whole dollar amount of at least $1."
      );
    }

    await listDogAtStud({
      dogId,
      sellerKennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
      studFeeAmount,
      requiresBrucellosisNegativeDam,
    });

    return redirectWithSaleMessage(request, dogId, "Dog listed at stud.");
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/list-at-stud failed:", error);

    return redirectWithSaleError(
      request,
      dogId,
      error instanceof Error ? error.message : "Failed to list dog at stud."
    );
  }
}
