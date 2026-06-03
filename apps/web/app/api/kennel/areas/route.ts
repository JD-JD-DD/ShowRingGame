import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

const MAX_AREA_NAME_LENGTH = 60;

function normalizeAreaName(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const areas = await db.kennelArea.findMany({
      where: { kennelId: kennel.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
    });

    return ok({ areas });
  } catch (error) {
    console.error("GET /api/kennel/areas failed:", error);
    return fail("Unable to load kennel areas.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const body = (await request.json()) as { name?: unknown };
    const name = normalizeAreaName(body.name);

    if (name.length < 2) {
      return fail("Area name must be at least 2 characters.", 400);
    }

    if (name.length > MAX_AREA_NAME_LENGTH) {
      return fail(
        `Area name cannot exceed ${MAX_AREA_NAME_LENGTH} characters.`,
        400
      );
    }

    const nextSortOrder = await db.kennelArea.count({
      where: { kennelId: kennel.id },
    });

    const area = await db.kennelArea.create({
      data: {
        kennelId: kennel.id,
        name,
        sortOrder: nextSortOrder,
      },
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
    });

    return ok({ area });
  } catch (error) {
    console.error("POST /api/kennel/areas failed:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail("You already have a kennel area with that name.", 409);
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to create kennel area.",
      },
      { status: 500 }
    );
  }
}
