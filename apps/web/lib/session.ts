import { cookies } from "next/headers";
import {
  createSessionToken,
  decodeSessionToken,
  SESSION_COOKIE_NAME
} from "@/lib/sessionToken";

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  const token = createSessionToken({
    userId,
    issuedAt: Date.now(),
  });

  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = decodeSessionToken(token);
  return payload?.userId ?? null;
}
