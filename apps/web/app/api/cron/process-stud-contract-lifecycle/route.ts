import { NextResponse } from "next/server";
import { getCurrentEpoch } from "@/lib/gameClock";
import { openQualifiedStudContractPuppySelections, processExpiredStudContractRequests, processStudContractLitterQualifications } from "@/server/services/studContractLifecycle.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    const currentEpoch = getCurrentEpoch();
    const [summary, qualifications, selections] = await Promise.all([processExpiredStudContractRequests({ currentEpoch }), processStudContractLitterQualifications({ currentEpoch }), openQualifiedStudContractPuppySelections({ currentEpoch })]);
    console.info("process-stud-contract-lifecycle cron summary", summary);
    return NextResponse.json({ ok: true, ...summary, qualifications, selections });
  } catch (error) {
    console.error("GET /api/cron/process-stud-contract-lifecycle failed", { error });
    return NextResponse.json({ ok: false, error: "Stud Contract lifecycle cron failed." }, { status: 500 });
  }
}
