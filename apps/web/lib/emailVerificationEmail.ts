import { EMAIL_VERIFICATION_TOKEN_TTL_HOURS } from "@/lib/emailVerification";

export async function sendEmailVerificationEmail({
  to,
  verificationUrl
}: {
  to: string;
  verificationUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.EMAIL_VERIFICATION_FROM_EMAIL?.trim() ||
    process.env.PASSWORD_RESET_FROM_EMAIL?.trim();

  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Verify your ShowRing Game email",
      text: [
        "Verify the email address for your ShowRing Game account.",
        "",
        `Verify your email: ${verificationUrl}`,
        "",
        `This link expires in ${EMAIL_VERIFICATION_TOKEN_TTL_HOURS} hours and can be used only once.`,
        "If you did not create this account, you can ignore this email."
      ].join("\n")
    })
  });

  if (!response.ok) {
    throw new Error(
      `Resend verification email request failed with status ${response.status}.`
    );
  }

  return true;
}
