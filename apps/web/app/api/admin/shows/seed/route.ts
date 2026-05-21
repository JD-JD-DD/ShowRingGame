import { NextResponse } from "next/server";

import { seedJudgePanelFromCsv } from "@/server/services/judgePanel.service";
import { seedShowScheduleFromCsv } from "@/server/services/showSchedule.service";

async function getRedirectTo(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("form")) {
    return null;
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  return redirectTo || null;
}

export async function POST(request: Request) {
  const redirectTo = await getRedirectTo(request);

  try {
    const judgePanel = await seedJudgePanelFromCsv();
    const showSchedule = await seedShowScheduleFromCsv();

    if (redirectTo) {
      const url = new URL(redirectTo, request.url);
      url.searchParams.set("seeded", "1");
      url.searchParams.set(
        "seededBlocks",
        String(showSchedule.judgingBlockCount)
      );
      return NextResponse.redirect(url);
    }

    return NextResponse.json({
      ok: true,
      judgePanel,
      showSchedule,
    });
  } catch (error) {
    console.error("POST /api/admin/shows/seed failed:", error);

    if (redirectTo) {
      const url = new URL(redirectTo, request.url);
      url.searchParams.set(
        "seedError",
        error instanceof Error ? error.message : "Failed to seed shows."
      );
      return NextResponse.redirect(url);
    }

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
