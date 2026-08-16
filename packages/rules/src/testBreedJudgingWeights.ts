import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { deriveBreedConformationCategoryWeights, deriveRawBreedConformationCategoryWeights, type NormalizedBreedTraitWeights } from "../engines/breedJudgingWeight.engine";

const traits = ["head", "forequarters", "hindquarters", "gait", "coat", "size", "temperament", "show_shine", "feet", "topline"] as const;
const categories = ["TYPE_EXPRESSION", "STRUCTURE_BALANCE", "MOVEMENT", "COAT_PRESENTATION", "TEMPERAMENT_RING_BEHAVIOR"] as const;
const close = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 1e-10, `${label}: expected ${expected}, got ${actual}`);
const profile = (values: Partial<NormalizedBreedTraitWeights>): NormalizedBreedTraitWeights => Object.fromEntries(traits.map((trait) => [trait, values[trait] ?? 0])) as NormalizedBreedTraitWeights;
const total = (weights: Record<string, number>) => Object.values(weights).reduce((sum, value) => sum + value, 0);

function main() {
  const equal = profile(Object.fromEntries(traits.map((trait) => [trait, 0.1])));
  const rawEqual = deriveRawBreedConformationCategoryWeights(equal);
  close(rawEqual.TYPE_EXPRESSION, 7 / 30, "equal traits Type"); close(rawEqual.STRUCTURE_BALANCE, 0.3, "equal traits Structure"); close(rawEqual.MOVEMENT, 0.2, "equal traits Movement"); close(rawEqual.COAT_PRESENTATION, 2 / 15, "equal traits Coat"); close(rawEqual.TEMPERAMENT_RING_BEHAVIOR, 2 / 15, "equal traits Temperament"); close(total(rawEqual), 1, "raw conservation");

  const oneTrait = (trait: keyof NormalizedBreedTraitWeights) => deriveBreedConformationCategoryWeights(profile({ [trait]: 1 }));
  for (const trait of ["forequarters", "hindquarters"] as const) { const result = oneTrait(trait); close(result.STRUCTURE_BALANCE, .5, `${trait} structure split`); close(result.MOVEMENT, .5, `${trait} movement split`); }
  const shine = oneTrait("show_shine"); close(shine.TYPE_EXPRESSION, 1 / 3, "Show Shine Type split"); close(shine.COAT_PRESENTATION, 1 / 3, "Show Shine Coat split"); close(shine.TEMPERAMENT_RING_BEHAVIOR, 1 / 3, "Show Shine Temperament split"); assert.equal("CONDITIONING_HANDLING" in shine, false, "Conditioning & Handling receives no breed conformation allocation");
  for (const [trait, category] of [["head", "TYPE_EXPRESSION"], ["gait", "MOVEMENT"], ["coat", "COAT_PRESENTATION"], ["temperament", "TEMPERAMENT_RING_BEHAVIOR"], ["feet", "STRUCTURE_BALANCE"], ["topline", "STRUCTURE_BALANCE"]] as const) close(oneTrait(trait)[category], 1, `${trait} is wholly allocated to ${category}`);
  assert.throws(() => deriveBreedConformationCategoryWeights(profile({ head: Number.NaN, forequarters: 1 })), /finite/); assert.throws(() => deriveBreedConformationCategoryWeights(profile({ head: -1, forequarters: 2 })), />= 0/); assert.throws(() => deriveBreedConformationCategoryWeights(profile({ head: .9 })), /total 1.0/);

  const csv = readFileSync(resolve(process.cwd(), "apps/web/prisma/data/JUDGE-01_Breed_Judging_Profile.csv"), "utf8").trim().split(/\r?\n/); const headers = csv[0].split(",");
  const index = (header: string) => headers.indexOf(header); const inputFor = (breed: string) => { const row = csv.slice(1).map((line) => line.split(",")).find((fields) => fields[index("Breed")] === breed); assert.ok(row, `${breed} exists`); return profile({ head: Number(row[index("HeadWeight")]) / 100, forequarters: Number(row[index("ForequartersWeight")]) / 100, hindquarters: Number(row[index("HindquartersWeight")]) / 100, gait: Number(row[index("GaitWeight")]) / 100, coat: Number(row[index("CoatWeight")]) / 100, size: Number(row[index("SizeWeight")]) / 100, temperament: Number(row[index("TemperamentWeight")]) / 100, show_shine: Number(row[index("ShowShineWeight")]) / 100, feet: Number(row[index("FeetWeight")]) / 100, topline: Number(row[index("ToplineWeight")]) / 100 }); };
  const breeds = ["South Russian Ovcharka", "Halden Hound", "Kuvasz", "Swedish Vallhund", "Tosa Inu"];
  const outputs = breeds.map((breed) => deriveBreedConformationCategoryWeights(inputFor(breed)));
  outputs.forEach((output, index) => { categories.forEach((category) => assert.ok(Number.isFinite(output[category]) && output[category] >= 0, `${breeds[index]} ${category} is valid`)); close(total(output), 1, `${breeds[index]} normalized total`); });
  assert.ok(outputs[1].MOVEMENT > outputs[0].MOVEMENT, "gait/structure-heavier Halden Hound has more movement emphasis than South Russian Ovcharka");
  assert.deepEqual(deriveBreedConformationCategoryWeights(equal), deriveBreedConformationCategoryWeights(equal), "calculation is deterministic");
  console.log("Breed judging conformation-weight checks passed.");
}

main();
