import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const page = source("apps/web/app/stud-contracts/requests/page.tsx");
const presentation = source("apps/web/lib/studOfferPresentation.ts");

for (const fragment of [
  'status: "PENDING"', "sireKennelId: kennel.id",
  "healthRequirements: true", "latestAttemptBySireId",
  "getIndividualBreedingEligibility", "approvalDeadlineAt",
  "formatRealDuration", "View Dam", "View Stud",
]) assert.ok(page.includes(fragment), fragment);
assert.equal(page.includes("sourceOffer"), false, "uses immutable contract terms, not the current offer");
assert.equal(page.includes("studContract.update"), false, "display page does not mutate requests");
assert.ok(presentation.includes('if (requirement.requirementLevel === "NONE") return []'));
console.log("Stud Contract pending requests checks passed.");
