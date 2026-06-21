import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import {
  buildEmailVerificationUrl,
  createEmailVerificationToken
} from "@/lib/emailVerification";
import { sendEmailVerificationEmail } from "@/lib/emailVerificationEmail";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email ?? "");
    const password = String(body.password ?? "");
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim() : null;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        displayName,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    await createSession(user.id);

    let verificationEmailSent = false;
    try {
      const verification = await createEmailVerificationToken({
        userId: user.id,
        bypassCooldown: true
      });

      if (verification) {
        verificationEmailSent = await sendEmailVerificationEmail({
          to: verification.email,
          verificationUrl: buildEmailVerificationUrl(
            getAppBaseUrl(request),
            verification.token
          )
        });
      }

      if (!verificationEmailSent) {
        console.warn("New account created, but verification email delivery is not configured.");
      }
    } catch (error) {
      // Account creation must not be rolled back by a temporary mail-provider
      // failure. The player can resend from the account verification page.
      console.error("Unable to send signup verification email.", error);
    }

    return NextResponse.json({
      ok: true,
      user,
      verificationEmailSent,
      nextPath: "/onboarding",
    });
  } catch (error) {
    console.error("POST /api/auth/signup failed:", error);
    return NextResponse.json(
      { error: "Failed to create account." },
      { status: 500 }
    );
  }
}
