import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { validateCallName } from "@/server/validation/dogName.validation";

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

    const validation = validateCallName((await request.formData()).get("callName"));

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updatedDog = await db.dog.update({
      where: { id: dogId },
      data: { callName: validation.name || null },
      select: { callName: true },
    });

    return NextResponse.json({ callName: updatedDog.callName });
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/call-name failed:", error);

    return NextResponse.json(
      { error: "Failed to update call name." },
      { status: 500 }
    );
  }
}
