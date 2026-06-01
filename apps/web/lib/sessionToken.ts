import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "showring_session";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me";

export type SessionPayload = {
  userId: string;
  issuedAt: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

export function createSessionToken(payload: SessionPayload): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function decodeSessionToken(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");

  if (!body || !signature) return null;

  const expectedSignature = sign(body);
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);

  if (
    signatureBytes.length !== expectedBytes.length ||
    !timingSafeEqual(signatureBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as SessionPayload;
    if (!parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}
