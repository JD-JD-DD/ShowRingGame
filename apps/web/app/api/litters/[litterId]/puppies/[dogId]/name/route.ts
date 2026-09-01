import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  DogNamingError,
  updateDogNaming,
} from "@/server/services/dogNaming.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ litterId: string; dogId: string }> }
) {
  try {
    const [{ litterId, dogId }, userId] = await Promise.all([
      params,
      getSessionUserId(),
    ]);
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

    const body: Record<string, unknown> | null = await request
      .json()
      .catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid naming request." }, { status: 400 });
    }

    const hasCallName = Object.prototype.hasOwnProperty.call(body, "callName");
    const hasRegisteredName = Object.prototype.hasOwnProperty.call(
      body,
      "registeredName"
    );
    if (!hasCallName && !hasRegisteredName) {
      return NextResponse.json({ error: "No naming changes were provided." }, { status: 400 });
    }
    const callName =
      typeof body.callName === "string" || body.callName === null
        ? body.callName
        : undefined;
    const registeredName =
      typeof body.registeredName === "string" ? body.registeredName : undefined;
    if ((hasCallName && callName === undefined) || (hasRegisteredName && registeredName === undefined)) {
      return NextResponse.json({ error: "Invalid naming request." }, { status: 400 });
    }

    const updatedDog = await db.$transaction(async (tx) => {
      const litter = await tx.litter.findUnique({
        where: { id: litterId },
        select: { id: true, bredByKennelId: true },
      });
      if (!litter || litter.bredByKennelId !== kennel.id) {
        throw new DogNamingError("Litter not found.", 404);
      }

      const puppy = await tx.dog.findUnique({
        where: { id: dogId },
        select: { id: true, litterId: true, ownerKennelId: true },
      });
      if (!puppy || puppy.litterId !== litter.id) {
        throw new DogNamingError("Puppy not found in this litter.", 404);
      }
      if (puppy.ownerKennelId !== kennel.id) {
        throw new DogNamingError(
          "This puppy is no longer owned by your kennel.",
          403
        );
      }

      return updateDogNaming({
        kennelId: kennel.id,
        dogId,
        ...(hasCallName ? { callName } : {}),
        ...(hasRegisteredName ? { registeredName } : {}),
        client: tx,
      });
    });

    return NextResponse.json(updatedDog);
  } catch (error) {
    if (error instanceof DogNamingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("PATCH /api/litters/[litterId]/puppies/[dogId]/name failed:", error);
    return NextResponse.json({ error: "Failed to update puppy name." }, { status: 500 });
  }
}
