import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MINUTES
} from "../lib/passwordReset";

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    throw new Error(
      "Usage: npm --workspace apps/web run password-reset-link -- user@example.com"
    );
  }

  const reset = await createPasswordResetToken({
    email,
    // Support staff may need to replace a link immediately if the tester lost
    // the first one, so this trusted command is not subject to browser cooldown.
    bypassCooldown: true
  });

  if (!reset) {
    throw new Error("No account was found for that email address.");
  }

  const baseUrl =
    process.env.APP_BASE_URL?.trim() || "https://show-ring-game.vercel.app";
  const resetUrl = buildPasswordResetUrl(baseUrl, reset.token);

  console.log(
    `Password reset link (expires in ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes):`
  );
  console.log(resetUrl);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
