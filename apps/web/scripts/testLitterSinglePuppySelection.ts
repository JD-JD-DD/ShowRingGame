import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const card = readFileSync("components/litters/LitterPuppyCard.tsx", "utf8");

assert.match(client, /useState<Set<string>>/, "selection remains Set-based for future multi-select support");
assert.match(client, /selectSinglePuppy[\s\S]*new Set\(\[puppyId\]\)/, "visible selection replaces prior selection with one puppy");
assert.match(client, /reconcileSelectedPuppyIds/, "stale selections remain reconciled");
assert.match(client, /selectedPuppyId/, "only one selected puppy drives the shared action seam");
assert.match(client, /1 puppy selected/, "single-selection status is concise");
assert.doesNotMatch(client, /Select All|selectAllManageablePuppies\}/, "no bulk Select All control is visible");
assert.match(card, /puppy\.isManageableByBreeder \?/, "only structurally manageable puppies receive checkboxes");
assert.match(card, /type="checkbox"/, "selection uses a semantic checkbox");
assert.match(card, /aria-label=\{`Select Puppy/, "checkbox has puppy-specific accessible text");
assert.doesNotMatch(card, /canListForSale|canRehome|canMoveRun|canName/, "puppy cards do not render action controls");
assert.doesNotMatch(client, /Put Up for Sale|Re-home/, "future action buttons remain absent until functional");

console.log("Litter single-puppy selection checks passed.");
