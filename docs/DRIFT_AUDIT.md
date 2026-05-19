# Drift Audit

Source of truth: `docs/MasterFile4_3.md`

Started: 2026-05-19

Purpose: track where the implemented program matches the master plan, where it intentionally has MVP gaps, where it has drifted, and where the current implementation may be better than the old plan.

## Status Legend

- **Aligned**: current code matches the master plan.
- **Intentional MVP gap**: missing or simplified, but acceptable for now.
- **Drift**: current code contradicts the master plan.
- **Current code may be better**: worth discussing before changing.
- **Needs decision**: the master file or code intent is ambiguous.

## Audit Order

1. Visible Trait / Ring Category Display System
2. Foundation Dog Market
3. Dog Lifecycle
4. Breeding and Litters
5. Judging and Shows
6. Economy
7. Prisma Schema and Naming
8. Services and API
9. Player Pages and UI Visibility

---

# 1. Visible Trait / Ring Category Display System

Master-file anchors:

- `MasterFile4_3.md`, "Visible Trait / Ring Category Display System"
- `MasterFile4_3.md`, "Canonical Short Rule Lock"
- `MasterFile4_3.md`, "Canonical Formula Lock"
- `MasterFile4_3.md`, "Explicit Forbidden Formula Lock"

Canonical intent:

- Hidden raw traits are stored on a 0-20 scale.
- 10 is ideal.
- Values below 10 mean under ideal.
- Values above 10 mean over ideal.
- Player-visible ring categories must preserve side-of-ideal.
- Player-visible category display must not collapse into `10 - abs(value - 10)` or any equivalent directionless closeness score.
- Visible categories should be derived from mapped hidden traits via `CATEGORY_TRAIT_MAP`.
- Recommended first-pass display is average mapped traits, rounded to 1 decimal, clamped to 0-20.
- Players should see visible category scores and some scale/bars/markers showing 10 as ideal.
- Players should not see hidden raw traits, exact inheritance math, or exact weighting formulas.

## 1.1 Constants and Category Mapping

Status: **Aligned**

Evidence:

- `packages/rules/constants/genetics.constants.ts`
  - Defines `TRAIT_MIN = 0`, `TRAIT_MAX = 20`, and `TRAIT_IDEAL = 10`.
  - Defines the ten hidden trait keys: `head`, `forequarters`, `hindquarters`, `gait`, `coat`, `size`, `temperament`, `show_shine`, `feet`, `topline`.
- `packages/rules/constants/judging.constants.ts`
  - Defines six judging / visible category buckets:
    - `TYPE_EXPRESSION`
    - `STRUCTURE_BALANCE`
    - `MOVEMENT`
    - `COAT_PRESENTATION`
    - `TEMPERAMENT_RING_BEHAVIOR`
    - `CONDITIONING_HANDLING`
  - Defines `CATEGORY_TRAIT_MAP`.

Notes:

- The master file names `showShine`; the code uses `show_shine`. This is consistent with the existing engine/database convention, and the mapper functions bridge it cleanly. I do not consider this drift.
- The code does not define separate `VISIBLE_CATEGORY_MIN`, `VISIBLE_CATEGORY_IDEAL`, or `VISIBLE_CATEGORY_MAX` constants. It reuses trait constants and hardcoded UI defaults. This is acceptable for now, but a future cleanup could add explicit visible-category constants for readability.

Recommendation:

- No immediate change required.
- Optional cleanup: add explicit visible category constants if we want the code to mirror the master file vocabulary more directly.

## 1.2 Visible Category Derivation

Status: **Aligned**

Evidence:

- `packages/rules/engines/foundationDog.engine.ts`
  - `deriveVisibleCategoriesFromTraits()` iterates over `JUDGING_CATEGORIES`.
  - It looks up mapped traits via `CATEGORY_TRAIT_MAP`.
  - It averages the mapped hidden trait values.
  - It rounds to 1 decimal with `toFixed(1)`.
  - It does not apply `10 - abs(value - 10)` or another directionless closeness transformation.

Assessment:

- This is very close to the master-file base algorithm:

```ts
visibleCategory = clamp(
  0,
  20,
  round1(average(mappedHiddenTraits))
)
```

- Since source traits are already constrained to 0-20, the lack of an explicit clamp in `deriveVisibleCategoriesFromTraits()` is not currently dangerous.

Recommendation:

- Keep this derivation as the canonical visible category helper.
- Optional hardening: add an explicit clamp so the helper remains safe if future inputs ever include decimals, training modifiers, or breed display weights.

## 1.3 Raw Trait Visibility

Status: **Mostly aligned**

Evidence:

- API and service layers generally convert raw trait fields into `visibleCategories` before returning data:
  - `apps/web/app/api/dogs/mine/route.ts`
  - `apps/web/server/services/foundationDog.service.ts`
  - `apps/web/server/mappers/litter.mapper.ts`
- Dog pages and market pages render visible category values, not raw trait fields.
- Server components do query raw trait fields, but they derive visible categories server-side and render only derived display values.

Assessment:

- This matches the master file's anti-spreadsheet rule in the player-facing UI.
- Because server components can select raw fields without sending them as JSON, this is acceptable.

Potential concern:

- We should continue checking API routes as they are added. Any JSON endpoint that returns `traitHead`, `traitForequarters`, etc. to the browser would be drift.

Recommendation:

- No immediate change required.
- Add a later audit item for API response review across all dog/market/litter endpoints.

## 1.4 UI Display Semantics

Status: **Mostly aligned, with a small UI gap**

Evidence:

- `apps/web/components/ui/TraitLine.tsx`
  - Shows the numeric category value.
  - Uses a 0-20 line.
  - Places a visible tick at ideal 10.
  - Places the dog value left or right of ideal, preserving side-of-ideal visually.
- Dog and market pages use `TraitLine`.

Assessment:

- This is strongly aligned with the master file's UI rule that players should see a 0-20 scale and 10 clearly marked as ideal.

Gap:

- `apps/web/components/kennel/KennelDogsPanel.tsx` uses compact numeric `StatCell` values instead of bars/markers.
- `StatCell` preserves side-of-ideal because it shows the number, but its color uses distance from 10. That means 8 and 12 get similar color treatment.

This is not full drift because the value itself is still visible. It is a compact table view, not the main evaluator UI. But it is a weaker expression of the master plan than `TraitLine`.

Recommendation:

- Keep as-is for now if the kennel table is meant to be dense and sortable.
- Later improvement: add a tiny side-of-ideal indicator in table cells, such as a left/right marker, `Under`, `Ideal`, `Over`, or a small 0-20 mini-track.

## 1.5 Foundation Dog Pricing Uses Higher-Is-Better

Status: **Resolved in code**

Evidence:

- `packages/rules/engines/foundationDog.engine.ts`
  - Previous implementation computed `visibleAverage` and used:

```ts
const scoreAdjustment = Math.round((visibleAverage - 10) * PRICE_STEP * 2);
```

  - Current implementation uses `averageIdealScore()` from `packages/rules/engines/idealScoring.engine.ts`.

Assessment:

- The previous logic treated visible values above 10 as more valuable and values below 10 as less valuable.
- That conflicted with the master-file rule that 10 is ideal and values above 10 are "over ideal", not automatically better.
- The current logic prices by ideal-centered quality while still displaying directional visible categories to players.

Recommendation:

- Keep this separation:
  - visible category values are directional player-facing phenotype signals
  - ideal score is algorithmic quality for pricing/scoring
- Future tuning may adjust price coefficients, but should not return to raw higher-is-better visible average pricing.

## 1.6 Foundation Candidate Filtering Uses Higher-Is-Better Language

Status: **Resolved in code / needs future tuning**

Evidence:

- `packages/rules/engines/foundationDog.engine.ts`
  - Previous implementation used `strongVisibleCategoryCount`, `collapsedVisibleCategoryCount`, and candidate fallback scoring based partly on `visibleAverage`.
  - Current implementation uses:
    - `countValuesNearIdeal()`
    - `averageIdealScore()`
    - `averageIdealDistance()`
    - `scoreValueAgainstIdeal()`
    - `allValuesExactlyIdeal()`

Assessment:

- The higher-is-better language and fallback scoring have been replaced with ideal-centered scoring.
- Foundation candidates now reject exactly all-ideal trait sets.
- Foundation generation still rejects suspiciously clean dogs and severe faults.

Recommendation:

- Tune thresholds after sampling generated foundation markets.
- Watch for too many "pretty good" dogs if the new near-ideal threshold is too permissive.
- Watch for too many rough dogs if the severe fault threshold is too strict.

## 1.7 Judging Engine Treats Higher Category Scores As Better

Status: **Resolved in code / high priority for tuning**

Evidence:

- `packages/rules/engines/judging.engine.ts`
  - `deriveShowCharacteristicsFromTraits()` averages mapped traits, preserving directional 0-20 values.
  - Previous implementation multiplied the raw characteristic by judge weight and added it directly to `baseScore`.
  - Current implementation converts each characteristic through `scoreValueAgainstIdeal()` before applying judge weights.
  - `rankDogsByJudgeWeights()` sorts by descending `baseScore`.

Assessment:

- Under the master file, 10 is ideal and both under-ideal and over-ideal should matter directionally.
- The previous judging scoring made 20 better than 10, which contradicted the 10-ideal premise.
- Current judging scoring rewards closeness to ideal while preserving raw directional `characteristics` in the breakdown.

Recommendation:

- During the Judging System audit, tune whether judging should:
  - score closeness to ideal,
  - use breed-specific ideal targets,
  - penalize under/over differently by breed,
  - include controlled randomness,
  - include breed essential traits.

My current recommendation is to keep this ideal-centered core and layer breed/judge nuance on top later.

## 1.8 Overall Verdict

Status: **Visible display is mostly aligned; downstream interpretation has drift**

What is working:

- The hidden trait scale matches the plan.
- The category map exists and is used.
- The visible category derivation preserves side-of-ideal.
- The main dog/market UI shows visible values without exposing raw hidden traits.
- `TraitLine` is a good implementation of the intended display concept.

Main drift found and addressed:

- Foundation dog pricing treats values above 10 as better.
- Foundation dog candidate scoring partly treats higher visible averages as better.
- Judging currently treats higher category values as better.

Decision made:

- Is 10 truly the universal ideal across genetics, market desirability, and judging?
- Yes. The rules package now has shared ideal-centered scoring helpers and foundation/judging use them.

Recommended next audit section:

- Foundation Dog Market, because the most immediate drift discovered here lives in foundation generation and pricing.
