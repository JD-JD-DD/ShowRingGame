import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  DogNamingError,
  updateDogNaming,
} from "@/server/services/dogNaming.service";

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

    const updatedDog = await updateDogNaming({
      kennelId: kennel.id,
      dogId,
      callName: (await request.formData()).get("callName"),
    });

    return NextResponse.json({ callName: updatedDog.callName });
  } catch (error) {
    if (error instanceof DogNamingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/dogs/[dogId]/call-name failed:", error);

    return NextResponse.json({ error: "Failed to update call name." }, { status: 500 });
  }
}
