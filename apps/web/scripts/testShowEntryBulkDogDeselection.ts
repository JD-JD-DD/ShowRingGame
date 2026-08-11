import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getBulkDogSelectionState,
  setBulkDogSelection,
} from "../app/shows/[showId]/ShowEntryPlanner";

const eligibleSelectionKeys = new Set([
  "dog-a:friday",
  "dog-a:saturday",
  "dog-a:sunday",
  "dog-b:friday",
]);

let selected: Record<string, boolean> = {
  "dog-a:friday": true,
  "dog-a:saturday": true,
  "dog-a:sunday": true,
  "dog-b:friday": true,
};

const fullySelected = getBulkDogSelectionState({
  dogId: "dog-a",
  eligibleSelectionKeys,
  selected,
});
assert.equal(fullySelected.selectedDayCount, 3);
assert.equal(fullySelected.eligibleDayCount, 3);
assert.equal(fullySelected.isFullySelected, true);

selected = setBulkDogSelection({
  current: selected,
  eligibleKeys: fullySelected.eligibleKeys,
  isSelected: false,
});
assert.deepEqual(
  Object.entries(selected)
    .filter(([, isSelected]) => isSelected)
    .map(([key]) => key),
  ["dog-b:friday"],
  "deselecting a dog removes every eligible dog-day pair while retaining other dogs"
);

selected["dog-a:saturday"] = true;
const partiallySelected = getBulkDogSelectionState({
  dogId: "dog-a",
  eligibleSelectionKeys,
  selected,
});
assert.equal(partiallySelected.selectedDayCount, 1);
assert.equal(partiallySelected.isPartiallySelected, true);

selected = setBulkDogSelection({
  current: selected,
  eligibleKeys: partiallySelected.eligibleKeys,
  isSelected: true,
});
assert.equal(
  getBulkDogSelectionState({ dogId: "dog-a", eligibleSelectionKeys, selected })
    .isFullySelected,
  true,
  "a partially selected dog can be reselected for every eligible day"
);

const root = process.cwd().endsWith(`${join("apps", "web")}`)
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const planner = readFileSync(
  join(root, "apps/web/app/shows/[showId]/ShowEntryPlanner.tsx"),
  "utf8"
);

assert.ok(planner.includes("Deselect dog"));
assert.ok(planner.includes("Select all eligible days"));
assert.ok(planner.includes("Selected for {dogSelection.selectedDayCount}"));
assert.ok(planner.includes("buildQuote(bulkSelectedPairs)"));
assert.ok(planner.includes('name="dogDaySelections"'));

console.log("Show-entry bulk dog deselection checks passed.");
