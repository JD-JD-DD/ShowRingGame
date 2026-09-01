import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { previewSystemKennelBroadcast, SystemBroadcastError } from "@/server/services/kennelNotice.service";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  try { return NextResponse.json({ preview: await previewSystemKennelBroadcast({ input: await request.json() }) }); }
  catch (error) { return NextResponse.json({ error: error instanceof SystemBroadcastError ? error.message : "Unable to preview system broadcast." }, { status: error instanceof SystemBroadcastError ? error.status : 500 }); }
}
