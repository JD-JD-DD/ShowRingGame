import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  createBulletinReply,
  getPostingKennelForUser,
} from "@/server/services/bulletin.service";

function redirectToThread(request: Request, threadId: string, error?: string) {
  const url = new URL(`/bulletin/thread/${threadId}`, request.url);

  if (error) {
    url.searchParams.set("error", error);
  }

  return NextResponse.redirect(url);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const formData = await request.formData();
  const body = String(formData.get("body") ?? "").trim();

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const kennel = await getPostingKennelForUser(userId);

    await createBulletinReply({
      kennelId: kennel.id,
      threadId,
      body,
      currentEpoch: getCurrentEpoch(),
    });

    return redirectToThread(request, threadId);
  } catch (error) {
    console.error("POST /api/bulletin/threads/[threadId]/posts failed:", error);
    return redirectToThread(
      request,
      threadId,
      error instanceof Error ? error.message : "Unable to create reply."
    );
  }
}
