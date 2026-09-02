import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const card = readFileSync("components/litters/LitterPuppyCard.tsx", "utf8");
const name = readFileSync("components/litters/LitterPuppyNameWorkspace.tsx", "utf8");
const move = readFileSync("components/litters/LitterPuppyKennelRunWorkspace.tsx", "utf8");
const sale = readFileSync("components/litters/LitterPuppySaleWorkspace.tsx", "utf8");
const rehome = readFileSync("components/litters/LitterPuppyRehomeWorkspace.tsx", "utf8");

assert.doesNotMatch(client, /singleEligiblePuppy|selectedPuppies\[0\]|selectedPuppyId\b/, "unified actions retain no residual single-puppy client assumption");
assert.match(client, /function clearActionResults/, "completed action results have one replacement lifecycle");
assert.match(client, /setNamingResult\(result\)[\s\S]*setKennelRunResult\(result\)[\s\S]*setSaleResult\(result\)[\s\S]*setRehomeResult\(result\)/, "each unified action retains parent-owned completion state");
assert.match(client, /rehomeResult[\s\S]*selectedPuppies\.length > 0/, "Re-home result remains outside the selection-gated action area");
assert.match(client, /pluralizePuppies\(selectionState\.selectedCount\).*selected/, "selected count remains locale-aware and grammatical");

assert.match(card, /aria-label=\{`Select \$\{puppy\.displayName\}, \$\{puppy\.regNumber\}`\}/, "manageable checkboxes have a unique puppy identity label");
assert.match(card, /puppy\.isManageableByBreeder \?/, "historical puppies remain checkbox-free");

assert.match(name, /aria-label=\{`Call name for \$\{puppy\.displayName\}, \$\{puppy\.regNumber\}`\}/, "call-name inputs have unique accessible names");
assert.match(name, /aria-label=\{`Registered name for \$\{puppy\.displayName\}, \$\{puppy\.regNumber\}`\}/, "registered-name inputs have unique accessible names");
assert.match(name, /Confirm and Save[\s\S]*focus-visible:outline/, "naming confirmation controls retain focus visibility");
assert.match(move, /htmlFor="litter-puppy-destination-run"[\s\S]*id="litter-puppy-destination-run"/, "Move destination has a connected semantic label");
assert.match(move, /Already in \{selectedRun\.name\}/, "same-target skip reason is readable text");
assert.match(sale, /Sell All For price/, "common sale price input has an accessible name");
assert.match(sale, /Apply to All[\s\S]*focus-visible:outline/, "Apply to All retains focus visibility");
assert.match(sale, /Asking price for \$\{puppy\.displayName\}, \$\{puppy\.regNumber\}/, "per-puppy asking prices have unique accessible names");
assert.match(rehome, /<ul[\s\S]*eligiblePuppies\.map/, "Re-home affected puppies use a semantic list");
assert.match(rehome, /<ul[\s\S]*skippedPuppies\.map/, "Re-home skipped puppies use a semantic list");
assert.match(rehome, /Confirm Re-home \$\{pluralizePuppies/, "Re-home confirmation pluralizes safely");

for (const source of [name, move, sale, rehome]) {
  assert.match(source, /role="alert"/, "workspace errors remain semantic alerts");
  assert.match(source, /focus-visible:outline/, "workspace controls retain visible focus");
  assert.doesNotMatch(source, /modal|popover|drawer|confirm\(/i, "workspace remains inline without browser confirmation");
}

console.log("Litter puppy workspace accessibility checks passed.");
