import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { judgeShowBlock } from "@/server/services/judging.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params;
    const result = await judgeShowBlock({
      judgingBlockId: blockId,
      currentEpoch: getCurrentEpoch(),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/admin/show-blocks/[blockId]/judge failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to judge show block.",
      },
      { status: 400 }
    );
  }
}
