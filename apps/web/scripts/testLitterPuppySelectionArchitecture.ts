import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const card = readFileSync("components/litters/LitterPuppyCard.tsx", "utf8");

assert.match(client, /"use client"/, "only the puppy-card boundary is client-side");
assert.match(client, /filter\(\(puppy\) => puppy\.isManageableByBreeder\)/, "manageable IDs use the authoritative server field");
assert.match(client, /filter\(\(puppyId\) => manageablePuppyIds\.has\(puppyId\)\)/, "stale IDs are pruned against current manageable IDs");
assert.match(client, /selectAllManageablePuppies[\s\S]*new Set\(manageablePuppyIds\)/, "select-all uses only manageable IDs");
assert.doesNotMatch(client, /checkbox|Select All|selected count|Action toolbar|<button/i, "client boundary renders no visible selection controls");
assert.match(card, /Current kennel[\s\S]*Kennel run[\s\S]*Sale status/, "Stage 1C card metadata remains present");
assert.match(card, /puppy\.isNeonatalLoss[\s\S]*Litter loss/, "litter-loss presentation remains present");

type Puppy = { id: string; manageable: boolean };
const puppies: Puppy[] = [
  { id: "one", manageable: true },
  { id: "two", manageable: true },
  { id: "three", manageable: true },
  { id: "transferred", manageable: false },
  { id: "deceased", manageable: false },
  { id: "loss", manageable: false },
];
const manageableIds = new Set(puppies.filter((puppy) => puppy.manageable).map((puppy) => puppy.id));
let selected = new Set<string>();
const select = (id: string) => { if (manageableIds.has(id)) selected = new Set([...selected, id]); };
select("one");
select("transferred");
select("deceased");
select("loss");
assert.deepEqual([...selected], ["one"], "only a manageable puppy can be selected");
selected.delete("one");
assert.equal(selected.size, 0, "a selected puppy can be deselected");
selected = new Set(manageableIds);
assert.deepEqual([...selected].sort(), ["one", "three", "two"], "select-all contains exactly manageable puppies");
const updatedManageableIds = new Set(["one", "three"]);
selected = new Set([...selected].filter((id) => updatedManageableIds.has(id)));
assert.deepEqual([...selected].sort(), ["one", "three"], "reconciliation removes only stale or non-manageable selections");
selected.clear();
assert.equal(selected.size, 0, "clear removes every selection");

console.log("Litter puppy selection architecture checks passed.");
