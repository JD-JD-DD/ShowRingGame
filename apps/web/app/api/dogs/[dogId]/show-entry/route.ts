import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { createUserAccessAudit } from "@/lib/requestAudit";
import { getSessionUserId } from "@/lib/session";
import { getDogShowEntryPlanner } from "@/server/services/dogShowEntryPlanner.service";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  createShowEntriesForCluster,
  type BulkShowEntrySelection,
} from "@/server/services/showEntry.service";

const GENERIC_ENTRY_ERROR =
  "We could not submit those entries. Please try again, or enter fewer shows. If this continues, contact support.";

type SubmittedBody = {
  showDayIds?: unknown;
};

type FailedCluster = {
  showClusterId: string;
  showClusterName: string;
  reason: string;
};

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

function getSubmittedShowDayIds(body: SubmittedBody | null): {
  showDayIds: string[];
  duplicateShowDayIds: string[];
} {
  const rawShowDayIds = Array.isArray(body?.showDayIds) ? body.showDayIds : [];
  const seen = new Set<string>();
  const duplicateShowDayIds = new Set<string>();
  const showDayIds: string[] = [];

  for (const value of rawShowDayIds) {
    const showDayId = String(value ?? "").trim();

    if (!showDayId) {
      continue;
    }

    if (seen.has(showDayId)) {
      duplicateShowDayIds.add(showDayId);
      continue;
    }

    seen.add(showDayId);
    showDayIds.push(showDayId);
  }

  return { showDayIds, duplicateShowDayIds: [...duplicateShowDayIds] };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const { dogId } = await params;

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const body = (await request.json().catch(() => null)) as SubmittedBody | null;
    const { showDayIds, duplicateShowDayIds } = getSubmittedShowDayIds(body);

    if (showDayIds.length === 0) {
      return fail("Select at least one show day.", 400);
    }

    if (duplicateShowDayIds.length > 0) {
      return fail("Duplicate show days were submitted.", 400, {
        duplicateShowDayIds,
      });
    }

    const currentEpoch = getCurrentEpoch();
    const planner = await getDogShowEntryPlanner({
      kennelId: kennel.id,
      dogId,
      currentEpoch,
    }).catch((error: unknown) => {
      if (
        error instanceof Error &&
        error.message === "Dog not found for this kennel."
      ) {
        return null;
      }

      throw error;
    });

    if (!planner) {
      return fail("Dog not found.", 404);
    }

    const dayById = new Map<
      string,
      {
        showClusterId: string;
        showClusterName: string;
        weekendKey: string;
        canSelect: boolean;
        disabledReason: string | null;
      }
    >();

    for (const cluster of planner.clusters) {
      for (const day of cluster.days) {
        dayById.set(day.showDayId, {
          showClusterId: cluster.showId,
          showClusterName: cluster.name,
          weekendKey: cluster.weekendKey,
          canSelect: day.canSelect,
          disabledReason: day.disabledReason,
        });
      }
    }

    const invalidSelections = showDayIds.flatMap((showDayId) => {
      const day = dayById.get(showDayId);

      if (!day) {
        return [{ showDayId, reason: "Show day is no longer available." }];
      }

      if (!day.canSelect) {
        return [
          {
            showDayId,
            reason: day.disabledReason ?? "Show day is no longer selectable.",
          },
        ];
      }

      return [];
    });

    if (invalidSelections.length > 0) {
      return fail("One or more selected show days are no longer available.", 400, {
        invalidSelections,
      });
    }

    const selectedClusterIdsByWeekendKey = new Map<string, Set<string>>();

    for (const showDayId of showDayIds) {
      const day = dayById.get(showDayId);

      if (!day) {
        continue;
      }

      const clusterIds =
        selectedClusterIdsByWeekendKey.get(day.weekendKey) ?? new Set<string>();
      clusterIds.add(day.showClusterId);
      selectedClusterIdsByWeekendKey.set(day.weekendKey, clusterIds);
    }

    const conflictingWeekendKeys = [...selectedClusterIdsByWeekendKey.entries()]
      .filter(([, clusterIds]) => clusterIds.size > 1)
      .map(([weekendKey]) => weekendKey);

    if (conflictingWeekendKeys.length > 0) {
      return fail(
        "Choose only one show per weekend for this dog.",
        400,
        { conflictingWeekendKeys }
      );
    }

    const showDayIdsByClusterId = new Map<string, string[]>();

    for (const showDayId of showDayIds) {
      const day = dayById.get(showDayId);

      if (!day) {
        continue;
      }

      const clusterShowDayIds =
        showDayIdsByClusterId.get(day.showClusterId) ?? [];
      clusterShowDayIds.push(showDayId);
      showDayIdsByClusterId.set(day.showClusterId, clusterShowDayIds);
    }

    let enteredDayCount = 0;
    let totalCost = 0;
    const enteredClusterIds = new Set<string>();
    const failed: FailedCluster[] = [];

    for (const cluster of planner.clusters) {
      const clusterShowDayIds = showDayIdsByClusterId.get(cluster.showId);

      if (!clusterShowDayIds || clusterShowDayIds.length === 0) {
        continue;
      }

      const selections: BulkShowEntrySelection[] = clusterShowDayIds.map(
        (showDayId) => ({
          dogId: planner.dog.dogId,
          showDayId,
        })
      );

      try {
        const result = await createShowEntriesForCluster({
          showId: cluster.showId,
          kennelId: kennel.id,
          breedCode2: planner.dog.breedCode2,
          selections,
          currentEpoch,
        });

        enteredDayCount += result.entriesCreated;
        enteredClusterIds.add(cluster.showId);
        totalCost += result.quote.totalCost;
      } catch (error) {
        failed.push({
          showClusterId: cluster.showId,
          showClusterName: cluster.name,
          reason: getSafeEntryErrorMessage(error),
        });
        break;
      }
    }

    if (failed.length > 0) {
      const partialSuccess = enteredDayCount > 0;

      return fail(
        partialSuccess
          ? "Some entries were created, but one show could not be entered."
          : failed[0]?.reason ?? GENERIC_ENTRY_ERROR,
        partialSuccess ? 409 : 400,
        {
          partialSuccess,
          enteredDayCount,
          enteredClusterCount: enteredClusterIds.size,
          totalCost,
          failed,
        }
      );
    }

    await createUserAccessAudit({
      request,
      userId,
      kennelId: kennel.id,
      action: "DOG_SHOW_ENTRY_SUCCESS",
    });

    return ok({
      message:
        enteredDayCount === 1
          ? `Entered 1 show day for ${planner.dog.displayName}. Total cost: $${totalCost}.`
          : `Entered ${enteredDayCount} show days for ${planner.dog.displayName}. Total cost: $${totalCost}.`,
      enteredDayCount,
      enteredClusterCount: enteredClusterIds.size,
      totalCost,
      warnings: [],
    });
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/show-entry failed:", error);

    return fail(getSafeEntryErrorMessage(error), 500);
  }
}
