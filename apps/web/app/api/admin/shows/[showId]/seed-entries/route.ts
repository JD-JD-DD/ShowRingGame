import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { seedTestEntriesForShow } from "@/server/services/showEntry.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { showId } = await params;
    const result = await seedTestEntriesForShow({
      showId,
      currentEpoch: getCurrentEpoch(),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/admin/shows/[showId]/seed-entries failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to seed show entries.",
      },
      { status: 400 }
    );
  }
}
