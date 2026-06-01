import { createHash, randomBytes } from "node:crypto";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import { db } from "@/lib/db";

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;

const PASSWORD_RESET_TOKEN_TTL_MS =
  PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000;
const PASSWORD_RESET_REQUEST_COOLDOWN_MS = 60 * 1000;

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildPasswordResetUrl(baseUrl: string, token: string): string {
  const resetUrl = new URL("/reset-password", baseUrl);
  resetUrl.searchParams.set("token", token);
  return resetUrl.toString();
}

export async function createPasswordResetToken({
  email,
  bypassCooldown = false
}: {
  email: string;
  bypassCooldown?: boolean;
}): Promise<{ email: string; token: string; expiresAt: Date } | null> {
  const user = await db.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, email: true }
  });

  // Returning null for both an unknown account and a throttled request keeps
  // the public endpoint from revealing whether an email address is registered.
  if (!user) return null;

  const now = new Date();
  if (!bypassCooldown) {
    const recentToken = await db.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: now },
        createdAt: {
          gte: new Date(now.getTime() - PASSWORD_RESET_REQUEST_COOLDOWN_MS)
        }
      },
      select: { id: true }
    });

    if (recentToken) return null;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);

  await db.$transaction([
    // A user needs only active links. Clearing expired and consumed records
    // also prevents this table from growing indefinitely for repeat requests.
    db.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        OR: [{ usedAt: { not: null } }, { expiresAt: { lte: now } }]
      }
    }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashPasswordResetToken(token),
        expiresAt
      }
    })
  ]);

  return { email: user.email, token, expiresAt };
}

export async function resetPasswordWithToken({
  token,
  password
}: {
  token: string;
  password: string;
}): Promise<boolean> {
  if (!token.trim()) return false;

  const now = new Date();
  const tokenHash = hashPasswordResetToken(token);
  const passwordHash = hashPassword(password);

  return db.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true }
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() <= now.getTime()
    ) {
      return false;
    }

    // Consuming the token with a guarded update prevents two simultaneous
    // requests from using the same single-use link.
    const consumed = await tx.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
        expiresAt: { gt: now }
      },
      data: { usedAt: now }
    });

    if (consumed.count !== 1) return false;

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash }
    });

    // A successful password change revokes any other outstanding links.
    await tx.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: now }
    });

    return true;
  });
}
