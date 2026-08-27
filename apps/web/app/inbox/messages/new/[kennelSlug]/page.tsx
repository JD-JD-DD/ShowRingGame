import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ConversationReplyForm } from "@/components/messages/ConversationReplyForm";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  getMessageableKennelBySlug,
  getKennelMessagingBlockState,
  MAX_KENNEL_MESSAGE_LENGTH,
} from "@/server/services/kennelMessaging.service";

export default async function NewKennelMessagePage({
  params,
}: {
  params: Promise<{ kennelSlug: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const currentKennel = await getKennelForUser(userId);
  if (!currentKennel) redirect("/onboarding");

  const { kennelSlug } = await params;
  const targetKennel = await getMessageableKennelBySlug({ slug: kennelSlug });
  if (!targetKennel || targetKennel.id === currentKennel.id) notFound();
  const blockState = await getKennelMessagingBlockState({
    requestingKennelId: currentKennel.id,
    otherKennelId: targetKennel.id,
  });
  if (blockState.isBlocked) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <section className="theme-panel rounded-2xl p-8">
        <nav className="theme-copy flex flex-wrap gap-4 text-sm" aria-label="Messages navigation">
          <Link href="/inbox" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Inbox</Link>
          <Link href="/inbox/messages" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Messages</Link>
          <Link href={`/kennels/${targetKennel.slug}`} className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Back to kennel</Link>
        </nav>
        <p className="theme-label mt-5 text-xs font-semibold uppercase tracking-[0.25em]">Messages</p>
        <h1 className="theme-heading mt-2 text-3xl font-semibold">Message {targetKennel.name}</h1>
        <ConversationReplyForm
          maxLength={MAX_KENNEL_MESSAGE_LENGTH}
          actionUrl="/api/inbox/messages/new"
          redirectToConversation
          targetKennelSlug={targetKennel.slug}
          label="Message"
        />
      </section>
    </main>
  );
}
