import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  KennelMessagingError,
  reportKennelConversation,
} from "@/server/services/kennelMessaging.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to submit a report." }, { status: 401 });
  const kennel = await getKennelForUser(userId);
  if (!kennel) return NextResponse.json({ error: "A kennel is required to submit a report." }, { status: 403 });

  const { conversationId } = await params;
  const payload = await request.json().catch(() => null) as { reason?: unknown; detail?: unknown } | null;
  try {
    const report = await reportKennelConversation({
      requestingKennelId: kennel.id,
      conversationId,
      reason: payload?.reason,
      detail: payload?.detail,
    });
    return NextResponse.json({ reportId: report.id }, { status: 201 });
  } catch (error) {
    if (error instanceof KennelMessagingError) {
      const status = error.code === "CONVERSATION_NOT_FOUND" || error.code === "NOT_CONVERSATION_PARTICIPANT" ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
