import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  createBulletinReply,
  getPostingKennelForUser,
} from "@/server/services/bulletin.service";

function redirectToThread(
  request: Request,
  categorySlug: string,
  threadId: string,
  error?: string
) {
  const url = new URL(`/community/${categorySlug}/${threadId}`, request.url);

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
  const requestedCategorySlug = String(formData.get("categorySlug") ?? "general").trim();

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const kennel = await getPostingKennelForUser(userId);

    const categorySlug = await createBulletinReply({
      kennelId: kennel.id,
      isAdmin: kennel.isAdmin,
      threadId,
      body,
      currentEpoch: getCurrentEpoch(),
    });

    return redirectToThread(request, categorySlug, threadId);
  } catch (error) {
    console.error("POST /api/bulletin/threads/[threadId]/posts failed:", error);
    return redirectToThread(
      request,
      requestedCategorySlug,
      threadId,
      error instanceof Error ? error.message : "Unable to create reply."
    );
  }
}
