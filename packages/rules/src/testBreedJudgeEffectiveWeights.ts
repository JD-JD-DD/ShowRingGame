import assert from "node:assert/strict";

import {
  FIXED_CONFORMATION_BUDGET,
  combineBreedAndJudgeConformationWeights,
  judgeBreedBlock,
  type BreedConformationCategoryWeights,
  type Dog,
  type Judge,
} from "../engines/index";

const categories = ["TYPE_EXPRESSION", "STRUCTURE_BALANCE", "MOVEMENT", "COAT_PRESENTATION", "TEMPERAMENT_RING_BEHAVIOR"] as const;
const close = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 1e-10, `${label}: expected ${expected}, got ${actual}`);
const total = (weights: BreedConformationCategoryWeights) => categories.reduce((sum, category) => sum + weights[category], 0);
const breed = (values: Partial<BreedConformationCategoryWeights> = {}): BreedConformationCategoryWeights => ({ TYPE_EXPRESSION: .2, STRUCTURE_BALANCE: .2, MOVEMENT: .2, COAT_PRESENTATION: .2, TEMPERAMENT_RING_BEHAVIOR: .2, ...values });
const judge = (values: Partial<BreedConformationCategoryWeights> = {}): BreedConformationCategoryWeights => ({ TYPE_EXPRESSION: 1, STRUCTURE_BALANCE: 1, MOVEMENT: 1, COAT_PRESENTATION: 1, TEMPERAMENT_RING_BEHAVIOR: 1, ...values });

const dog: Dog = {
  dogId: "dog-1", regNumber: "SRG-1", breedCode2: "AA", birthEpoch: 0, sex: "M", status: "ALIVE",
  litterId: null, litterOrder: null, sireId: null, damId: null,
  traits: { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 },
};
const engineJudge: Judge = {
  judgeId: "judge-1", name: "Judge", style: "BALANCED",
  categoryWeights: { ...judge(), CONDITIONING_HANDLING: 1.17 },
};

function main() {
  assert.equal(FIXED_CONFORMATION_BUDGET, 5, "five current 1.0 conformation categories establish the fixed 5.0 budget");
  const neutral = combineBreedAndJudgeConformationWeights({ breedWeights: breed(), judgeWeights: judge() });
  categories.forEach((category) => close(neutral[category], 1, `balanced breed + neutral judge ${category}`));

  const breedOnly = combineBreedAndJudgeConformationWeights({ breedWeights: breed({ TYPE_EXPRESSION: .3, STRUCTURE_BALANCE: .2, MOVEMENT: .1, COAT_PRESENTATION: .2, TEMPERAMENT_RING_BEHAVIOR: .2 }), judgeWeights: judge() });
  close(breedOnly.TYPE_EXPRESSION, 1.5, "breed-only Type emphasis"); close(breedOnly.MOVEMENT, .5, "breed-only Movement reduction");
  const movementJudge = combineBreedAndJudgeConformationWeights({ breedWeights: breed(), judgeWeights: judge({ MOVEMENT: 1.25, TYPE_EXPRESSION: .75 }) });
  assert.ok(movementJudge.MOVEMENT > movementJudge.TYPE_EXPRESSION, "judge individuality survives normalization");
  const interaction = combineBreedAndJudgeConformationWeights({ breedWeights: breed({ MOVEMENT: .4, TYPE_EXPRESSION: .1, STRUCTURE_BALANCE: .15, COAT_PRESENTATION: .2, TEMPERAMENT_RING_BEHAVIOR: .15 }), judgeWeights: judge({ MOVEMENT: 1.25, TYPE_EXPRESSION: .75 }) });
  assert.ok(interaction.MOVEMENT > breedOnly.MOVEMENT, "multiplication compounds breed and judge movement emphasis");
  assert.notDeepEqual(interaction, movementJudge, "breed profile remains meaningful under the same judge");
  close(total(interaction), 5, "effective conformation budget is preserved");
  assert.equal("CONDITIONING_HANDLING" in interaction, false, "conditioning cannot leak into conformation normalization");
  assert.equal(engineJudge.categoryWeights.CONDITIONING_HANDLING, 1.17, "conditioning judge preference is unchanged");

  const neutralResult = judgeBreedBlock({ entries: [{ showEntryId: "entry-1", dog }], judge: engineJudge, conformationCategoryWeights: neutral, random01: () => .5 }).results[0];
  const interactionResult = judgeBreedBlock({ entries: [{ showEntryId: "entry-1", dog }], judge: engineJudge, conformationCategoryWeights: interaction, random01: () => .5 }).results[0];
  close(neutralResult.baseScore, interactionResult.baseScore, "equal category quality preserves total score scale");
  close(neutralResult.weightedCategoryScores.CONDITIONING_HANDLING, interactionResult.weightedCategoryScores.CONDITIONING_HANDLING, "breed emphasis leaves conditioning contribution unchanged");
  console.log("Breed × judge effective-conformation checks passed.");
}

main();
