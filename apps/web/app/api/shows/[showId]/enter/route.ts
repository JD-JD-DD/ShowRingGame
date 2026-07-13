import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { createUserAccessAudit } from "@/lib/requestAudit";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  createShowEntriesForCluster,
  isShowEntrySubmissionError,
  type BulkShowEntrySelection,
  type ShowEntryErrorCode,
  type ShowEntryErrorDetails,
  type ShowEntryPlannerScopeInput,
} from "@/server/services/showEntry.service";

const GENERIC_ENTRY_ERROR =
  "We could not submit these entries because of an unexpected server error. No entries were charged. Please try again. If this continues, contact support.";

function getEntryErrorPayload(error: unknown): {
  error: string;
  code?: ShowEntryErrorCode;
  details?: ShowEntryErrorDetails;
  unexpected: boolean;
} {
  if (isShowEntrySubmissionError(error)) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
      unexpected: false,
    };
  }

  if (!(error instanceof Error) || !error.message.trim()) {
    return {
      error: GENERIC_ENTRY_ERROR,
      unexpected: true,
    };
  }

  return {
    error: GENERIC_ENTRY_ERROR,
    unexpected: true,
  };
}

function redirectWithEntryError(
  request: Request,
  showId: string,
  payload: {
    error: string;
    code?: ShowEntryErrorCode;
    details?: ShowEntryErrorDetails;
  },
  scope?: ShowEntryPlannerScopeInput,
  selections?: BulkShowEntrySelection[]
) {
  const url = new URL(`/shows/${showId}`, request.url);
  url.searchParams.set("entryError", payload.error);
  if (payload.code) {
    url.searchParams.set("entryErrorCode", payload.code);
  }
  if (payload.details) {
    url.searchParams.set("entryErrorDetails", JSON.stringify(payload.details));
  }
  if (scope?.type === "BREED") {
    url.searchParams.set("breedCode2", scope.breedCode2);
  }
  if (scope?.type === "KENNEL_RUN") {
    url.searchParams.set("kennelRunId", scope.kennelRunId);
  }
  if (selections && selections.length > 0) {
    url.searchParams.set(
      "dogDaySelections",
      selections.map((selection) => `${selection.dogId}:${selection.showDayId}`).join(",")
    );
    url.searchParams.set(
      "dogIds",
      [...new Set(selections.map((selection) => selection.dogId))].join(",")
    );
  }
  return NextResponse.redirect(url);
}

function redirectWithEntryMessage(
  request: Request,
  showId: string,
  message: string,
  scope?: ShowEntryPlannerScopeInput
) {
  const url = new URL(`/shows/${showId}`, request.url);
  url.searchParams.set("entryMessage", message);
  if (scope?.type === "BREED") {
    url.searchParams.set("breedCode2", scope.breedCode2);
  }
  if (scope?.type === "KENNEL_RUN") {
    url.searchParams.set("kennelRunId", scope.kennelRunId);
  }
  return NextResponse.redirect(url);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  let selectedScope: ShowEntryPlannerScopeInput | undefined;
  let selections: BulkShowEntrySelection[] = [];
  let kennelId: string | undefined;
  let requestedShowId: string | undefined;

  try {
    const { showId } = await params;
    requestedShowId = showId;
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }
    kennelId = kennel.id;

    const formData = await request.formData();
    const breedCode2 = String(formData.get("breedCode2") ?? "").trim();
    const kennelRunId = String(formData.get("kennelRunId") ?? "").trim();
    const scopeType = String(formData.get("scopeType") ?? "").trim();
    const entryMode =
      String(formData.get("entryMode") ?? "").trim() === "ALL_ELIGIBLE"
        ? "ALL_ELIGIBLE"
        : "SELECTED";
    const scope: ShowEntryPlannerScopeInput =
      scopeType === "KENNEL_RUN"
        ? {
            type: "KENNEL_RUN",
            kennelRunId,
          }
        : {
            type: "BREED",
            breedCode2,
          };
    selectedScope = scope;
    selections = formData
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
        { error: "Select at least one dog and show day." },
        scope,
        selections
      );
    }

    const currentEpoch = getCurrentEpoch();
    const result = await createShowEntriesForCluster({
      showId,
      kennelId: kennel.id,
      scope,
      selections,
      currentEpoch,
      mode: entryMode,
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
      result.entriesCreated === 0
        ? `No new entries were created. ${result.skippedSelections} combination(s) were already entered or no longer eligible.`
        : `${
            result.entriesCreated === 1
              ? `Entry submitted. Total cost: $${result.quote.totalCost}.`
              : `${result.entriesCreated} entries submitted for ${result.dogsEntered} dog(s). Total cost: $${result.quote.totalCost}.`
          }${
            result.skippedSelections > 0
              ? ` ${result.skippedSelections} combination(s) were skipped: ${result.skippedSelectionReasons
                  .map((reason) => `${reason.count} ${reason.message}`)
                  .join(", ")}.`
              : ""
          }`,
      scope
    );
  } catch (error) {
    const { showId } = await params;
    const payload = getEntryErrorPayload(error);

    if (payload.unexpected) {
      console.error("POST /api/shows/[showId]/enter failed:", {
        showId: requestedShowId ?? showId,
        kennelId: kennelId ?? null,
        scopeType: selectedScope?.type ?? null,
        breedCode2:
          selectedScope?.type === "BREED" ? selectedScope.breedCode2 : null,
        kennelRunId:
          selectedScope?.type === "KENNEL_RUN" ? selectedScope.kennelRunId : null,
        requestedCombinationCount: selections.length,
        errorCode:
          error instanceof Error && error.name ? error.name : "UNEXPECTED_ERROR",
        internalMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    return redirectWithEntryError(
      request,
      showId,
      payload,
      selectedScope,
      selections
    );
  }
}
