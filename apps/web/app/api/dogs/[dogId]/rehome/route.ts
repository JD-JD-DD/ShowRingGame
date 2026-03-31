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

    const dog = await db.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        ownerKennelId: true,
        lifecycleState: true,
      },
    });

    if (!dog) {
      return NextResponse.json({ error: "Dog not found." }, { status: 404 });
    }

    if (dog.ownerKennelId !== kennel.id) {
      return NextResponse.json({ error: "You do not own this dog." }, { status: 403 });
    }

    if (dog.lifecycleState !== "ALIVE") {
      return NextResponse.json(
        { error: "Only active dogs can be re-homed." },
        { status: 400 }
      );
    }

    await db.dog.update({
      where: { id: dogId },
      data: {
        ownerKennelId: null,
        marketState: "NOT_FOR_SALE",
        lifecycleState: "TRANSFERRED",
      },
    });

    return NextResponse.redirect(new URL("/kennel", request.url));
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/rehome failed:", error);

    return NextResponse.json(
      { error: "Failed to re-home dog." },
      { status: 500 }
    );
  }
}