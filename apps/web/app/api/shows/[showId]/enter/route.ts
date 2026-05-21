import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { createShowEntry } from "@/server/services/showEntry.service";

function redirectWithEntryError(
  request: Request,
  showId: string,
  error: string
) {
  const url = new URL(`/shows/${showId}`, request.url);
  url.searchParams.set("entryError", error);
  return NextResponse.redirect(url);
}

function redirectWithEntryMessage(
  request: Request,
  showId: string,
  message: string
) {
  const url = new URL(`/shows/${showId}`, request.url);
  url.searchParams.set("entryMessage", message);
  return NextResponse.redirect(url);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  try {
    const { showId } = await params;
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const dogId = String(formData.get("dogId") ?? "");
    const judgingBlockId = String(formData.get("judgingBlockId") ?? "");

    if (!dogId || !judgingBlockId) {
      return redirectWithEntryError(request, showId, "Select a dog to enter.");
    }

    await createShowEntry({
      dogId,
      judgingBlockId,
      ownerKennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
    });

    return redirectWithEntryMessage(request, showId, "Dog entered.");
  } catch (error) {
    const { showId } = await params;

    console.error("POST /api/shows/[showId]/enter failed:", error);

    return redirectWithEntryError(
      request,
      showId,
      error instanceof Error ? error.message : "Failed to enter dog."
    );
  }
}
