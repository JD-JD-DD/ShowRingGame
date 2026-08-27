import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ConversationReplyForm } from "@/components/messages/ConversationReplyForm";
import { formatFriendlyTimestamp } from "@/lib/friendlyTimestamp";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  KennelMessagingError,
  type KennelConversationHistoryDto,
  loadKennelConversationHistory,
  markKennelConversationRead,
  MAX_KENNEL_MESSAGE_LENGTH,
} from "@/server/services/kennelMessaging.service";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const kennel = await getKennelForUser(userId);
  if (!kennel) redirect("/onboarding");

  const { conversationId } = await params;
  let conversation: KennelConversationHistoryDto;

  try {
    conversation = await loadKennelConversationHistory({
      requestingKennelId: kennel.id,
      conversationId,
    });
    await markKennelConversationRead({
      requestingKennelId: kennel.id,
      conversationId,
    });
  } catch (error) {
    if (error instanceof KennelMessagingError) notFound();
    throw error;
  }

  const otherKennel = conversation.firstKennel.id === kennel.id
    ? conversation.secondKennel
    : conversation.firstKennel;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <section className="theme-panel rounded-2xl p-8">
        <nav className="theme-copy flex flex-wrap gap-4 text-sm" aria-label="Messages navigation">
          <Link href="/inbox" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Inbox</Link>
          <Link href="/inbox/messages" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Messages</Link>
        </nav>
        <p className="theme-label mt-5 text-xs font-semibold uppercase tracking-[0.25em]">Messages</p>
        <h1 className="theme-heading mt-2 text-3xl font-semibold">
          <Link href={`/kennels/${otherKennel.slug}`} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {otherKennel.name}
          </Link>
        </h1>

        <ol className="mt-6 grid gap-4" aria-label={`Conversation with ${otherKennel.name}`}>
          {conversation.messages.map((message) => {
            const isCurrentKennel = message.senderKennel.id === kennel.id;
            const senderLabel = isCurrentKennel ? "You" : message.senderKennel.name;

            return (
              <li key={message.id} className={isCurrentKennel ? "justify-self-end max-w-[85%]" : "justify-self-start max-w-[85%]"}>
                <article className={isCurrentKennel ? "theme-status-info rounded-xl p-4" : "theme-card rounded-xl p-4"} aria-label={`Message from ${senderLabel}`}>
                  <div className="theme-label flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
                    <span>{senderLabel}</span>
                    <time dateTime={message.createdAt.toISOString()}>{formatFriendlyTimestamp(message.createdAt)}</time>
                  </div>
                  <p className="theme-copy mt-3 whitespace-pre-wrap break-words">{message.body}</p>
                </article>
              </li>
            );
          })}
        </ol>

        <ConversationReplyForm conversationId={conversation.id} maxLength={MAX_KENNEL_MESSAGE_LENGTH} />
      </section>
    </main>
  );
}
