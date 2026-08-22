import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const route = source("apps/web/app/dogs/[dogId]/stud-contract/page.tsx");
const worksheet = source(
  "apps/web/components/stud-contract/StudOfferWorksheet.tsx"
);
const damSideRoute = source("apps/web/app/stud-contract/page.tsx");

assert.ok(route.includes('redirect("/login")'));
assert.ok(route.includes('redirect("/onboarding")'));
assert.ok(route.includes("ownerKennelId: kennel.id"));
assert.ok(route.includes("if (!dog) notFound()"));
assert.ok(route.includes("<StudOfferWorksheet"));
assert.ok(route.includes("dogName={dogName}"));
assert.ok(route.includes("applicableHealthTests={applicableHealthTests}"));
assert.equal(route.includes("StudOffer"), true, "route names the UI component only");
assert.ok(route.includes("getCurrentPublishedStudOfferForOwnedDog"), "route loads the current offer through the focused service");

assert.ok(worksheet.startsWith('"use client"'));
assert.ok(worksheet.includes("type EditableStudOfferTerms"));
assert.ok(worksheet.includes("hasPuppyBack"));
assert.ok(worksheet.includes("normalizeStudOfferTermsAfterChange"));
assert.ok(worksheet.includes("function updateTerm("));
assert.ok(worksheet.includes("setTerms((previousTerms) =>"));
assert.ok(worksheet.includes("const [terms, setTerms] = useState<EditableStudOfferTerms>"));
assert.ok(worksheet.includes("compensationType: null,"));
assert.ok(worksheet.includes("puppyPickPosition: null,"));
assert.ok(worksheet.includes("approvalMode: null,"));
assert.ok(worksheet.includes("titleRequirement: null,"));

for (const step of [
  "Compensation",
  "Puppy-Back Terms",
  "Return Service",
  "Dam Requirements",
  "Approval",
  "Review & Publish",
]) {
  assert.ok(worksheet.includes(`name: "${step}"`), `worksheet includes ${step}`);
}
assert.ok(
  worksheet.includes('step.id !== "puppy-back" || hasPuppyBack(terms.compensationType)'),
  "cash-only step sequence omits Puppy-Back Terms through the shared helper"
);
assert.ok(worksheet.includes("Step {currentStepIndex + 1} of {activeSteps.length}"));
assert.ok(worksheet.includes("function goBack()"));
assert.ok(worksheet.includes("function goNext()"));
assert.ok(worksheet.includes("function revisitStep(index: number)"));
assert.ok(worksheet.includes("if (index <= furthestReachedStepIndex)"));
assert.ok(worksheet.includes("adjustIndexAfterPuppyBackRemoval"));

assert.ok(worksheet.includes('aria-current={isCurrent ? "step" : undefined}'));
assert.ok(worksheet.includes('aria-label="Stud offer worksheet progress"'));
assert.ok(worksheet.includes("<h1 id=\"stud-offer-worksheet-title\""));
assert.ok(worksheet.includes("type=\"button\""));
assert.ok(worksheet.includes("focus-visible:outline"));
assert.ok(worksheet.includes("const canPublish"));
assert.ok(worksheet.includes("fetch(`/api/dogs/${sireIdentity.dogId}/stud-offer`"));
assert.equal(worksheet.includes("localStorage"), false);
assert.equal(worksheet.includes("sessionStorage"), false);
assert.equal(worksheet.includes("db."), false);

assert.ok(damSideRoute.includes("Stud Contract Terms"));
assert.equal(damSideRoute.includes("StudOfferWorksheet"), false);

console.log("Stud offer worksheet shell checks passed.");
