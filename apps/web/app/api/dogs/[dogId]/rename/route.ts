import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { validateRegisteredDogName } from "@/server/validation/dogName.validation";

function redirectWithNameError(request: Request, dogId: string, error: string) {
  const url = new URL(`/dogs/${dogId}`, request.url);
  url.searchParams.set("nameError", error);
  return NextResponse.redirect(url);
}

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

    const formData = await request.formData();

    const dog = await db.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        ownerKennelId: true,
        registeredName: true,
      },
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

    if (dog.registeredName?.trim()) {
      return redirectWithNameError(
        request,
        dogId,
        "This dog has already been named."
      );
    }

    const breeds = await db.breed.findMany({
      select: { name: true },
    });

    const validation = validateRegisteredDogName(
      formData.get("registeredName"),
      breeds.map((breed) => breed.name)
    );

    if (!validation.ok) {
      return redirectWithNameError(request, dogId, validation.error);
    }

    const existingDog = await db.dog.findFirst({
      where: {
        id: { not: dogId },
        registeredName: {
          equals: validation.name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingDog) {
      return redirectWithNameError(
        request,
        dogId,
        "That dog name is already in use."
      );
    }

    await db.dog.update({
      where: { id: dogId },
      data: { registeredName: validation.name },
    });

    return NextResponse.redirect(new URL(`/dogs/${dogId}`, request.url));
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/rename failed:", error);

    return NextResponse.json(
      { error: "Failed to rename dog." },
      { status: 500 }
    );
  }
}
