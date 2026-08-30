import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return fail("Unauthorized.", 401);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof (body as { showSupporterBadge?: unknown }).showSupporterBadge !== "boolean") return fail("Invalid supporter badge preference.", 400);
  const updated = await db.kennel.updateMany({ where: { userId }, data: { showSupporterBadge: (body as { showSupporterBadge: boolean }).showSupporterBadge } });
  if (updated.count !== 1) return fail("Unable to update supporter badge preference.", 404);
  return ok({ showSupporterBadge: (body as { showSupporterBadge: boolean }).showSupporterBadge });
}
