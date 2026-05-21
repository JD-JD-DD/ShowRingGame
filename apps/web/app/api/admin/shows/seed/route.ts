import { NextResponse } from "next/server";

import { seedJudgePanelFromCsv } from "@/server/services/judgePanel.service";

export async function POST() {
  try {
    const judgePanel = await seedJudgePanelFromCsv();

    return NextResponse.json({
      ok: true,
      judgePanel,
    });
  } catch (error) {
    console.error("POST /api/admin/shows/seed failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to seed shows.",
      },
      { status: 400 }
    );
  }
}
