import { NextResponse } from "next/server";

import { reconcilePendingArtPayments } from "@/server/services/artPaymentReconciliationRunner.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await reconcilePendingArtPayments();
    const response = {
      ok: summary.failed === 0,
      ...summary,
      message: "Breed Art payment reconciliation completed.",
    };
    console.info("art-payment-reconciliation-summary", response);
    return NextResponse.json(response, { status: summary.failed === 0 ? 200 : 207 });
  } catch (error) {
    console.error("GET /api/cron/reconcile-art-payments failed", {
      error: error instanceof Error ? error.message : "Unknown reconciliation error.",
    });
    return NextResponse.json({ ok: false, error: "Breed Art payment reconciliation failed." }, { status: 500 });
  }
}
