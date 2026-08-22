import { NextResponse } from "next/server";
import { getCurrentEpoch } from "@/lib/gameClock";
import { processDueStudContractPuppyTransfers, processExpiredStudContractPuppySelectionTurns, processExpiredStudContractRequests, processExpiredStudContractReturnServices, reconcileSelectedStudContractPuppyDeaths } from "@/server/services/studContractLifecycle.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    const currentEpoch = getCurrentEpoch();
    const summary = await processExpiredStudContractRequests({ currentEpoch });
    const returnServiceExpirations = await processExpiredStudContractReturnServices();
    const selectionDeadlines = await processExpiredStudContractPuppySelectionTurns({ currentEpoch });
    const selectedPuppyDeaths = await reconcileSelectedStudContractPuppyDeaths({ currentEpoch });
    const puppyTransfers = await processDueStudContractPuppyTransfers({ currentEpoch });
    console.info("process-stud-contract-lifecycle cron summary", summary);
    return NextResponse.json({ ok: true, ...summary, returnServiceExpirations, selectionDeadlines, selectedPuppyDeaths, puppyTransfers });
  } catch (error) {
    console.error("GET /api/cron/process-stud-contract-lifecycle failed", { error });
    return NextResponse.json({ ok: false, error: "Stud Contract lifecycle cron failed." }, { status: 500 });
  }
}
