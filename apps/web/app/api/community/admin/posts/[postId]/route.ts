import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import {
  getCommunityActor,
  moderateBulletinPost,
  type BulletinPostModerationAction,
} from "@/server/services/bulletin.service";

const ACTIONS = new Set(["HIDE", "RESTORE", "DELETE"]);

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
    if (!ACTIONS.has(action)) throw new Error("Invalid moderation action.");

    const target = await moderateBulletinPost({
      actor,
      postId,
      action: action as BulletinPostModerationAction,
      reason: String(formData.get("reason") ?? ""),
    });
    return NextResponse.redirect(
      new URL(`/community/${target.categorySlug}/${target.threadId}`, request.url)
    );
  } catch (error) {
    console.error("Unable to moderate community post.", error);
    const url = new URL("/community", request.url);
    url.searchParams.set("error", error instanceof Error ? error.message : "Unable to moderate post.");
    return NextResponse.redirect(url);
  }
}
