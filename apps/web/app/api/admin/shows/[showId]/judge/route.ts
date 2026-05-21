import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { judgeShowDay } from "@/server/services/judging.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  try {
    const { showId } = await params;
    const result = await judgeShowDay({
      showDayId: showId,
      currentEpoch: getCurrentEpoch(),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/admin/shows/[showId]/judge failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to judge show day.",
      },
      { status: 400 }
    );
  }
}
