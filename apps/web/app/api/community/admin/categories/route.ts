import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import {
  getCommunityActor,
  saveBulletinCategory,
} from "@/server/services/bulletin.service";

const POLICIES = new Set(["MEMBERS", "ADMINS", "DISABLED"]);

function redirectToCommunity(request: Request, key: "saved" | "error", value: string) {
  const url = new URL("/community", request.url);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.redirect(new URL("/login", request.url));
    const actor = await getCommunityActor(userId);
    if (!actor.isAdmin) throw new Error("Administrator access required.");

    const formData = await request.formData();
    const topicPolicy = String(formData.get("topicCreationPolicy") ?? "MEMBERS");
    const replyPolicy = String(formData.get("replyPolicy") ?? "MEMBERS");
    if (!POLICIES.has(topicPolicy) || !POLICIES.has(replyPolicy)) {
      throw new Error("Invalid category permission.");
    }

    await saveBulletinCategory({
      actor,
      id: String(formData.get("id") ?? "").trim() || undefined,
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      description: String(formData.get("description") ?? ""),
      sortOrder: Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
      isActive: formData.get("isActive") === "true",
      topicCreationPolicy: topicPolicy as "MEMBERS" | "ADMINS" | "DISABLED",
      replyPolicy: replyPolicy as "MEMBERS" | "ADMINS" | "DISABLED",
    });

    return redirectToCommunity(request, "saved", "1");
  } catch (error) {
    console.error("Unable to save community category.", error);
    return redirectToCommunity(
      request,
      "error",
      error instanceof Error ? error.message : "Unable to save category."
    );
  }
}
