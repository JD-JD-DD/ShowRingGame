import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const listCards = readFileSync("components/litters/LitterCards.tsx", "utf8");
const listPage = readFileSync("app/litters/page.tsx", "utf8");
const detailPage = readFileSync("app/litters/[litterId]/page.tsx", "utf8");
const litterService = readFileSync("server/services/litter.service.ts", "utf8");
const breedingService = readFileSync("server/services/breeding.service.ts", "utf8");

assert.match(listCards, /href=\{`\/dogs\/\$\{puppy\.dogId\}`\}/);
assert.match(listCards, /href=\{`\/dogs\/\$\{litter\.dam\.dogId\}`\}/);
assert.match(listCards, /href=\{`\/dogs\/\$\{litter\.sire\.dogId\}`\}/);
assert.match(listCards, /formatShowCalendarLabel\(litter\.bornEpoch\)/);
assert.match(listCards, /focus-visible:outline/);
assert.doesNotMatch(listCards, /visibilityState/);

assert.match(detailPage, /href=\{`\/kennels\/\$\{litter\.bredByKennel\.slug\}`\}/);
assert.match(detailPage, /formatShowCalendarLabel\(litter\.bornEpoch\)/);
assert.match(detailPage, /focus-visible:outline/);

assert.match(litterService, /take: 4/);
assert.match(
  breedingService,
  /reproductiveEmergencyStatus: attempt\.reproductiveEmergency\?\.status \?\? null/
);
assert.match(listPage, /Pregnancy not yet confirmed/);
assert.match(listPage, /Pregnancy confirmed/);
assert.match(listPage, /Reproductive emergency — care decision required/);
assert.match(listPage, /attempt\.reproductiveEmergencyStatus === "PENDING"/);
assert.match(listPage, /href=\{`\/dogs\/\$\{attempt\.damId\}#whelping-emergency`\}/);
assert.match(listPage, /focus-visible:outline/);

console.log("Litter navigation and progression checks passed.");
