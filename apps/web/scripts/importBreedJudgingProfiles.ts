import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { db } from "@/lib/db";
import { parseBreedJudgingProfilesCsv, parseCanonicalBreedsCsv, validateBreedJudgingProfileCoverage } from "@/server/services/breedJudgingProfile.service";
import { syncValidatedBreedJudgingProfiles } from "@/server/services/breedJudgingProfilePersistence.service";

async function main() {
  const data = (file: string) => readFileSync(resolve(process.cwd(), `prisma/data/${file}`), "utf8");
  const profiles = validateBreedJudgingProfileCoverage({
    canonicalBreeds: parseCanonicalBreedsCsv(data("breeds.csv")),
    profiles: parseBreedJudgingProfilesCsv(data("JUDGE-01_Breed_Judging_Profile.csv")),
  });
  const result = await syncValidatedBreedJudgingProfiles({ database: db, profiles });
  console.log("Breed judging profiles imported.", result);
}

void main().finally(() => db.$disconnect());
