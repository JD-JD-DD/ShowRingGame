import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import {
  getCommunityActor,
  moderateBulletinTopic,
  type BulletinTopicModerationAction,
} from "@/server/services/bulletin.service";

const ACTIONS = new Set(["PIN", "UNPIN", "LOCK", "UNLOCK", "HIDE", "RESTORE", "DELETE"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await params;
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.redirect(new URL("/login", request.url));
    const actor = await getCommunityActor(userId);
    const formData = await request.formData();
    const action = String(formData.get("action") ?? "");
    if (!ACTIONS.has(action)) throw new Error("Invalid moderation action.");

    const categorySlug = await moderateBulletinTopic({
      actor,
      threadId: topicId,
      action: action as BulletinTopicModerationAction,
      reason: String(formData.get("reason") ?? ""),
    });
    return NextResponse.redirect(
      new URL(`/community/${categorySlug}/${topicId}`, request.url)
    );
  } catch (error) {
    console.error("Unable to moderate community topic.", error);
    const url = new URL("/community", request.url);
    url.searchParams.set("error", error instanceof Error ? error.message : "Unable to moderate topic.");
    return NextResponse.redirect(url);
  }
}
