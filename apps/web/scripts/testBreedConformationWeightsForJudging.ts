import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { combineBreedAndJudgeConformationWeights } from "@showring/rules";

import { getBreedConformationWeightsForJudging, InvalidActiveBreedJudgingProfileError } from "../server/services/breedConformationWeightsForJudging.service";
import { parseBreedJudgingProfilesCsv } from "../server/services/breedJudgingProfile.service";
import { AmbiguousActiveBreedJudgingProfileError, MissingBreedJudgingProfileError } from "../server/services/breedJudgingProfilePersistence.service";

const profiles = parseBreedJudgingProfilesCsv(readFileSync(resolve(process.cwd(), "prisma/data/JUDGE-01_Breed_Judging_Profile.csv"), "utf8"));
const byName = (name: string) => { const profile = profiles.find((candidate) => candidate.breed === name); assert.ok(profile, `${name} profile exists`); return profile; };
const clientFor = (rows: unknown[]) => ({ breedJudgingProfile: { findMany: async () => rows } });
const total = (weights: Record<string, number>) => ["TYPE_EXPRESSION", "STRUCTURE_BALANCE", "MOVEMENT", "COAT_PRESENTATION", "TEMPERAMENT_RING_BEHAVIOR"].reduce((sum, category) => sum + weights[category], 0);

async function main() {
  const names = ["South Russian Ovcharka", "Halden Hound", "Kuvasz", "Swedish Vallhund", "Tosa Inu"];
  const outputs = await Promise.all(names.map(async (name) => getBreedConformationWeightsForJudging({ client: clientFor([{ ...byName(name), isActive: true }]) as never, breedCode2: byName(name).breedCode2 })));
  outputs.forEach((weights, index) => { assert.ok(Math.abs(total(weights) - 1) < 1e-10, `${names[index]} uses JUDGE-03 normalized five-category output`); });
  assert.ok(outputs[1].MOVEMENT > outputs[0].MOVEMENT, "reviewed Halden profile carries more Movement emphasis than South Russian profile");
  const effective = combineBreedAndJudgeConformationWeights({ breedWeights: outputs[1], judgeWeights: { TYPE_EXPRESSION: 1, STRUCTURE_BALANCE: 1, MOVEMENT: 1.25, COAT_PRESENTATION: 1, TEMPERAMENT_RING_BEHAVIOR: 1 } });
  assert.ok(Math.abs(total(effective) - 5) < 1e-10, "live boundary feeds fixed-budget effective scoring weights");
  await assert.rejects(() => getBreedConformationWeightsForJudging({ client: clientFor([]) as never, breedCode2: "ZZ" }), MissingBreedJudgingProfileError, "missing active profile fails explicitly");
  await assert.rejects(() => getBreedConformationWeightsForJudging({ client: clientFor([{ ...byName(names[0]), isActive: true }, { ...byName(names[0]), rulesVersion: "v2", isActive: true }]) as never, breedCode2: byName(names[0]).breedCode2 }), AmbiguousActiveBreedJudgingProfileError, "ambiguous active profiles fail explicitly");
  await assert.rejects(() => getBreedConformationWeightsForJudging({ client: clientFor([{ ...byName(names[0]), headWeight: 99, isActive: true }]) as never, breedCode2: byName(names[0]).breedCode2 }), InvalidActiveBreedJudgingProfileError, "invalid persisted profile fails explicitly");
  console.log("Persisted breed conformation judging-boundary checks passed.");
}

void main();
