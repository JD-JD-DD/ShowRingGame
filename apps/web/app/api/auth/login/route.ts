import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { normalizeEmail, verifyPassword } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import {
  buildEmailVerificationUrl,
  createEmailVerificationToken
} from "@/lib/emailVerification";
import { sendEmailVerificationEmail } from "@/lib/emailVerificationEmail";

const LOGIN_VERIFICATION_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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

    if (!user || !verifyPassword(password, user.passwordHash)) {
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

    const requiresEmailVerification = !user.emailVerifiedAt;

    if (requiresEmailVerification) {
      try {
        const verification = await createEmailVerificationToken({
          userId: user.id,
          cooldownMs: LOGIN_VERIFICATION_EMAIL_COOLDOWN_MS
        });

        if (verification) {
          const delivered = await sendEmailVerificationEmail({
            to: verification.email,
            verificationUrl: buildEmailVerificationUrl(
              getAppBaseUrl(request),
              verification.token
            )
          });

          if (!delivered) {
            console.warn(
              "Unverified account logged in, but verification email delivery is not configured."
            );
          }
        }
      } catch (error) {
        // A mail-provider failure must not prevent the user from logging in and
        // reaching the page where they can request another verification email.
        console.error("Unable to send login verification email.", error);
      }
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      kennel: user.kennel,
      requiresEmailVerification,
      nextPath: requiresEmailVerification
        ? "/verify-email"
        : user.kennel
          ? "/kennel"
          : "/onboarding",
    });
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    return NextResponse.json(
      { error: "Failed to log in." },
      { status: 500 }
    );
  }
}
