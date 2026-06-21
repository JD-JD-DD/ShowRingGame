export function getAppBaseUrl(request: Request): string {
  const configuredUrl = process.env.APP_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl;

  // Never build a production account link from an untrusted Host header.
  if (process.env.NODE_ENV === "production") {
    return "https://show-ring-game.vercel.app";
  }

  return new URL(request.url).origin;
}
