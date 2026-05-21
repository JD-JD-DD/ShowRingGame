import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { seedTestEntriesForShow } from "@/server/services/showEntry.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  try {
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
