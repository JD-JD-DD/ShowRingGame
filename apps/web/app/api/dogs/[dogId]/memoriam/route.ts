import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  try {
    const { dogId } = await params;
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

    await db.dog.updateMany({
      where: {
        id: dogId,
        ownerKennelId: kennel.id,
        lifecycleState: "DECEASED",
        isPlayerVisible: true,
      },
      data: {
        showInMemoriam: false,
      },
    });

    return NextResponse.redirect(new URL("/memorium", request.url), {
      status: 303,
    });
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/memoriam failed", error);
    return NextResponse.json(
      { error: "Unable to update In Memoriam visibility." },
      { status: 500 }
    );
  }
}
