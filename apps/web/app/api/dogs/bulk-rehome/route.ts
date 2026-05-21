import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function POST(request: Request) {
  try {
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

    const body = (await request.json()) as { dogIds?: unknown };
    const dogIds = Array.isArray(body.dogIds)
      ? body.dogIds
          .map((dogId) => String(dogId))
          .filter((dogId) => dogId.length > 0)
      : [];

    if (dogIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one dog to re-home." },
        { status: 400 }
      );
    }

    const dogs = await db.dog.findMany({
      where: {
        id: { in: dogIds },
        ownerKennelId: kennel.id,
      },
      select: {
        id: true,
        lifecycleState: true,
        marketState: true,
      },
    });

    if (dogs.length !== new Set(dogIds).size) {
      return NextResponse.json(
        { error: "One or more selected dogs could not be found in your kennel." },
        { status: 403 }
      );
    }

    const blockedDog = dogs.find(
      (dog) => dog.lifecycleState !== "ALIVE" || dog.marketState !== "NOT_FOR_SALE"
    );

    if (blockedDog) {
      return NextResponse.json(
        {
          error:
            "Only active dogs that are not listed for sale can be re-homed in bulk.",
        },
        { status: 400 }
      );
    }

    await db.dog.updateMany({
      where: {
        id: { in: dogIds },
        ownerKennelId: kennel.id,
      },
      data: {
        ownerKennelId: null,
        marketState: "NOT_FOR_SALE",
        lifecycleState: "TRANSFERRED",
      },
    });

    return NextResponse.json({
      ok: true,
      rehomedCount: dogIds.length,
      dogIds,
    });
  } catch (error) {
    console.error("POST /api/dogs/bulk-rehome failed:", error);

    return NextResponse.json(
      { error: "Failed to re-home selected dogs." },
      { status: 500 }
    );
  }
}
