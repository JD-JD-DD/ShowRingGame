import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  createBulletinThread,
  getPostingKennelForUser,
} from "@/server/services/bulletin.service";

function redirectWithError(request: Request, categorySlug: string, error: string) {
  const url = new URL(`/community/${categorySlug}`, request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const categorySlug = String(formData.get("categorySlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (!categorySlug) {
      throw new Error("Choose a bulletin category.");
    }

    const kennel = await getPostingKennelForUser(userId);
    const threadId = await createBulletinThread({
      kennelId: kennel.id,
      categorySlug,
      isAdmin: kennel.isAdmin,
      title,
      body,
      currentEpoch: getCurrentEpoch(),
    });

    return NextResponse.redirect(
      new URL(`/community/${categorySlug}/${threadId}`, request.url)
    );
  } catch (error) {
    console.error("POST /api/bulletin/threads failed:", error);
    return redirectWithError(
      request,
      categorySlug || "general",
      error instanceof Error ? error.message : "Unable to create thread."
    );
  }
}
