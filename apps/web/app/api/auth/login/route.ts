import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isIpBanned } from "@/lib/moderation";
import { createUserAccessAudit, getClientIp } from "@/lib/requestAudit";
import { createSession } from "@/lib/session";
import { normalizeEmail, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    if (await isIpBanned(getClientIp(request))) {
      return NextResponse.json(
        { error: "Access from this network is not permitted." },
        { status: 403 }
      );
    }

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
            moderationStatus: true,
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

    if (
      user.moderationStatus === "BANNED" ||
      user.kennel?.moderationStatus === "CLOSED"
    ) {
      return NextResponse.json(
        {
          error:
            "This account or kennel has been closed for a policy violation.",
          nextPath: "/account-closed",
        },
        { status: 403 }
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
      kennel: user.kennel
        ? {
            id: user.kennel.id,
            name: user.kennel.name,
            slug: user.kennel.slug,
          }
        : null,
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
