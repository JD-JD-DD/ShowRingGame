import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const disclosures = read("apps/web/lib/studContractDisclosures.ts");
const worksheet = read("apps/web/components/stud-contract/StudOfferWorksheet.tsx");
const studContractPage = read("apps/web/app/stud-contract/page.tsx");
const automatic = read("apps/web/components/stud-contract/AutomaticStudContractConfirmation.tsx");
const manual = read("apps/web/components/stud-contract/ManualStudContractRequest.tsx");
const automaticRoute = read("apps/web/app/api/stud-contracts/automatic/route.ts");
const manualRoute = read("apps/web/app/api/stud-contracts/manual/route.ts");
for (const fragment of ["60 real days", "same sire and dam", "temporary unavailability", "later returns", "not required to keep the sire continuously available", "original stud compensation is not charged again", "Player decisions—including selling a contracted dog"]) assert.ok(disclosures.includes(fragment), fragment);
for (const source of [automatic, manual]) { assert.ok(source.includes('type="checkbox"')); assert.ok(source.includes("playerObligationsAcknowledged")); assert.ok(source.includes("PLAYER_OBLIGATIONS_LABEL")); }
for (const source of [automaticRoute, manualRoute]) { assert.ok(source.includes("body.playerObligationsAcknowledged !== true")); assert.ok(source.includes("PLAYER_OBLIGATIONS_ERROR")); }
assert.ok(worksheet.includes("puppies born alive at whelping"));
assert.ok(studContractPage.includes("puppies born alive at whelping"));
assert.equal(worksheet.includes("Week 1 neonatal mortality window"), false);
assert.equal(worksheet.includes("surviving puppies at the contract's litter-qualification checkpoint"), false);
assert.equal(studContractPage.includes("Week 1 neonatal window"), false);
console.log("Stud Contract disclosure and acknowledgment checks passed.");
