import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24;

const TOKEN_TTL_MS = EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildEmailVerificationUrl(baseUrl: string, token: string): string {
  const url = new URL("/api/auth/email-verification/verify", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function createEmailVerificationToken({
  userId,
  bypassCooldown = false
}: {
  userId: string;
  bypassCooldown?: boolean;
}): Promise<{ email: string; token: string; expiresAt: Date } | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerifiedAt: true }
  });

  if (!user || user.emailVerifiedAt) return null;

  const now = new Date();
  if (!bypassCooldown) {
    const recentToken = await db.emailVerificationToken.findFirst({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: now },
        createdAt: { gte: new Date(now.getTime() - REQUEST_COOLDOWN_MS) }
      },
      select: { id: true }
    });

    if (recentToken) return null;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  await db.$transaction([
    db.emailVerificationToken.deleteMany({
      where: {
        userId,
        OR: [{ usedAt: { not: null } }, { expiresAt: { lte: now } }]
      }
    }),
    db.emailVerificationToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt }
    })
  ]);

  return { email: user.email, token, expiresAt };
}

export async function verifyEmailWithToken(token: string): Promise<boolean> {
  if (!token.trim()) return false;

  const now = new Date();
  const tokenHash = hashToken(token);

  return db.$transaction(async (tx) => {
    const verificationToken = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true }
    });

    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt.getTime() <= now.getTime()
    ) {
      return false;
    }

    const consumed = await tx.emailVerificationToken.updateMany({
      where: {
        id: verificationToken.id,
        usedAt: null,
        expiresAt: { gt: now }
      },
      data: { usedAt: now }
    });

    if (consumed.count !== 1) return false;

    await tx.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerifiedAt: now }
    });

    await tx.emailVerificationToken.updateMany({
      where: { userId: verificationToken.userId, usedAt: null },
      data: { usedAt: now }
    });

    return true;
  });
}
