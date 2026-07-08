import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { createUserAccessAudit } from "@/lib/requestAudit";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  createShowEntriesForCluster,
  type BulkShowEntrySelection,
} from "@/server/services/showEntry.service";

const GENERIC_ENTRY_ERROR =
  "We could not submit those entries. Please try again, or enter fewer dogs. If this continues, contact support.";

function getSafeEntryErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return GENERIC_ENTRY_ERROR;
  }

  if (
    /Transaction API error|Transaction not found|Prisma|database|P\d{4}/i.test(
      error.message
    )
  ) {
    return GENERIC_ENTRY_ERROR;
  }

  return error.message;
}

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
  let selectedBreedCode2 = "";

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
    const breedCode2 = String(formData.get("breedCode2") ?? "").trim();
    selectedBreedCode2 = breedCode2;
    const selections: BulkShowEntrySelection[] = formData
      .getAll("dogDaySelections")
      .map((value) => String(value).trim())
      .filter(Boolean)
      .map((value) => {
        const [dogId, showDayId] = value.split(":");
        return {
          dogId: dogId ?? "",
          showDayId: showDayId ?? "",
        };
      });

    if (selections.length === 0) {
      return redirectWithEntryError(
        request,
        showId,
        "Select at least one dog and show day.",
        breedCode2
      );
    }

    const currentEpoch = getCurrentEpoch();
    const result = await createShowEntriesForCluster({
      showId,
      kennelId: kennel.id,
      breedCode2,
      selections,
      currentEpoch,
    });

    await createUserAccessAudit({
      request,
      userId,
      kennelId: kennel.id,
      action: "SHOW_ENTRY_SUCCESS",
    });

    return redirectWithEntryMessage(
      request,
      result.showId,
      result.entriesCreated === 1
        ? `Entry submitted. Total cost: $${result.quote.totalCost}.`
        : `${result.entriesCreated} entries submitted for ${result.dogsEntered} dog(s). Total cost: $${result.quote.totalCost}.`,
      breedCode2
    );
  } catch (error) {
    const { showId } = await params;

    console.error("POST /api/shows/[showId]/enter failed:", error);

    return redirectWithEntryError(
      request,
      showId,
      getSafeEntryErrorMessage(error),
      selectedBreedCode2
    );
  }
}
