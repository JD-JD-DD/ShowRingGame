import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { db } from "@/lib/db";
import {
  RehomeError,
  rehomeOwnedDogs,
} from "@/server/services/rehome.service";

export async function POST(request: Request) {
  try {
    const currentEpoch = getCurrentEpoch();
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await db.kennel.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const body = (await request.json()) as { dogIds?: unknown };
    const dogIds = Array.isArray(body.dogIds)
      ? body.dogIds
          .map((dogId) => String(dogId))
          .filter((dogId) => dogId.length > 0)
      : [];

    if (dogIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one dog to re-home." },
        { status: 400 }
      );
    }

    const result = await rehomeOwnedDogs({
      kennelId: kennel.id,
      dogIds,
      currentEpoch,
    });

    return NextResponse.json({
      ok: true,
      rehomedCount: result.rehomedCount,
      creditsAdded: result.creditsAdded,
      dogIds: result.dogIds,
      cancelledListingCount: result.cancelledListingCount,
    });
  } catch (error) {
    console.error("POST /api/dogs/bulk-rehome failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to re-home selected dogs.",
      },
      { status: error instanceof RehomeError ? error.status : 500 }
    );
  }
}
