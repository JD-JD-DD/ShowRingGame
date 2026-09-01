import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildDogPageUrl, redirectToDogPageWithField } from "@/lib/dogPageRedirect";
import { getSessionUserId } from "@/lib/session";
import {
  DogNamingError,
  updateDogNaming,
} from "@/server/services/dogNaming.service";

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

    const formData = await request.formData();

    await updateDogNaming({
      kennelId: kennel.id,
      dogId,
      registeredName: formData.get("registeredName"),
    });

    return NextResponse.redirect(buildDogPageUrl(request, dogId));
  } catch (error) {
    if (error instanceof DogNamingError) {
      if (error.status === 400 || error.status === 409) {
        return redirectToDogPageWithField(request, dogId, "nameError", error.message);
      }

      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/dogs/[dogId]/rename failed:", error);

    return NextResponse.json({ error: "Failed to rename dog." }, { status: 500 });
  }
}
