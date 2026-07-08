import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createUserAccessAudit } from "@/lib/requestAudit";
import { clearSession, peekSessionUserId } from "@/lib/session";

const LOGOUT_REDIRECT_PATH = "/login";

function wantsHtmlRedirect(request: NextRequest): boolean {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await peekSessionUserId();
    const kennel = userId
      ? await db.kennel.findUnique({
          where: { userId },
          select: { id: true },
        })
      : null;

    if (userId) {
      await createUserAccessAudit({
        request,
        userId,
        kennelId: kennel?.id ?? null,
        action: "LOGOUT",
      });
    }

    await clearSession();

    if (wantsHtmlRedirect(request)) {
      return NextResponse.redirect(
        new URL(LOGOUT_REDIRECT_PATH, request.url),
        303
      );
    }

    return NextResponse.json({
      ok: true,
      nextPath: LOGOUT_REDIRECT_PATH,
    });
  } catch (error) {
    console.error("POST /api/auth/logout failed:", error);

    return NextResponse.json(
      { error: "Failed to log out." },
      { status: 500 }
    );
  }
}

