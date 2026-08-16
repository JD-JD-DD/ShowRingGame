import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  normalizeBreedJudgingProfile,
  parseBreedJudgingProfilesCsv,
  parseCanonicalBreedsCsv,
  validateBreedJudgingProfileCoverage,
} from "../server/services/breedJudgingProfile.service";

const data = (file: string) => readFileSync(resolve(process.cwd(), `prisma/data/${file}`), "utf8");
const weights = ["headWeight", "forequartersWeight", "hindquartersWeight", "gaitWeight", "coatWeight", "sizeWeight", "temperamentWeight", "showShineWeight", "feetWeight", "toplineWeight"] as const;

function profileWeights(profile: ReturnType<typeof parseBreedJudgingProfilesCsv>[number]) {
  return weights.map((key) => profile[key]);
}

function main() {
  const canonicalBreeds = parseCanonicalBreedsCsv(data("breeds.csv"));
  const profiles = validateBreedJudgingProfileCoverage({
    canonicalBreeds,
    profiles: parseBreedJudgingProfilesCsv(data("JUDGE-01_Breed_Judging_Profile.csv")),
  });
  assert.equal(canonicalBreeds.length, 318, "current canonical breed count");
  assert.equal(profiles.length, 318, "current judging profile count");
  assert.equal(new Set(profiles.map((profile) => profile.breedCode2)).size, 318, "profile codes are unique");
  assert.deepEqual([...new Set(profiles.map((profile) => profile.rulesVersion))], ["breed-judging-v1"], "current file uses the canonical rules version");
  assert.deepEqual([...new Set(profiles.map((profile) => profile.isActive))], [true], "current file contains active profiles");

  const reviewed: Record<string, number[]> = {
    "South Russian Ovcharka": [10, 10, 10, 12, 16, 11, 11, 3, 5, 12],
    "Halden Hound": [11, 12, 12, 16, 9, 11, 7, 3, 8, 11],
    Kuvasz: [13, 10, 10, 13, 11, 10, 11, 5, 7, 10],
    "Swedish Vallhund": [9, 11, 11, 13, 11, 9, 12, 5, 8, 11],
    "Tosa Inu": [14, 12, 12, 14, 5, 10, 14, 2, 6, 11],
  };
  for (const [breed, expected] of Object.entries(reviewed)) {
    const profile = profiles.find((row) => row.breed === breed);
    assert.ok(profile, `${breed} profile exists`);
    assert.deepEqual(profileWeights(profile), expected, `${breed} agreed weights`);
    assert.equal(profileWeights(profile).reduce((sum, value) => sum + value, 0), 100, `${breed} totals 100`);
  }

  const normalized = normalizeBreedJudgingProfile(profiles[0]);
  assert.ok(Math.abs(weights.reduce((sum, key) => sum + normalized[key], 0) - 1) < 1e-12, "normalization occurs after validation and totals 1");
  const firstRow = data("JUDGE-01_Breed_Judging_Profile.csv").split(/\r?\n/)[1];
  assert.throws(() => parseBreedJudgingProfilesCsv(`${data("JUDGE-01_Breed_Judging_Profile.csv").split(/\r?\n/)[0]}\n${firstRow.replace(/,10\.00,b/, ",9.00,b")}`), /total|numeric/, "materially invalid totals are rejected rather than normalized");
  assert.throws(() => parseBreedJudgingProfilesCsv("Breed,breedCode2,Group,Suggested %\nX,XX,G,1/2/3"), /missing required header|packed Suggested/, "packed Suggested % fields are rejected");
  console.log("Breed judging profile CSV checks passed.");
}

main();
