import { PrismaClient } from "@prisma/client";

import { getCurrentEpoch } from "../lib/gameClock";

const db = new PrismaClient();
const shouldApply = process.argv.includes("--apply");

async function cleanupDuplicateEmergencyNotices(currentEpoch: number) {
  const notices = await db.kennelNotice.findMany({
    where: {
      type: "KENNEL_SERVICE",
      metadataJson: {
        path: ["noticeKind"],
        equals: "EMERGENCY_VET_CARE",
      },
    },
    orderBy: [{ createdAtEpoch: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      sourceKey: true,
      createdAtEpoch: true,
      metadataJson: true,
    },
  });
  const byEmergencyEventId = new Map<string, typeof notices>();

  for (const notice of notices) {
    const metadata =
      notice.metadataJson &&
      typeof notice.metadataJson === "object" &&
      !Array.isArray(notice.metadataJson)
        ? (notice.metadataJson as Record<string, unknown>)
        : null;
    const emergencyCareEventId =
      typeof metadata?.emergencyCareEventId === "string"
        ? metadata.emergencyCareEventId
        : null;

    if (!emergencyCareEventId) {
      continue;
    }

    byEmergencyEventId.set(emergencyCareEventId, [
      ...(byEmergencyEventId.get(emergencyCareEventId) ?? []),
      notice,
    ]);
  }

  const duplicateNoticeIds = [...byEmergencyEventId.values()].flatMap((group) =>
    group.length > 1 ? group.slice(1).map((notice) => notice.id) : []
  );

  if (shouldApply && duplicateNoticeIds.length > 0) {
    await db.kennelNotice.updateMany({
      where: {
        id: {
          in: duplicateNoticeIds,
        },
      },
      data: {
        readAtEpoch: currentEpoch,
        dismissedAtEpoch: currentEpoch,
      },
    });
  }

  return duplicateNoticeIds.length;
}

async function cleanupStaleFoundationEmergencies(currentEpoch: number) {
  const staleEvents = await db.dogEmergencyCareEvent.findMany({
    where: {
      status: "PENDING",
      kennelIdAtEvent: null,
      dog: {
        originType: "FOUNDATION",
        isFoundation: true,
      },
    },
    select: {
      id: true,
    },
  });
  const staleEventIds = staleEvents.map((event) => event.id);

  if (shouldApply && staleEventIds.length > 0) {
    await db.dogEmergencyCareEvent.updateMany({
      where: {
        id: {
          in: staleEventIds,
        },
      },
      data: {
        status: "CANCELED",
        resolvedAtEpoch: currentEpoch,
        canceledAtEpoch: currentEpoch,
        canceledReason:
          "Canceled by emergency idempotency cleanup; event originated before player ownership.",
      },
    });
  }

  return staleEventIds.length;
}

async function main() {
  const currentEpoch = getCurrentEpoch();
  const duplicateNotices = await cleanupDuplicateEmergencyNotices(currentEpoch);
  const staleFoundationEmergencies =
    await cleanupStaleFoundationEmergencies(currentEpoch);

  console.log(
    JSON.stringify(
      {
        mode: shouldApply ? "apply" : "dry-run",
        duplicateEmergencyNoticesToDismiss: duplicateNotices,
        staleFoundationEmergenciesToCancel: staleFoundationEmergencies,
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
