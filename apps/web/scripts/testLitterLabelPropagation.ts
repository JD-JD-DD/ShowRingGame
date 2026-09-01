import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import { getLitterDisplayName } from "../lib/litterDisplayName";

const detailEditor = readFileSync("components/litters/LitterMetadataEditor.tsx", "utf8");
const litterCards = readFileSync("components/litters/LitterCards.tsx", "utf8");
const littersPage = readFileSync("app/litters/page.tsx", "utf8");
const puppyCards = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const puppyCard = readFileSync("components/litters/LitterPuppyCard.tsx", "utf8");
const litterService = readFileSync("server/services/litter.service.ts", "utf8");
const breeding = readFileSync("server/services/breeding.service.ts", "utf8");

assert.equal(getLitterDisplayName("C Litter", "6258828"), "C Litter", "named litter uses custom name as primary label");
assert.equal(getLitterDisplayName(null, "6258828"), "Serial 6258828", "unnamed litter uses serial as primary label");

assert.match(detailEditor, /getLitterDisplayName\(customName, serial7\)/, "Litter Record retains the shared primary-label helper");
assert.match(detailEditor, /customName \? \([\s\S]*Serial \{serial7\}/, "Litter Record retains named-litter serial secondary text");
assert.match(litterCards, /getLitterDisplayName\(litter\.customName, litter\.serial7\)/, "LitterCards use the shared helper");
assert.match(litterCards, /litter\.customName \? \([\s\S]*Serial \{litter\.serial7\}/, "named LitterCards show serial secondarily");
assert.match(litterCards, /href=\{`\/litters\/\$\{litter\.litterId\}`\}/, "LitterCards retain id-based routing");
assert.match(littersPage, /getLitterDisplayName\(selection\.litter\.customName, selection\.litter\.serial7\)/, "stud-contract heading uses shared helper");
assert.match(littersPage, /selection\.litter\.customName \? \([\s\S]*Serial \{selection\.litter\.serial7\}/, "named stud-contract heading shows serial secondarily");
assert.doesNotMatch(littersPage, /Litter \{selection\.litter\.customName\}/, "stud-contract does not prepend Litter to custom names");
for (const source of [litterCards, littersPage, puppyCards, puppyCard]) {
  assert.doesNotMatch(source, /breederNote/, "private breeder notes are not propagated");
}
assert.match(litterService, /serial7: \{ contains: search, mode: "insensitive" \}/, "serial search remains unchanged");
assert.match(breeding, /body: `Litter \$\{persistedLitter\.serial7\} has been born/, "historical litter-born notice remains serial-first");

console.log("Litter label propagation checks passed.");
