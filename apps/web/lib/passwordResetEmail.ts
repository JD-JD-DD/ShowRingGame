export async function sendPasswordResetEmail({
  to,
  resetUrl
}: {
  to: string;
  resetUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PASSWORD_RESET_FROM_EMAIL?.trim();

  // This lets local development and support-generated links work before an
  // email sender is configured, while production requests stay private.
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
      subject: "Reset your ShowRing Game password",
      text: [
        "A password reset was requested for your ShowRing Game account.",
        "",
        `Reset your password: ${resetUrl}`,
        "",
        "This link expires in 60 minutes and can be used only once.",
        "If you did not request this change, you can ignore this email."
      ].join("\n")
    })
  });

  if (!response.ok) {
    throw new Error(`Resend email request failed with status ${response.status}.`);
  }

  return true;
}
