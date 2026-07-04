import { strict as assert } from "node:assert";

import {
  aggregateDirectionalCategory,
  DEFAULT_CATEGORY_WEIGHTS,
  deriveShowCharacteristicsFromTraits,
  deriveVisibleCategoriesFromTraits,
  scoreDogByJudgeWeights,
  type Dog,
  type DogTraits,
  type Judge,
} from "./index";

function assertClose(actual: number, expected: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) < 0.0001,
    `${label}: expected ${expected}, got ${actual}`
  );
}

assertClose(
  aggregateDirectionalCategory([10, 10, 10]),
  10,
  "all ideal values return ideal"
);

assertClose(
  aggregateDirectionalCategory([6, 8]),
  7,
  "all under-ideal values return below ideal"
);

assertClose(
  aggregateDirectionalCategory([12, 16]),
  14,
  "all over-ideal values return above ideal"
);

assert.notEqual(
  aggregateDirectionalCategory([7, 13]),
  10,
  "mixed faults do not raw-average back to ideal"
);

assertClose(
  aggregateDirectionalCategory([8, 12]),
  8,
  "tie uses first largest deviation direction when first component is under ideal"
);

assertClose(
  aggregateDirectionalCategory([12, 8]),
  12,
  "tie uses first largest deviation direction when first component is over ideal"
);

assertClose(
  aggregateDirectionalCategory([6, 10, 12]),
  8,
  "unequal mixed faults use signed sum direction"
);

assertClose(
  aggregateDirectionalCategory([-5, 0]),
  0,
  "output clamps to minimum"
);

assertClose(
  aggregateDirectionalCategory([20, 25]),
  20,
  "output clamps to maximum"
);

assertClose(
  aggregateDirectionalCategory([6, 10, 14]),
  10 - 8 / 3,
  "average absolute deviation is used instead of raw average"
);

const idealTraits: DogTraits = {
  head: 10,
  forequarters: 10,
  hindquarters: 10,
  gait: 10,
  coat: 10,
  size: 10,
  temperament: 10,
  show_shine: 10,
  feet: 10,
  topline: 10,
};

assertClose(
  deriveVisibleCategoriesFromTraits({
    ...idealTraits,
    head: 7,
    size: 13,
  }).typeExpression,
  8,
  "public visible categories do not raw-average mixed faults back to ideal"
);

assertClose(
  deriveVisibleCategoriesFromTraits({
    ...idealTraits,
    coat: 8,
    show_shine: 12,
  }).coatPresentation,
  8,
  "public visible category tie uses first largest under-ideal component"
);

assertClose(
  deriveVisibleCategoriesFromTraits({
    ...idealTraits,
    coat: 12,
    show_shine: 8,
  }).coatPresentation,
  12,
  "public visible category tie uses first largest over-ideal component"
);

assertClose(
  deriveVisibleCategoriesFromTraits({
    ...idealTraits,
    gait: 8,
  }).movement,
  9.3,
  "public visible category rounding remains one decimal"
);

assertClose(
  deriveVisibleCategoriesFromTraits({
    ...idealTraits,
    coat: 8,
    show_shine: 12,
  }).conditioningHandling,
  0,
  "conditioning handling remains separate from directional aggregation"
);

const mixedMovementUnderTraits: DogTraits = {
  ...idealTraits,
  gait: 8,
  hindquarters: 12,
};
const mixedMovementOverTraits: DogTraits = {
  ...idealTraits,
  gait: 12,
  hindquarters: 8,
};
const mixedMovementVisible = deriveVisibleCategoriesFromTraits(
  mixedMovementUnderTraits
);
const mixedMovementJudging = deriveShowCharacteristicsFromTraits(
  mixedMovementUnderTraits
);

assertClose(
  mixedMovementJudging.MOVEMENT,
  8.67,
  "judging categories do not raw-average mixed faults back to ideal"
);

assertClose(
  deriveShowCharacteristicsFromTraits(mixedMovementOverTraits).MOVEMENT,
  11.33,
  "judging category tie uses first largest over-ideal component"
);

assert.equal(
  Math.sign(mixedMovementVisible.movement - 10),
  Math.sign(mixedMovementJudging.MOVEMENT - 10),
  "public visible and judging aggregation agree in direction"
);

const judge: Judge = {
  judgeId: "aggregation-test-judge",
  name: "Aggregation Test Judge",
  style: "BALANCED",
  categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS },
};
const dog: Dog = {
  dogId: "aggregation-test-dog",
  regNumber: "AGG-1",
  breedCode2: "TST",
  birthEpoch: 0,
  sex: "M",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    ...idealTraits,
    head: 20,
    forequarters: 20,
    hindquarters: 20,
    gait: 20,
    coat: 20,
    size: 20,
    temperament: 20,
    show_shine: 20,
    feet: 20,
    topline: 20,
  },
  presentation: {
    conditioningSnapshot: 8,
    fatigueSnapshot: 2,
  },
};

assertClose(
  scoreDogByJudgeWeights({
    dog,
    judge,
    random01: () => 0.5,
  }).characteristics.CONDITIONING_HANDLING,
  6,
  "judging conditioning handling remains derived from conditioning inputs"
);

console.log("Visible category aggregation checks passed.");
