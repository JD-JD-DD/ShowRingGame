import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const page = readFileSync("app/litters/[litterId]/page.tsx", "utf8");

assert.match(page, /function marketStateLabel\(marketState: string\): string \| null/, "card keeps market-state labeling local");
assert.match(page, /case "LISTED_PLAYER":[\s\S]*case "LISTED_NPC":[\s\S]*return "Listed for sale"/, "listed dogs receive a concise sale label");
assert.match(page, /case "SOLD_PENDING_TRANSFER":[\s\S]*return "Sale pending transfer"/, "pending transfers receive a clear sale label");
assert.match(page, /Current kennel[\s\S]*puppy\.currentOwnerKennel\.name/, "normal cards render the current kennel");
assert.match(page, /Kennel run[\s\S]*puppy\.kennelRun\.name/, "normal cards render an assigned kennel run");
assert.match(page, /href=\{`\/dogs\/\$\{puppy\.dogId\}`\}/, "normal cards retain a focused Dog Page link");
assert.match(page, /puppy\.isNeonatalLoss \? \([\s\S]*Litter loss[\s\S]*\) : \([\s\S]*puppy\.currentOwnerKennel/, "litter-loss cards remain separate from current-dog metadata");
assert.doesNotMatch(page, /"use client"|type="checkbox"|Select All|selectedDogIds|Action toolbar/, "card remains server-rendered without selection UI");

console.log("Litter detail card presentation checks passed.");
