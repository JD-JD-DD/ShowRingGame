import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

const LOGOUT_REDIRECT_PATH = "/login";

function wantsHtmlRedirect(request: NextRequest): boolean {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

export async function POST(request: NextRequest) {
  try {
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

