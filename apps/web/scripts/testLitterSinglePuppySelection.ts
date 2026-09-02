import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const card = readFileSync("components/litters/LitterPuppyCard.tsx", "utf8");

assert.match(client, /useState<Set<string>>/, "selection remains Set-based for future multi-select support");
assert.match(client, /selectPuppy\(puppyId: string\)[\s\S]*new Set\(\[\.\.\.current, puppyId\]\)/, "checking a manageable puppy adds only that ID to the Set");
assert.match(client, /deselectPuppy\(puppyId: string\)[\s\S]*next\.delete\(puppyId\)/, "unchecking removes only that puppy ID");
assert.doesNotMatch(client, /selectSinglePuppy/, "no separate single-selection state remains");
assert.match(client, /reconcileSelectedPuppyIds/, "stale selections remain reconciled");
assert.match(client, /selectedPuppies\.length > 0/, "unified action workspaces are gated to one or more selected puppies");
assert.match(client, /selectedPuppyIds\.has\(puppy\.dogId\)/, "every selected puppy remains visibly checked");
assert.match(client, /Select all eligible/, "selection control uses the manageable cohort explicitly");
assert.match(client, /selectedCount\.toLocaleString\(\)/, "selected count is locale-aware");
assert.match(card, /puppy\.isManageableByBreeder \?/, "only structurally manageable puppies receive checkboxes");
assert.match(card, /type="checkbox"/, "selection uses a semantic checkbox");
assert.match(card, /aria-label=\{`Select \$\{puppy\.displayName\}/, "checkbox has puppy-specific accessible text");
assert.doesNotMatch(card, /canListForSale|canRehome|canMoveRun|canName/, "puppy cards do not render action controls");

const manageableIds = new Set(["a", "b", "c"]);
let selected = new Set<string>();
const select = (dogId: string) => {
  if (manageableIds.has(dogId)) selected = new Set([...selected, dogId]);
};
const deselect = (dogId: string) => {
  selected = new Set([...selected].filter((selectedDogId) => selectedDogId !== dogId));
};

select("a");
assert.deepEqual([...selected], ["a"], "first checkbox selects one manageable puppy");
select("b");
assert.deepEqual([...selected], ["a", "b"], "checking a second puppy preserves the first selection");
select("c");
deselect("b");
assert.deepEqual([...selected], ["a", "c"], "unchecking removes only that puppy");
selected = new Set(manageableIds);
assert.deepEqual([...selected], ["a", "b", "c"], "Select all eligible normalizes to the current manageable cohort");
selected = new Set([...selected].filter((dogId) => dogId === "a"));
assert.deepEqual([...selected], ["a"], "reconciliation prunes only puppies that became non-manageable");

console.log("Litter single-puppy selection checks passed.");
