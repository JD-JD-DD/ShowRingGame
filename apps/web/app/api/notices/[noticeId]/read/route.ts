import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { markKennelNoticeRead } from "@/server/services/kennelNotice.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ noticeId: string }> }
) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const kennel = await getKennelForUser(userId);

  if (!kennel) {
    return NextResponse.redirect(new URL("/onboarding", request.url), 303);
  }

  const { noticeId } = await params;

  await markKennelNoticeRead({
    kennelId: kennel.id,
    noticeId,
    currentEpoch: getCurrentEpoch(),
  });

  return NextResponse.redirect(new URL("/notices", request.url), 303);
}
