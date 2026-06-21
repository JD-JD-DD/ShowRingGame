import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import {
  deleteOwnBulletinTopic,
  editOwnBulletinTopic,
  getCommunityActor,
} from "@/server/services/bulletin.service";

function errorRedirect(request: Request, message: string): NextResponse {
  const fallback = new URL("/community", request.url);
  const referer = request.headers.get("referer");

  if (referer) {
    const target = new URL(referer);
    if (target.origin === fallback.origin) {
      target.searchParams.set("error", message);
      return NextResponse.redirect(target);
    }
  }

  fallback.searchParams.set("error", message);
  return NextResponse.redirect(fallback);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.redirect(new URL("/login", request.url));

    const actor = await getCommunityActor(userId);
    const { topicId } = await params;
    const formData = await request.formData();
    const action = String(formData.get("action") ?? "");

    if (action === "EDIT") {
      const categorySlug = await editOwnBulletinTopic({
        actor,
        threadId: topicId,
        title: String(formData.get("title") ?? ""),
        body: String(formData.get("body") ?? ""),
      });
      return NextResponse.redirect(
        new URL(`/community/${categorySlug}/${topicId}`, request.url)
      );
    }

    if (action === "DELETE") {
      const categorySlug = await deleteOwnBulletinTopic({ actor, threadId: topicId });
      return NextResponse.redirect(new URL(`/community/${categorySlug}`, request.url));
    }

    throw new Error("Invalid topic action.");
  } catch (error) {
    console.error("Unable to update community topic.", error);
    return errorRedirect(
      request,
      error instanceof Error ? error.message : "Unable to update topic."
    );
  }
}
