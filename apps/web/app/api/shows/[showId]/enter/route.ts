import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { createShowEntry } from "@/server/services/showEntry.service";

function redirectWithEntryError(
  request: Request,
  showId: string,
  error: string,
  breedCode2?: string
) {
  const url = new URL(`/shows/${showId}`, request.url);
  url.searchParams.set("entryError", error);
  if (breedCode2) url.searchParams.set("breedCode2", breedCode2);
  return NextResponse.redirect(url);
}

function redirectWithEntryMessage(
  request: Request,
  showId: string,
  message: string,
  breedCode2?: string
) {
  const url = new URL(`/shows/${showId}`, request.url);
  url.searchParams.set("entryMessage", message);
  if (breedCode2) url.searchParams.set("breedCode2", breedCode2);
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
    const dogIds = formData
      .getAll("dogIds")
      .map((dogId) => String(dogId).trim())
      .filter(Boolean);
    const singleDogId = String(formData.get("dogId") ?? "").trim();
    const judgingBlockId = String(formData.get("judgingBlockId") ?? "");
    const breedCode2 = String(formData.get("breedCode2") ?? "").trim();
    const selectedDogIds = dogIds.length > 0 ? dogIds : singleDogId ? [singleDogId] : [];

    if (selectedDogIds.length === 0 || !judgingBlockId) {
      return redirectWithEntryError(
        request,
        showId,
        "Select at least one dog to enter.",
        breedCode2
      );
    }

    const currentEpoch = getCurrentEpoch();
    let enteredCount = 0;

    for (const dogId of selectedDogIds) {
      await createShowEntry({
        dogId,
        judgingBlockId,
        ownerKennelId: kennel.id,
        currentEpoch,
      });
      enteredCount += 1;
    }

    return redirectWithEntryMessage(
      request,
      showId,
      enteredCount === 1 ? "Dog entered." : `${enteredCount} dogs entered.`,
      breedCode2
    );
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
