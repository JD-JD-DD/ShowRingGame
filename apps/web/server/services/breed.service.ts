import { db } from "@/lib/db";
import { CURRENT_BREED_RELEASE } from "../../../../packages/rules/constants/release.constants";

export async function getReleasedBreedCodes(): Promise<string[]> {
  const breeds = await db.breed.findMany({
    where: {
      isActive: true,
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