import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { pullShowEntry } from "@/server/services/showEntry.service";

function redirectWithShowMessage(
  request: Request,
  dogId: string,
  field: "showError" | "showMessage",
  message: string
) {
  const url = new URL(`/dogs/${dogId}`, request.url);
  url.searchParams.set(field, message);
  return NextResponse.redirect(url);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ showEntryId: string }> }
) {
  const { showEntryId } = await params;
  const formData = await request.formData();
  const dogId = String(formData.get("dogId") ?? "").trim();

  if (!dogId) {
    return NextResponse.json({ error: "Dog ID is required." }, { status: 400 });
  }

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    await pullShowEntry({
      showEntryId,
      kennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
    });

    return redirectWithShowMessage(
      request,
      dogId,
      "showMessage",
      "Dog pulled from the show. Entry fees were not refunded."
    );
  } catch (error) {
    console.error("POST /api/show-entries/[showEntryId]/pull failed:", error);

    return redirectWithShowMessage(
      request,
      dogId,
      "showError",
      error instanceof Error ? error.message : "Failed to pull dog from show."
    );
  }
}
