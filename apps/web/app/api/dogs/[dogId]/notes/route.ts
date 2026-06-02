import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const MAX_PRIVATE_NOTES_LENGTH = 5000;

function redirectWithNotesMessage(
  request: Request,
  dogId: string,
  field: "notesError" | "notesMessage",
  message: string
) {
  const url = new URL(`/dogs/${dogId}`, request.url);
  url.searchParams.set(field, message);
  return NextResponse.redirect(url);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const { dogId } = await params;

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

    const dog = await db.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        ownerKennelId: true,
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

    const formData = await request.formData();
    const notes = String(formData.get("notes") ?? "").trim();

    if (notes.length > MAX_PRIVATE_NOTES_LENGTH) {
      return redirectWithNotesMessage(
        request,
        dogId,
        "notesError",
        `Notes cannot exceed ${MAX_PRIVATE_NOTES_LENGTH.toLocaleString()} characters.`
      );
    }

    if (notes) {
      await db.kennelDogPrivateNote.upsert({
        where: {
          kennelId_dogId: {
            kennelId: kennel.id,
            dogId: dog.id,
          },
        },
        create: {
          kennelId: kennel.id,
          dogId: dog.id,
          notes,
        },
        update: {
          notes,
        },
      });
    } else {
      await db.kennelDogPrivateNote.deleteMany({
        where: {
          kennelId: kennel.id,
          dogId: dog.id,
        },
      });
    }

    return redirectWithNotesMessage(
      request,
      dogId,
      "notesMessage",
      "Private notes saved."
    );
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/notes failed:", error);

    return redirectWithNotesMessage(
      request,
      dogId,
      "notesError",
      "Failed to save private notes."
    );
  }
}
