import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const breeds = await db.breed.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { groupName: "asc" },
        { name: "asc" },
      ],
      select: {
        code2: true,
        name: true,
        groupName: true,
      },
    });

    return ok({ breeds });
  } catch (error) {
    console.error("GET /api/breeds/catalog failed", error);
    return fail("Unable to load breed catalog.", 500);
  }
}