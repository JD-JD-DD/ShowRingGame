import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getUnreadKennelNoticeCount } from "@/server/services/kennelNotice.service";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export async function GET() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { unreadCount: 0 },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  }

  const kennel = await getKennelForUser(userId);

  if (!kennel) {
    return NextResponse.json(
      { unreadCount: 0 },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  }

  const unreadCount = await getUnreadKennelNoticeCount(kennel.id);

  return NextResponse.json(
    { unreadCount },
    {
      headers: NO_STORE_HEADERS,
    }
  );
}
