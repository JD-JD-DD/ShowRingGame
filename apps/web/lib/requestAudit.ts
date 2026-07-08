import "server-only";

import { db } from "@/lib/db";

const IP_HEADER_PRIORITY = [
  "x-vercel-forwarded-for",
  "x-forwarded-for",
  "x-real-ip",
];

type CreateUserAccessAuditArgs = {
  request: Request;
  userId?: string | null;
  kennelId?: string | null;
  action: string;
  path?: string | null;
};

export function getClientIp(request: Request): string | null {
  for (const header of IP_HEADER_PRIORITY) {
    const value = request.headers.get(header);
    const ipAddress = value?.split(",")[0]?.trim();

    if (ipAddress) {
      return ipAddress;
    }
  }

  return null;
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.trim() || null;
}

function getRequestPath(request: Request): string | null {
  try {
    return new URL(request.url).pathname;
  } catch {
    return null;
  }
}

export async function createUserAccessAudit(
  args: CreateUserAccessAuditArgs
): Promise<void> {
  try {
    await db.userAccessAudit.create({
      data: {
        userId: args.userId ?? null,
        kennelId: args.kennelId ?? null,
        action: args.action,
        ipAddress: getClientIp(args.request),
        userAgent: getUserAgent(args.request),
        path: args.path ?? getRequestPath(args.request),
      },
    });
  } catch (error) {
    console.warn("Failed to create user access audit:", error);
  }
}
