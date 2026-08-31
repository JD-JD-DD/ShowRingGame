import { NextResponse } from "next/server";

import { replayFailedArtPaymentProviderEvents } from "@/server/services/artPaymentProviderEventReplayRunner.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await replayFailedArtPaymentProviderEvents();
    const response = {
      ok: summary.failed === 0,
      ...summary,
      message: "Breed Art provider-event replay completed.",
    };
    console.info("art-payment-provider-event-replay-summary", response);
    return NextResponse.json(response, { status: summary.failed === 0 ? 200 : 207 });
  } catch (error) {
    console.error("GET /api/cron/replay-art-payment-events failed", {
      error: error instanceof Error ? error.message : "Unknown provider-event replay error.",
    });
    return NextResponse.json({ ok: false, error: "Breed Art provider-event replay failed." }, { status: 500 });
  }
}
