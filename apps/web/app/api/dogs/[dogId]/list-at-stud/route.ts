import { NextResponse } from "next/server";

import {
  normalizeAreaId,
  redirectToDogPageWithField,
} from "@/lib/dogPageAreaContext";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listDogAtStud } from "@/server/services/market.service";

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
  let areaId: string | null = null;

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
    areaId = normalizeAreaId(formData.get("areaId"));
    const studFeeAmount = parseWholeDollarPrice(formData.get("studFeeAmount"));
    const requiresBrucellosisNegativeDam =
      formData.get("requiresBrucellosisNegativeDam") === "on";
    const requiresDamHealthTestsCompleted =
      formData.get("requiresDamHealthTestsCompleted") === "on";
    const requiresDamHealthAllGreen =
      formData.get("requiresDamHealthAllGreen") === "on";
    const requiresDamHealthGreenOrYellow =
      formData.get("requiresDamHealthGreenOrYellow") === "on";
    const requiresDamChampionTitle =
      formData.get("requiresDamChampionTitle") === "on";

    if (studFeeAmount === null || studFeeAmount < 1) {
      return redirectToDogPageWithField(
        request,
        dogId,
        "saleError",
        "Stud fee must be a whole dollar amount of at least $1.",
        areaId
      );
    }

    await listDogAtStud({
      dogId,
      sellerKennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
      studFeeAmount,
      requiresBrucellosisNegativeDam,
      requiresDamHealthTestsCompleted,
      requiresDamHealthAllGreen,
      requiresDamHealthGreenOrYellow,
      requiresDamChampionTitle,
    });

    return redirectToDogPageWithField(
      request,
      dogId,
      "saleMessage",
      "Dog listed at stud.",
      areaId
    );
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/list-at-stud failed:", error);

    return redirectToDogPageWithField(
      request,
      dogId,
      "saleError",
      error instanceof Error ? error.message : "Failed to list dog at stud.",
      areaId
    );
  }
}
