import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildDogPageUrl, redirectToDogPageWithField } from "@/lib/dogPageRedirect";
import { getSessionUserId } from "@/lib/session";
import { validateRegisteredDogName } from "@/server/validation/dogName.validation";

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
      return redirectToDogPageWithField(
        request,
        dogId,
        "nameError",
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
      return redirectToDogPageWithField(request, dogId, "nameError", validation.error);
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
      return redirectToDogPageWithField(
        request,
        dogId,
        "nameError",
        "That dog name is already in use."
      );
    }

    await db.dog.update({
      where: { id: dogId },
      data: { registeredName: validation.name },
    });

    return NextResponse.redirect(buildDogPageUrl(request, dogId));
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/rename failed:", error);

    return NextResponse.json(
      { error: "Failed to rename dog." },
      { status: 500 }
    );
  }
}
