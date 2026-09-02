import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { DogNamingError } from "@/server/services/dogNaming.service";
import {
  LitterBulkNamingError,
  type LitterBulkNamingUpdate,
  updateLitterPuppyNames,
} from "@/server/services/litterBulkNaming.service";

function parseUpdates(body: unknown): LitterBulkNamingUpdate[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { updates?: unknown }).updates)) return null;

  const updates = (body as { updates: unknown[] }).updates;
  if (updates.length === 0) return null;

  const dogIds = new Set<string>();
  const parsed: LitterBulkNamingUpdate[] = [];
  for (const update of updates) {
    if (!update || typeof update !== "object") return null;
    const row = update as Record<string, unknown>;
    const hasCallName = Object.prototype.hasOwnProperty.call(row, "callName");
    const hasRegisteredName = Object.prototype.hasOwnProperty.call(row, "registeredName");
    if (
      typeof row.dogId !== "string" || !row.dogId || dogIds.has(row.dogId) ||
      (!hasCallName && !hasRegisteredName) ||
      (hasCallName && typeof row.callName !== "string" && row.callName !== null) ||
      (hasRegisteredName && typeof row.registeredName !== "string")
    ) return null;

    dogIds.add(row.dogId);
    parsed.push({
      dogId: row.dogId,
      ...(hasCallName ? { callName: row.callName as string | null } : {}),
      ...(hasRegisteredName ? { registeredName: row.registeredName as string } : {}),
    });
  }
  return parsed;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ litterId: string }> }) {
  try {
    const [{ litterId }, userId] = await Promise.all([params, getSessionUserId()]);
    if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const kennel = await db.kennel.findUnique({ where: { userId }, select: { id: true } });
    if (!kennel) return NextResponse.json({ error: "Kennel not found." }, { status: 404 });

    const updates = parseUpdates(await request.json().catch(() => null));
    if (!updates) return NextResponse.json({ error: "Invalid naming request." }, { status: 400 });

    return NextResponse.json(await updateLitterPuppyNames({ kennelId: kennel.id, litterId, updates }));
  } catch (error) {
    if (error instanceof LitterBulkNamingError || error instanceof DogNamingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("PATCH /api/litters/[litterId]/puppies/bulk-name failed:", error);
    return NextResponse.json({ error: "Failed to update puppy names." }, { status: 500 });
  }
}
