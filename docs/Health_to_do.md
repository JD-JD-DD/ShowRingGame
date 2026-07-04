# Health Modifier / Visible Category / Judging Fix List

## Core design rules to preserve

Health effects must exist before health testing. Health testing reveals or explains a condition; it must not be the first time the condition affects the dog.

Stored genetic traits must remain immutable. Health modifiers apply to expressed phenotype only.

Breeding inheritance must continue to use stored genetic traits, not health-adjusted expressed traits.

Judges must evaluate the dog’s current expressed phenotype, including hidden health effects.

Hidden health truth data must remain server-side only and must not be exposed through DTOs, API responses, show results, or UI unless a health test has legitimately revealed the player-facing result.

Yellow/red health effects must never improve the affected trait. Trait-level health penalties must push the affected component farther from 10 ideal.

For public category displays, players should see consistent numbers everywhere.

Conditioning & Handling is separate: it is a 0–10 optimized scale, not a 0–20 directional category.

---

# Issue 1 — Hidden health truths may not exist until health testing

## Problem

Legacy dogs may be missing `DogHealthConditionTruth` rows.

Running a phenotype health test currently calls `ensurePhenotypeHealthTruthsForDogs`.

That means, for a legacy dog, health testing can create hidden truth rows for the first time. After the redirect, visible categories may suddenly apply health modifiers that were not applied before the test.

This makes it look like the test changed the dog’s stats.

## Correct behavior

Hidden phenotype health truths should exist before the dog is displayed, judged, or tested.

Health testing should reveal the result, not create the first effective modifier.

## Surfaces affected

* Dog profile visible category display
* Shared dog visible-category helper/display surfaces
* Judging: breed judging
* Judging: group judging
* Judging: Best in Show judging
* Health test routes can keep defensive ensure behavior, but should not be the first normal creation point

## Needed fix

Add narrow, idempotent server-side ensure behavior before visible category display and before judging.

Do not expose hidden truth rows.

Do not charge money.

Do not create ledger entries.

Do not create notices.

Do not change category math.

---

# Issue 2 — Judging must ensure hidden health truths before scoring

## Problem

Judging currently loads existing `healthConditionTruths` and passes them into the rules engine.

For dogs that have hidden truth rows, judging uses:

stored traits → hidden health truth → expressed traits → judging categories → scoring

That is correct.

The gap is that judging does not appear to call `ensurePhenotypeHealthTruthsForDogs` before scoring. Legacy dogs missing truth rows may be judged without hidden health effects.

## Correct behavior

Before scoring any dog, judging should ensure hidden phenotype health truths exist server-side.

This applies to:

* breed judging entries
* group finalists
* Best in Show finalists

## Needed fix

Add bounded ensure calls for the dogs being judged before loading/passing health truth data into the judging pipeline.

Do not change scoring math.

Do not expose hidden data in results.

---

# Issue 3 — Visible category aggregation uses raw averaging

## Problem

Public visible categories and judging categories currently raw-average directional component values.

Example:

A dog with one component over ideal and another under ideal can average to 10, falsely appearing ideal.

Health modifiers may correctly push an affected component trait farther from 10, but the raw averaged visible category can move closer to 10 if the affected component is on the opposite side of the category average.

This makes a yellow/red health condition appear to improve a public category.

## Current affected categories

Type & Expression:

* head
* size
* show_shine

Structure & Balance:

* forequarters
* hindquarters
* topline
* feet

Movement:

* gait
* hindquarters
* forequarters

Coat & Presentation:

* coat
* show_shine

Temperament & Ring Behavior:

* temperament
* show_shine

Conditioning & Handling is separate and should remain 0–10 optimized.

## Needed design decision

Public 0–20 directional categories should probably aggregate distance from ideal, not raw values.

Likely approach:

* compute each component’s signed deviation from 10
* average absolute deviation
* determine direction from signed deviations
* display 10 ± average absolute deviation
* clamp 0–20
* use deterministic tie-breaks when over/under faults exactly cancel

## Impact

This will affect public visible category values and future judging outcomes because judging uses the same category aggregation shape.

This should be a separate rules-layer change with tests.

---

# Issue 4 — Health modifier tests need stronger regression coverage

## Existing coverage

Current tests prove trait-level push-away behavior and some category cases.

## Missing coverage

Need tests proving:

* hidden health effects apply before reveal
* running a health test does not change visible categories by creating truth rows for the first time
* judging ensures health truths before scoring
* Cardiac does not affect visible categories
* Thyroid does not directly affect visible categories
* CAER affects temperament/ring behavior only
* HIP affects hindquarters-related expression
* ELBOW affects forequarters-related expression
* stored trait fields are not mutated
* hidden truth rows are not exposed
* if category-level guarantee is adopted, non-green health effects cannot move affected visible categories closer to 10

---

# Issue 5 — Display consistency was already addressed, but should be protected

## Current status

A shared server-side helper now makes normal dog category displays use:

stored traits → health-adjusted expressed traits → visible categories

This was applied to:

* dog profile
* litter puppies
* kennel dog list / mine API
* market listings
* foundation listings
* stud listings
* breeding planner cards
* program planner cards
* breeding-attempt sire/dam category displays

## Remaining protection needed

Regression tests should continue to guard that these surfaces do not drift back to raw stored-trait category display.

---

# Recommended implementation order

1. Ensure hidden health truths exist before dog profile/display calculations.
2. Ensure hidden health truths exist before judging.
3. Audit/regression pass for hidden truth availability.
4. Change visible category aggregation from raw average to deviation-from-ideal aggregation.
5. Update rules/judging/presentation tests for new aggregation.
6. Audit public category displays and judging after aggregation change.
7. Optional browser/manual QA on dog profile, litter, market, studs, program planner, and show results.
