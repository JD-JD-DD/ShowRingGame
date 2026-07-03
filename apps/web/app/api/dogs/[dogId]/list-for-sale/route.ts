import { NextResponse } from "next/server";

import { redirectToDogPageWithField } from "@/lib/dogPageRedirect";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listDogForSale } from "@/server/services/market.service";

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
    const askingPrice = parseWholeDollarPrice(formData.get("askingPrice"));

    if (askingPrice === null || askingPrice < 1) {
      return redirectToDogPageWithField(
        request,
        dogId,
        "saleError",
        "Sale price must be a whole dollar amount of at least $1."
      );
    }

    await listDogForSale({
      dogId,
      sellerKennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
      askingPrice,
    });

    return redirectToDogPageWithField(
      request,
      dogId,
      "saleMessage",
      "Dog listed for sale."
    );
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/list-for-sale failed:", error);

    return redirectToDogPageWithField(
      request,
      dogId,
      "saleError",
      error instanceof Error ? error.message : "Failed to list dog for sale."
    );
  }
}
