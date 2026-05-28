import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getUnreadKennelNoticeCount } from "@/server/services/kennelNotice.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ unreadCount: 0 });
  }

  const kennel = await getKennelForUser(userId);

  if (!kennel) {
    return NextResponse.json({ unreadCount: 0 });
  }

  const unreadCount = await getUnreadKennelNoticeCount(kennel.id);

  return NextResponse.json(
    { unreadCount },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
