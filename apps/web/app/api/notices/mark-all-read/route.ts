import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { markAllKennelNoticesRead } from "@/server/services/kennelNotice.service";

export async function POST(request: Request) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const kennel = await getKennelForUser(userId);

  if (!kennel) {
    return NextResponse.redirect(new URL("/onboarding", request.url), 303);
  }

  await markAllKennelNoticesRead({
    kennelId: kennel.id,
    currentEpoch: getCurrentEpoch(),
  });

  return NextResponse.redirect(new URL("/notices", request.url), 303);
}
