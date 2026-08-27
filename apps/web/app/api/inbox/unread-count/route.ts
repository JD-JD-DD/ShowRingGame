import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getUnreadKennelConversationCount } from "@/server/services/kennelMessaging.service";
import { getUnreadKennelNoticeCount } from "@/server/services/kennelNotice.service";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ messages: 0, notices: 0, total: 0 }, { headers: NO_STORE_HEADERS });
  }

  const kennel = await getKennelForUser(userId);
  if (!kennel) {
    return NextResponse.json({ messages: 0, notices: 0, total: 0 }, { headers: NO_STORE_HEADERS });
  }

  const [messages, notices] = await Promise.all([
    getUnreadKennelConversationCount({ kennelId: kennel.id }),
    getUnreadKennelNoticeCount(kennel.id),
  ]);

  return NextResponse.json(
    { messages, notices, total: messages + notices },
    { headers: NO_STORE_HEADERS }
  );
}
