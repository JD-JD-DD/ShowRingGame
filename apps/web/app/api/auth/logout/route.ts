import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST() {
  try {
    await clearSession();

    return NextResponse.json({
      ok: true,
      nextPath: "/login",
    });
  } catch (error) {
    console.error("POST /api/auth/logout failed:", error);

    return NextResponse.json(
      { error: "Failed to log out." },
      { status: 500 }
    );
  }
}

