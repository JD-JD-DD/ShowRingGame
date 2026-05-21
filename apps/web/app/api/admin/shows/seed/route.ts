import { NextResponse } from "next/server";

import { seedJudgePanelFromCsv } from "@/server/services/judgePanel.service";
import { seedShowScheduleFromCsv } from "@/server/services/showSchedule.service";

export async function POST() {
  try {
    const judgePanel = await seedJudgePanelFromCsv();
    const showSchedule = await seedShowScheduleFromCsv();

    return NextResponse.json({
      ok: true,
      judgePanel,
      showSchedule,
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
