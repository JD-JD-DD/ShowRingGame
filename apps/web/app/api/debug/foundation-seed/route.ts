import { ok, fail } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { db } from "@/lib/db";
import { seedFoundationDogsForBreed } from "@/server/services/foundationDog.service";

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return fail("Debug routes disabled in production.", 403);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail("Request body must be valid JSON.", 400);
    }

    const breedCode2 =
      typeof body === "object" &&
      body !== null &&
      typeof (body as { breedCode2?: unknown }).breedCode2 === "string"
        ? (body as { breedCode2: string }).breedCode2.trim().toUpperCase()
        : null;

    if (!breedCode2) {
      return fail("breedCode2 is required.", 400);
    }

    const countRaw =
      typeof body === "object" && body !== null
        ? (body as { count?: unknown }).count
        : undefined;

    const count =
      typeof countRaw === "number" &&
      Number.isInteger(countRaw) &&
      countRaw > 0
        ? countRaw
        : 10;

    const breed = await db.breed.findUnique({
      where: { code2: breedCode2 },
      select: { code2: true, name: true, isActive: true },
    });

    if (!breed) {
      return fail(`Breed ${breedCode2} does not exist.`, 404);
    }

    const currentEpoch = getCurrentEpoch();

    await seedFoundationDogsForBreed({
      breedCode2,
      currentEpoch,
      count,
    });

    return ok({
      message: "Foundation dogs seeded.",
      breedCode2,
      breedName: breed.name,
      count,
      currentEpoch,
    });
  } catch (error) {
    console.error("POST /api/debug/foundation-seed failed", error);
    return fail("Unable to seed foundation dogs.", 500);
  }
}

