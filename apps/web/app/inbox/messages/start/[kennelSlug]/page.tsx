import { notFound, redirect } from "next/navigation";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  findKennelConversation,
  getMessageableKennelBySlug,
  KennelMessagingError,
  type KennelConversationDto,
} from "@/server/services/kennelMessaging.service";

export default async function StartKennelMessagePage({
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

  let conversation: KennelConversationDto | null;
  try {
    conversation = await findKennelConversation({
      requestingKennelId: currentKennel.id,
      otherKennelId: targetKennel.id,
    });
  } catch (error) {
    if (error instanceof KennelMessagingError) notFound();
    throw error;
  }

  if (conversation) redirect(`/inbox/messages/${conversation.id}`);
  redirect(`/inbox/messages/new/${targetKennel.slug}`);
}
