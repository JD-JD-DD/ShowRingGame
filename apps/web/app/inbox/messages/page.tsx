import { redirect } from "next/navigation";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getUnreadKennelConversationCount } from "@/server/services/kennelMessaging.service";

export default async function InboxMessagesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const kennel = await getKennelForUser(userId);
  if (!kennel) redirect("/onboarding");

  const unreadCount = await getUnreadKennelConversationCount({ kennelId: kennel.id });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <section className="theme-panel rounded-2xl p-8">
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.25em]">Inbox</p>
        <h1 className="theme-heading mt-2 text-4xl font-semibold">Messages</h1>
        {unreadCount > 0 ? (
          <p className="theme-status-info mt-4 rounded-xl px-4 py-3 text-sm font-semibold">
            {unreadCount} {unreadCount === 1 ? "conversation has" : "conversations have"} unread activity.
          </p>
        ) : null}
        <p className="theme-copy mt-4">Kennel messages will appear here.</p>
      </section>
    </main>
  );
}
