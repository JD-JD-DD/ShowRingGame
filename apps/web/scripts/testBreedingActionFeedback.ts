import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  getBreedingEligibilityMessage,
  getIndividualBreedingEligibility,
} from "../server/services/breedingEligibility.service";

import {
  MIN_BREED_AGE_HOURS,
  WHELPING_COOLDOWN_HOURS,
} from "@showring/rules";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const currentEpoch = 10_000;
const adultBirthEpoch = currentEpoch - MIN_BREED_AGE_HOURS - 12;
const coolingLastWhelpedEpoch = currentEpoch - WHELPING_COOLDOWN_HOURS + 5;

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(sourceText: string, needle: string, label: string) {
  assert.ok(sourceText.includes(needle), label);
}

const breedActionButtonSource = source(
  "apps/web/components/dogs/BreedDogActionButton.tsx"
);
const dogPageSource = source("apps/web/app/dogs/[dogId]/page.tsx");
const plannerPageSource = source(
  "apps/web/components/breeding/BreedingPlannerPage.tsx"
);
const plannerClientSource = source(
  "apps/web/components/breeding/BreedPageClient.tsx"
);

assertIncludes(
  dogPageSource,
  '<BreedDogActionButton',
  "Dog Page uses the interactive BreedDogActionButton component"
);
assertIncludes(
  dogPageSource,
  'breedHref={`/breed?dogId=${header.dogId}`}',
  "eligible Dog Page Breed action still points to /breed?dogId={dogId}"
);
assertIncludes(
  dogPageSource,
  "unavailableMessage={actions.breedingDisabledReason ?? null}",
  "Dog Page passes the shared breeding eligibility message into the action button"
);

assertIncludes(
  breedActionButtonSource,
  "aria-disabled={!canBreed || isPending}",
  "ineligible Dog Page action stays operable without the native disabled attribute"
);
assertIncludes(
  breedActionButtonSource,
  "aria-busy={canBreed ? isPending : undefined}",
  "eligible Dog Page action exposes immediate busy semantics while routing"
);
assert.equal(
  /\sdisabled=/.test(breedActionButtonSource),
  false,
  "BreedDogActionButton does not use the native disabled attribute"
);
assertIncludes(
  breedActionButtonSource,
  'role="status"',
  "ineligible Dog Page action exposes accessible status semantics"
);
assertIncludes(
  breedActionButtonSource,
  'router.push(breedHref)',
  "eligible Dog Page Breed action still navigates to the breeding planner"
);
assertIncludes(
  breedActionButtonSource,
  'Loading breeding options...',
  "eligible Dog Page Breed action shows immediate loading feedback"
);
assertIncludes(
  breedActionButtonSource,
  'setNoticeMessage(unavailableMessage ?? "This dog is not available for breeding.")',
  "ineligible Dog Page action uses the shared message or a safe fallback"
);

const coolingDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  lastWhelpedEpoch: coolingLastWhelpedEpoch,
});
assert.equal(
  getBreedingEligibilityMessage(coolingDam),
  "This bitch is resting after a litter. Available to breed in 5 hours.",
  "post-whelp cooldown shared message includes the countdown notice"
);

const initiatedDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  activeBreedingAttemptStatus: "INITIATED",
});
assert.equal(
  getBreedingEligibilityMessage(initiatedDam),
  "Pregnancy confirmation is pending.",
  "INITIATED attempts produce the shared pregnancy-confirmation notice"
);

const pregnantDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  activeBreedingAttemptStatus: "PREGNANT",
});
assert.equal(
  getBreedingEligibilityMessage(pregnantDam),
  "This bitch is pregnant.",
  "PREGNANT attempts produce the shared pregnancy notice"
);

const underageDog = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: currentEpoch - MIN_BREED_AGE_HOURS + 1,
  lifecycleState: "ALIVE",
  sex: "F",
});
assert.equal(
  getBreedingEligibilityMessage(underageDog),
  "This dog is too young to breed.",
  "underage dogs produce the shared underage notice"
);

assertIncludes(
  plannerPageSource,
  "formatDogDisplayName(requestedOwnedDog)",
  "breed page notice identifies the ineligible owned dog"
);
assertIncludes(
  plannerPageSource,
  'experience === "breed-dog"',
  "direct breeding route remains a distinct experience within the shared page"
);
assertIncludes(
  plannerPageSource,
  '? "/breed" : "/plan-a-litter"',
  "direct breeding route emits route-specific timing instrumentation"
);
assertIncludes(
  plannerPageSource,
  'operation: "selected_dog_lookup"',
  "direct breeding route times the selected dog lookup stage"
);
assertIncludes(
  plannerPageSource,
  '"owned_mate_query"',
  "direct breeding route times the owned mate candidate query stage"
);
assertIncludes(
  plannerPageSource,
  'operation: "public_stud_listing_query"',
  "direct breeding route times the public stud listing query stage"
);
assertIncludes(
  plannerPageSource,
  'operation: "pedigree_query"',
  "direct breeding route times the pedigree stage"
);
assertIncludes(
  plannerPageSource,
  "directRouteOptimized",
  "direct breeding route reports whether the optimized path ran"
);
assertIncludes(
  plannerPageSource,
  "selectedDogId: dog.id",
  "direct breeding route keeps the originating owned dog id in the optimized path"
);
assertIncludes(
  plannerPageSource,
  'message: `${formatDogDisplayName(requestedOwnedDog)} is not available to breed right now. ${requestedOwnedDog.breedingEligibilityMessage ?? ""}`.trim()',
  "breed page reuses the specific shared ineligible message"
);
assertIncludes(
  plannerPageSource,
  'message: "This dog is not available for breeding."',
  "breed page uses the safe generic notice for invalid or unauthorized dog ids"
);
assertIncludes(
  plannerPageSource,
  'message: "This stud is not available for breeding."',
  "breed page uses the safe generic notice for invalid stud ids"
);
assert.equal(
  plannerPageSource.includes('redirect("/kennel")'),
  false,
  "breed page no longer silently redirects to /kennel for unavailable selections"
);

assertIncludes(
  plannerClientSource,
  "dog.id === initialDogId &&",
  "eligible owned dog ids are still considered for planner preselection"
);
assertIncludes(
  plannerClientSource,
  "dog.isOwnedByCurrentKennel &&",
  "planner preselection keeps ownership protections intact"
);
assertIncludes(
  plannerClientSource,
  "dog.isEligibleToBreed",
  "planner does not preselect an ineligible dog"
);
assertIncludes(
  plannerClientSource,
  "const [plannerNotice, setPlannerNotice] = useState(initialNotice);",
  "breed page carries the initial planner notice into client state"
);
assertIncludes(
  plannerClientSource,
  'const selectingDams = anchorDog.sex === "M";',
  "male-owned direct breeding still routes into the compatible-dam flow"
);
assertIncludes(
  plannerClientSource,
  'Only dogs currently eligible for this breeding are shown.',
  "direct breeding flow still shows only eligible mates"
);
assertIncludes(
  plannerClientSource,
  'role={plannerNotice.tone === "error" ? "alert" : "status"}',
  "breed page notice uses accessible alert/status semantics"
);
assertIncludes(
  plannerClientSource,
  'setErrorMessage(data?.error ?? "Breeding could not be created.");',
  "server validation errors remain visible in the breeding planner"
);
assertIncludes(
  plannerClientSource,
  "if (!response.ok || !data?.ok) {",
  "breeding planner handles validation failures without redirecting"
);

const breedLoadingSource = source("apps/web/app/breed/loading.tsx");
assertIncludes(
  breedLoadingSource,
  'Loading breeding options...',
  "direct breeding route exposes a route-level loading state"
);

const planALitterPageSource = source("apps/web/app/plan-a-litter/page.tsx");
assertIncludes(
  planALitterPageSource,
  'experience="worksheet"',
  "Plan A Litter remains on the separate worksheet experience"
);

console.log("Breeding action feedback checks passed.");
