import { strict as assert } from "node:assert";

import {
  aggregateDirectionalCategory,
  deriveVisibleCategoriesFromTraits,
  type DogTraits,
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

console.log("Visible category aggregation checks passed.");
