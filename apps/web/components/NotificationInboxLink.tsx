import Link from "next/link";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getUnreadKennelNoticeCount } from "@/server/services/kennelNotice.service";
import NotificationInboxBadge from "./NotificationInboxBadge";

export default async function NotificationInboxLink() {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!kennel) {
    return null;
  }

  const unreadCount = await getUnreadKennelNoticeCount(kennel.id);

  return (
    <Link
      href="/notices"
      className="fixed right-4 top-[4.75rem] z-50 rounded-2xl border border-purple-300/20 bg-black/55 px-3 py-1.5 text-right text-[11px] font-semibold leading-4 text-purple-100/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur hover:border-purple-200/40 hover:text-white"
    >
      <span>Inbox</span>
      <NotificationInboxBadge initialUnreadCount={unreadCount} />
    </Link>
  );
}
