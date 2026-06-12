import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  RehomeError,
  rehomeOwnedDogs,
} from "@/server/services/rehome.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  try {
    const { dogId } = await params;
    const currentEpoch = getCurrentEpoch();

    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await db.kennel.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    await rehomeOwnedDogs({
      kennelId: kennel.id,
      dogIds: [dogId],
      currentEpoch,
    });

    return NextResponse.redirect(new URL("/kennel", request.url));
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/rehome failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to re-home dog.",
      },
      { status: error instanceof RehomeError ? error.status : 500 }
    );
  }
}
