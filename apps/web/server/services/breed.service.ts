import { db } from "@/lib/db";
import { CURRENT_BREED_RELEASE } from "@showring/rules";

export async function getReleasedBreedCodes(): Promise<string[]> {
  const breeds: Array<{ code2: string }> = await db.breed.findMany({
    where: {
      releaseVersion: {
        lte: CURRENT_BREED_RELEASE,
      },
    },
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
    select: {
      code2: true,
    },
  });

  return breeds.map((breed) => breed.code2);
}
