import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createUserAccessAudit } from "@/lib/requestAudit";
import { createSession } from "@/lib/session";
import { normalizeEmail, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email ?? "");
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        kennel: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!verifyPassword(password, user.passwordHash)) {
      await createUserAccessAudit({
        request,
        userId: user.id,
        kennelId: user.kennel?.id ?? null,
        action: "LOGIN_FAILED_EMAIL_FOUND",
      });

      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const loggedInAt = new Date();

    await db.$executeRaw`
      UPDATE "User"
      SET
        "lastLoginAt" = ${loggedInAt},
        "lastActiveAt" = ${loggedInAt}
      WHERE "id" = ${user.id}
    `;
    await createSession(user.id);
    await createUserAccessAudit({
      request,
      userId: user.id,
      kennelId: user.kennel?.id ?? null,
      action: "LOGIN_SUCCESS",
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      kennel: user.kennel,
      nextPath: user.kennel ? "/kennel" : "/onboarding",
    });
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    return NextResponse.json(
      { error: "Failed to log in." },
      { status: 500 }
    );
  }
}
