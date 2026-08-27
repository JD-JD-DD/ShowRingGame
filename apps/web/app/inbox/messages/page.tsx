import Link from "next/link";
import { redirect } from "next/navigation";

import { formatFriendlyTimestamp } from "@/lib/friendlyTimestamp";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listKennelConversationSummaries } from "@/server/services/kennelMessaging.service";

export default async function InboxMessagesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const kennel = await getKennelForUser(userId);
  if (!kennel) redirect("/onboarding");

  const conversations = await listKennelConversationSummaries({ kennelId: kennel.id });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <section className="theme-panel rounded-2xl p-8">
        <nav className="theme-copy flex gap-4 text-sm" aria-label="Messages navigation">
          <Link href="/inbox" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Inbox</Link>
        </nav>
        <p className="theme-label mt-5 text-xs font-semibold uppercase tracking-[0.25em]">Inbox</p>
        <h1 className="theme-heading mt-2 text-4xl font-semibold">Messages</h1>
        {conversations.length === 0 ? (
          <p className="theme-copy mt-6 rounded-xl border border-white/10 p-5">
            You do not have any kennel messages yet.
          </p>
        ) : null}
        {conversations.length > 0 ? (
          <ul className="mt-6 grid gap-3" aria-label="Kennel conversations">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/inbox/messages/${conversation.id}`}
                  className="theme-card block rounded-xl p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="theme-heading text-lg font-semibold">{conversation.otherKennel.name}</h2>
                        {conversation.isUnread ? (
                          <span className="theme-status-info rounded-full px-2 py-0.5 text-xs font-semibold">Unread</span>
                        ) : null}
                      </div>
                      <p className="theme-copy mt-2 whitespace-pre-wrap text-sm">
                        {conversation.latestMessage?.body ?? "No messages yet."}
                      </p>
                    </div>
                    {conversation.latestMessage ? (
                      <time className="theme-label text-sm" dateTime={conversation.latestMessage.createdAt.toISOString()}>
                        {formatFriendlyTimestamp(conversation.latestMessage.createdAt)}
                      </time>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
