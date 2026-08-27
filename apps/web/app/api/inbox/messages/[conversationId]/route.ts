import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  KennelMessagingError,
  type KennelConversationHistoryDto,
  loadKennelConversationHistory,
  sendKennelMessage,
} from "@/server/services/kennelMessaging.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to send a message." }, { status: 401 });
  }

  const kennel = await getKennelForUser(userId);
  if (!kennel) {
    return NextResponse.json({ error: "A kennel is required to send messages." }, { status: 403 });
  }

  const { conversationId } = await params;
  let history: KennelConversationHistoryDto;

  try {
    history = await loadKennelConversationHistory({
      requestingKennelId: kennel.id,
      conversationId,
    });
  } catch (error) {
    if (error instanceof KennelMessagingError) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    throw error;
  }

  const recipientKennel = history.firstKennel.id === kennel.id
    ? history.secondKennel
    : history.firstKennel;
  const payload = await request.json().catch(() => null) as { body?: unknown } | null;

  try {
    const result = await sendKennelMessage({
      senderKennelId: kennel.id,
      recipientKennelId: recipientKennel.id,
      body: payload?.body,
    });
    return NextResponse.json({ message: result.message });
  } catch (error) {
    if (error instanceof KennelMessagingError) {
      const status = error.code === "INVALID_MESSAGE" || error.code === "MESSAGE_TOO_LONG" ? 400 : 403;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
