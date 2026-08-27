import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  hideKennelConversation,
  KennelMessagingError,
} from "@/server/services/kennelMessaging.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to hide a conversation." }, { status: 401 });
  const kennel = await getKennelForUser(userId);
  if (!kennel) return NextResponse.json({ error: "A kennel is required to hide a conversation." }, { status: 403 });

  const { conversationId } = await params;
  try {
    await hideKennelConversation({ requestingKennelId: kennel.id, conversationId });
    return NextResponse.json({ hidden: true });
  } catch (error) {
    if (error instanceof KennelMessagingError) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    throw error;
  }
}
