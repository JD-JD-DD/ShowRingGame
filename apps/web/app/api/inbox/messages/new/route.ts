import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  getMessageableKennelBySlug,
  KennelMessagingError,
  sendKennelMessage,
} from "@/server/services/kennelMessaging.service";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to send a message." }, { status: 401 });

  const senderKennel = await getKennelForUser(userId);
  if (!senderKennel) return NextResponse.json({ error: "A kennel is required to send messages." }, { status: 403 });

  const payload = await request.json().catch(() => null) as { kennelSlug?: unknown; body?: unknown } | null;
  const targetKennel = typeof payload?.kennelSlug === "string"
    ? await getMessageableKennelBySlug({ slug: payload.kennelSlug })
    : null;

  if (!targetKennel || targetKennel.id === senderKennel.id) {
    return NextResponse.json({ error: "This kennel is not currently available for messaging." }, { status: 404 });
  }

  try {
    const result = await sendKennelMessage({
      senderKennelId: senderKennel.id,
      recipientKennelId: targetKennel.id,
      body: payload?.body,
    });
    return NextResponse.json({ conversationId: result.id });
  } catch (error) {
    if (error instanceof KennelMessagingError) {
      const status = error.code === "INVALID_MESSAGE" || error.code === "MESSAGE_TOO_LONG" ? 400 : 403;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
