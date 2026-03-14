import { ok, fail } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
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
      typeof (body as any).breedCode2 === "string"
        ? (body as any).breedCode2.trim()
        : null;

    if (!breedCode2) {
      return fail("breedCode2 is required.", 400);
    }

    const count =
      typeof (body as any).count === "number"
        ? (body as any).count
        : 10;

    const currentEpoch = getCurrentEpoch();

    await seedFoundationDogsForBreed({
      breedCode2,
      currentEpoch,
      count,
    });

    return ok({
      message: "Foundation dogs seeded.",
      breedCode2,
      count,
      currentEpoch,
    });
  } catch (error) {
    console.error("POST /api/debug/foundation-seed failed", error);
    return fail("Unable to seed foundation dogs.", 500);
  }
}
