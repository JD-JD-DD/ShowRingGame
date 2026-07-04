import { strict as assert } from "node:assert";

import { aggregateDirectionalCategory } from "./index";

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

console.log("Visible category aggregation checks passed.");
