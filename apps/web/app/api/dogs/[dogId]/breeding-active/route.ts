import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  try {
    const [{ dogId }, userId] = await Promise.all([params, getSessionUserId()]);

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

    const body: unknown = await request.json().catch(() => null);
    const candidate =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>).isBreedingActive
        : null;
    const isBreedingActive =
      typeof candidate === "boolean" ? candidate : null;

    if (isBreedingActive === null) {
      return NextResponse.json(
        { error: "isBreedingActive must be a Boolean." },
        { status: 400 }
      );
    }

    const dog = await db.dog.findUnique({
      where: { id: dogId },
      select: { id: true, ownerKennelId: true },
    });

    if (!dog) {
      return NextResponse.json({ error: "Dog not found." }, { status: 404 });
    }

    if (dog.ownerKennelId !== kennel.id) {
      return NextResponse.json(
        { error: "You do not own this dog." },
        { status: 403 }
      );
    }

    const updatedDog = await db.dog.update({
      where: { id: dog.id },
      data: { isBreedingActive },
      select: { isBreedingActive: true },
    });

    return NextResponse.json({ isBreedingActive: updatedDog.isBreedingActive });
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/breeding-active failed:", error);
    return NextResponse.json(
      { error: "Unable to update breeding participation." },
      { status: 500 }
    );
  }
}
