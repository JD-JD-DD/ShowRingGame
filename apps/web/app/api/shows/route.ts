import { NextResponse } from "next/server";
import { SHOW_INSTANCE_GENERATION_HORIZON_HOURS } from "@showring/rules";

import { getCurrentEpoch } from "@/lib/gameClock";
import { ensureAnnualInvitationalShow } from "@/server/services/invitational.service";
import { ensureGeneratedShowSchedule } from "@/server/services/showSchedule.service";

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
    const currentEpoch = getCurrentEpoch();
    const schedule = await ensureGeneratedShowSchedule({
      currentEpoch,
      horizonHours: SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
      includeJudgingBlocks: false,
    });
    const invitational = await ensureAnnualInvitationalShow({ currentEpoch });

    if (redirectTo) {
      const url = new URL(redirectTo, request.url);
      url.searchParams.set("generated", "1");
      url.searchParams.set("generatedClusters", String(schedule.clusterCount));
      return NextResponse.redirect(url);
    }

    return Response.json({ ok: true, schedule, invitational });
  } catch (error) {
    console.error("POST /api/shows failed:", error);

    if (redirectTo) {
      const url = new URL(redirectTo, request.url);
      url.searchParams.set(
        "generateError",
        error instanceof Error ? error.message : "Failed to refresh shows."
      );
      return NextResponse.redirect(url);
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to refresh shows.",
      },
      { status: 400 }
    );
  }
}
