import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const page = readFileSync("app/litters/[litterId]/page.tsx", "utf8");
const card = readFileSync("components/litters/LitterPuppyCard.tsx", "utf8");

assert.match(page, /LitterPuppyCardsClient litterId=\{litter\.litterId\} puppies=\{litter\.puppies\}/, "server page supplies litter context and the existing puppy DTOs to the narrow client boundary");
assert.match(card, /function marketStateLabel\(marketState: string\): string \| null/, "card keeps market-state labeling local");
assert.match(card, /case "LISTED_PLAYER":[\s\S]*case "LISTED_NPC":[\s\S]*return "Listed for sale"/, "listed dogs receive a concise sale label");
assert.match(card, /case "SOLD_PENDING_TRANSFER":[\s\S]*return "Sale pending transfer"/, "pending transfers receive a clear sale label");
assert.match(card, /Current kennel[\s\S]*puppy\.currentOwnerKennel\.name/, "normal cards render the current kennel");
assert.match(card, /Kennel run[\s\S]*puppy\.kennelRun\.name/, "normal cards render an assigned kennel run");
assert.match(card, /href=\{`\/dogs\/\$\{puppy\.dogId\}`\}/, "normal cards retain a focused Dog Page link");
assert.match(card, /puppy\.isNeonatalLoss \? \([\s\S]*Litter loss[\s\S]*\) : \([\s\S]*puppy\.currentOwnerKennel/, "litter-loss cards remain separate from current-dog metadata");
assert.match(card, /puppy\.isManageableByBreeder \?[\s\S]*type="checkbox"/, "presentation card keeps the established manageable-puppy selection affordance");
assert.doesNotMatch(card, /"use client"|Select All|selectedDogIds|Action toolbar|canName/, "presentation card owns no shared action controls");

console.log("Litter detail card presentation checks passed.");
