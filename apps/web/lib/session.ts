import { cookies } from "next/headers";
import {
  createSessionToken,
  decodeSessionToken,
  SESSION_COOKIE_NAME
} from "@/lib/sessionToken";
import { db } from "@/lib/db";

function getUtcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

async function touchUserLastActive(userId: string): Promise<void> {
  const now = new Date();
  const todayStart = getUtcDayStart(now);

  await db.$executeRaw`
    UPDATE "User"
    SET "lastActiveAt" = ${now}
    WHERE "id" = ${userId}
      AND ("lastActiveAt" IS NULL OR "lastActiveAt" < ${todayStart})
  `;
}

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

  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = decodeSessionToken(token);
  const userId = payload?.userId ?? null;

  if (userId) {
    await touchUserLastActive(userId);
  }

  return userId;
}

export async function peekSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  return decodeSessionToken(token)?.userId ?? null;
}
