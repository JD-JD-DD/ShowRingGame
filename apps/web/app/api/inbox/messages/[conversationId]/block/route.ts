import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  blockKennelMessaging,
  KennelMessagingError,
  loadKennelConversationHistory,
} from "@/server/services/kennelMessaging.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to update messaging availability." }, { status: 401 });

  const kennel = await getKennelForUser(userId);
  if (!kennel) return NextResponse.json({ error: "A kennel is required to update messaging availability." }, { status: 403 });

  const { conversationId } = await params;
  try {
    const history = await loadKennelConversationHistory({
      requestingKennelId: kennel.id,
      conversationId,
    });
    const otherKennel = history.firstKennel.id === kennel.id
      ? history.secondKennel
      : history.firstKennel;
    await blockKennelMessaging({
      blockerKennelId: kennel.id,
      blockedKennelId: otherKennel.id,
    });
    return NextResponse.json({ blocked: true });
  } catch (error) {
    if (error instanceof KennelMessagingError) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    throw error;
  }
}
