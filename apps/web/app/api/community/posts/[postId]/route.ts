import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import {
  deleteOwnBulletinReply,
  editOwnBulletinReply,
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
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.redirect(new URL("/login", request.url));

    const actor = await getCommunityActor(userId);
    const { postId } = await params;
    const formData = await request.formData();
    const action = String(formData.get("action") ?? "");

    const target = action === "EDIT"
      ? await editOwnBulletinReply({
          actor,
          postId,
          body: String(formData.get("body") ?? ""),
        })
      : action === "DELETE"
        ? await deleteOwnBulletinReply({ actor, postId })
        : null;

    if (!target) throw new Error("Invalid reply action.");
    return NextResponse.redirect(
      new URL(`/community/${target.categorySlug}/${target.threadId}`, request.url)
    );
  } catch (error) {
    console.error("Unable to update community reply.", error);
    return errorRedirect(
      request,
      error instanceof Error ? error.message : "Unable to update reply."
    );
  }
}
