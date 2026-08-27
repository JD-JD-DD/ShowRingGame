import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getUnreadKennelConversationCount } from "@/server/services/kennelMessaging.service";
import { getUnreadKennelNoticeCount } from "@/server/services/kennelNotice.service";

function UnreadCount({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="theme-status-danger rounded-full px-2 py-0.5 text-sm font-semibold">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only"> {count === 1 ? "unread item" : "unread items"}</span>
    </span>
  );
}

export default async function InboxPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const kennel = await getKennelForUser(userId);
  if (!kennel) redirect("/onboarding");

  const [messageUnreadCount, noticeUnreadCount] = await Promise.all([
    getUnreadKennelConversationCount({ kennelId: kennel.id }),
    getUnreadKennelNoticeCount(kennel.id),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <section className="theme-panel rounded-2xl p-8">
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.25em]">My Kennel</p>
        <h1 className="theme-heading mt-2 text-4xl font-semibold">Inbox</h1>
        <p className="theme-copy mt-3">Messages from other kennels and system notices for {kennel.name}.</p>

        <nav className="mt-7 grid gap-3 sm:grid-cols-2" aria-label="Inbox sections">
          <Link
            href="/inbox/messages"
            className="theme-card flex items-center justify-between gap-4 rounded-xl p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span>
              <span className="theme-heading block text-lg font-semibold">Messages</span>
              <span className="theme-copy mt-1 block text-sm">Kennel-to-kennel correspondence.</span>
            </span>
            <UnreadCount count={messageUnreadCount} />
          </Link>
          <Link
            href="/inbox/notices"
            className="theme-card flex items-center justify-between gap-4 rounded-xl p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span>
              <span className="theme-heading block text-lg font-semibold">Notices</span>
              <span className="theme-copy mt-1 block text-sm">System updates and game activity.</span>
            </span>
            <UnreadCount count={noticeUnreadCount} />
          </Link>
        </nav>
      </section>
    </main>
  );
}
