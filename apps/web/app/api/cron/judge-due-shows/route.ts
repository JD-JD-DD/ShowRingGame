import { NextResponse } from "next/server";
import { runDueShowJudgingJob } from "@/server/services/showJudgingJob.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 }
    );
  }

  try {
    const summary = await runDueShowJudgingJob();

    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/cron/judge-due-shows failed", { error });

    return NextResponse.json(
      {
        ok: false,
        error: "Judge due shows cron failed.",
      },
      { status: 500 }
    );
  }
}
