import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import {
  buildEmailVerificationUrl,
  createEmailVerificationToken
} from "@/lib/emailVerification";
import { sendEmailVerificationEmail } from "@/lib/emailVerificationEmail";
import { getSessionUserId } from "@/lib/session";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Log in to verify your email." }, { status: 401 });
  }

  try {
    const verification = await createEmailVerificationToken({ userId });

    // An already-verified account and a cooldown both produce a successful,
    // non-revealing response. The page refresh will show verified state.
    if (!verification) {
      return NextResponse.json({
        ok: true,
        message: "Your email is already verified, or a verification email was sent recently."
      });
    }

    const verificationUrl = buildEmailVerificationUrl(
      getAppBaseUrl(request),
      verification.token
    );
    const delivered = await sendEmailVerificationEmail({
      to: verification.email,
      verificationUrl
    });

    if (!delivered) {
      console.warn("Email verification requested, but email delivery is not configured.");
    }

    return NextResponse.json({
      ok: true,
      message: delivered
        ? "Verification email sent. Check your inbox."
        : "Email delivery is not configured yet.",
      ...(process.env.NODE_ENV !== "production" ? { verificationUrl } : {})
    });
  } catch (error) {
    console.error("Unable to send email verification.", error);
    return NextResponse.json(
      { error: "Unable to send a verification email right now." },
      { status: 500 }
    );
  }
}
