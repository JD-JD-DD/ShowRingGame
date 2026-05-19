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

---

# 2. Foundation Dog Market

Master-file anchors:

- `MasterFile4_3.md`, "Foundation Dog Market Rules"
- `MasterFile4_3.md`, "Competitive Level"
- `MasterFile4_3.md`, "Hidden Trait Generation Rule"
- `MasterFile4_3.md`, "Better Generation Shape"
- `MasterFile4_3.md`, "Hard Anti-Elite Rule"
- `MasterFile4_3.md`, "Hard Anti-Junk Rule"
- `MasterFile4_3.md`, "Tiered Foundation Quality Bands"
- `MasterFile4_3.md`, "Price Relationship"
- `MasterFile4_3.md`, "Dog Page"
- `MasterFile4_3.md`, "Age"
- `MasterFile4_3.md`, "Fallback When Breed Has Little or No Existing Population"
- `MasterFile4_3.md`, "Recommended Engine/Service Split"
- `MasterFile4_3.md`, "Concrete Starter Rule Set"

Canonical intent:

- Foundation market should stay stocked for active beta breeds.
- Starter policy in the master file says:
  - target inventory per breed: 10
  - refill trigger: below 6
  - refill batch: +6
- Foundation dogs should be usable but not top-tier.
- They should have variable strengths and weaknesses.
- They should not be flat mediocre dogs.
- They should not be across-the-board elite.
- They should not be hopeless junk.
- Foundation generation should prefer live breed population data when available, then fallback baselines.
- Pricing should vary from visible categories, not raw hidden traits in UI.
- Foundation dogs should have dog pages before purchase.
- Foundation dogs should vary in age and mostly be show/breed eligible.
- Engine/service split should keep pure generation in rules and data inventory/purchase logic in app services.

## 2.1 Engine / Service Split

Status: **Aligned**

Evidence:

- `packages/rules/engines/foundationDog.engine.ts`
  - Generates hidden traits.
  - Applies generation constraints.
  - Derives visible categories.
  - Produces suggested price and dog profile data.
- `apps/web/server/services/foundationDog.service.ts`
  - Counts active foundation inventory.
  - Determines market policy by breed.
  - Creates database dog/listing rows.
  - Lists market DTOs.
  - Handles purchases and ledger transactions.

Assessment:

- This matches the master file's recommended split well.
- The rules package owns game math; the web service owns database and purchase workflow.

Recommendation:

- Keep this split.

## 2.2 Inventory Policy

Status: **Current code accepted as better**

Master-file rule:

- Maintain 10 unsold foundation dogs per breed.
- Refill when unsold drops below 6.
- Refill by 6.

Current code:

- `apps/web/server/services/foundationDog.service.ts`
  - Uses `FOUNDATION_DENSE_TARGET = 2`.
  - Uses `FOUNDATION_THIN_TARGET = 4`.
  - Uses live player listings and recent player sales to decide whether a breed is thin or dense.
  - Creates enough dogs to reach target inventory, plus enough females to satisfy `FOUNDATION_MIN_ACTIVE_FEMALES = 2`.
  - Expires foundation listings after 7 in-game weeks.
  - Replaces sold inventory immediately by calling `ensureFoundationInventoryForBreed()` after purchase.

Assessment:

- This is clear drift from the concrete starter rule.
- This developed from actual game testing and is accepted as a better current design:
  - 10 dogs per breed across many released breeds could flood the market and database.
  - Thin/dense targets are more responsive to actual player supply.
  - Ensuring at least 2 active females supports breeding availability.
  - Listing expiry prevents stale market stock.

Risk:

- Dense breeds may feel understocked with only 2 foundation dogs.
- The master file's shopping psychology expects enough choice to hunt for "a nice one"; 2 dogs may feel thin.

Recommendation:

- Keep the tested 4/2 thin/dense inventory policy with the female floor.
- Treat the master-file 10/6/+6 rule as superseded by playtesting.
- Continue watching whether dense breeds feel too sparse as player population grows.

## 2.3 Live Breed Baseline and Fallback

Status: **Mostly aligned, with a design reinterpretation**

Master-file rule:

- Use live breed averages if enough data exists.
- Otherwise use breed template baseline.
- Otherwise use global fallback baseline.
- Foundation dogs should be slightly below the current breed mean.

Current code:

- `apps/web/server/services/foundationDog.service.ts`
  - `getLiveBreedBaseline()` uses live owned dogs for the breed when at least `LIVE_BASELINE_MIN_SAMPLE = 8` exist.
  - Otherwise it falls back to `GLOBAL_FALLBACK_BASELINE`, all 10s.
- `packages/rules/engines/foundationDog.engine.ts`
  - `buildTargetMeans()` samples around ideal 10.
  - It uses the live breed baseline to estimate plausible spread and apply a small bias toward the underrepresented side of ideal.

Assessment:

- The service's live-data-first behavior is aligned.
- Missing middle fallback: there is no breed template/archetype baseline yet.
- The phrase "foundation mean target = breed current mean - offset" no longer works literally now that we have confirmed 10 is ideal and higher is not automatically better.
  - If breed mean is 12, subtracting an offset moves toward 10 and may improve quality.
  - If breed mean is 8, subtracting an offset moves away from 10 and worsens quality.

Recommendation:

- Treat the master-file "below mean" wording as old higher-is-better language.
- Reinterpret the intended rule as: foundation dogs should be slightly below the current breed population in ideal-centered quality, not necessarily numerically lower.
- Add breed template baselines later if breed standards become more explicit.
- Current code is directionally better than a literal mean-minus-offset under the 10-ideal model.

## 2.4 Generation Shape and Anti-Flat Dogs

Status: **Aligned**

Evidence:

- `packages/rules/engines/foundationDog.engine.ts`
  - Uses per-trait generation with variance.
  - `buildTraitBiasProfile()` assigns some traits closer to ideal and some farther from ideal.
  - `traitSpread()` rejects flat dogs when spread is too low.
  - Candidate generation has a fallback scoring pass if no candidate passes all constraints.

Assessment:

- This matches the master file's desired shopping psychology:
  - some strengths
  - some weaknesses
  - not uniform 9/9/9/9...

Recommendation:

- Keep.
- Later tuning should inspect generated market samples by breed to make sure the dogs feel meaningfully varied.

## 2.5 Anti-Elite Rules

Status: **Mostly aligned**

Evidence:

- `packages/rules/engines/foundationDog.engine.ts`
  - Rejects suspiciously clean dogs with too many near-ideal hidden traits.
  - Rejects too many near-ideal visible categories.
  - Rejects exactly all-ideal hidden trait sets.
  - Rejects too-flat spread.

Assessment:

- This is aligned with "no across-the-board elite dogs."
- The current code does not compare directly to breed mean totals or count traits above breed mean + 1, but direct comparison to raw "above mean" is now suspect under the 10-ideal model.

Recommendation:

- Keep ideal-centered anti-elite checks.
- Later, if we introduce breed-specific ideal profiles, anti-elite should compare against breed-specific quality targets rather than raw numeric high values.

## 2.6 Anti-Junk Rules

Status: **Mostly aligned**

Evidence:

- `packages/rules/engines/foundationDog.engine.ts`
  - Rejects too many extreme hidden traits.
  - Rejects too many poor hidden traits.
  - Rejects too many severe visible category faults.
  - Requires average visible ideal quality above a minimum threshold.

Assessment:

- This fits the master file: foundation dogs should be serviceable and rarely exciting, not traps.

Recommendation:

- Keep.
- Tune thresholds after reviewing generated sample markets.

## 2.7 Tiered Quality Bands

Status: **Aligned**

Evidence:

- `packages/rules/engines/foundationDog.engine.ts`
  - Defines `STANDARD_FOUNDATION`, `NICE_FOUNDATION`, and `ROUGH_FOUNDATION`.
  - Uses weighted band selection:
    - 60% standard
    - 30% nice
    - 10% rough
  - Keeps quality band internal; market DTO does not expose it.

Assessment:

- This matches the master file closely.

Recommendation:

- Keep quality bands hidden from players.

## 2.8 Pricing

Status: **Needs brainstorming / to be worked on**

Master-file rule:

- Price should vary.
- Lower-end dogs cheaper.
- Nicer visible category-expression dogs somewhat more expensive.
- Pricing should be based on visible categories only, never raw traits directly in UI.

Current code:

- `packages/rules/engines/foundationDog.engine.ts`
  - Suggested price is now based on ideal-centered visible category quality and quality band.
- `apps/web/server/services/foundationDog.service.ts`
  - If enough recent player sales exist, foundation asking price is based on recent player sale mean with a premium multiplier.
  - Otherwise it falls back to the engine suggested price.
  - Prices are rounded and clamped.

Assessment:

- The engine now matches the 10-ideal pricing semantics.
- The service adds player-market-aware pricing, which is not explicitly in the master file but fits the economy goal of keeping foundation stock below/around the player market.

Risk:

- The current service applies recent player sale average to generated foundation dogs regardless of individual visible quality. If player-sale data exists, a rough foundation dog and a nice foundation dog of the same breed may be priced similarly.
- Player-set sale prices and system foundation prices need a coherent strategy together. The ideal player experience is known directionally, but the practical implementation needs design work and testing.

Recommendation:

- Do not treat this as a simple formula patch yet.
- Brainstorm the player selling strategy before changing pricing code.
- Pricing design needs to answer:
  - how much freedom players have to set asking prices
  - whether the system suggests a price or enforces bounds
  - how foundation dog prices avoid undercutting player sales too aggressively
  - how dog quality, age, sex, breed scarcity, and recent sale history should influence price
  - whether failed stale listings should teach the market anything
- Keep current pricing as provisional until the strategy is decided.

## 2.9 Dog Page Before Purchase

Status: **Accepted with UI emphasis requirement**

Master-file rule:

- Foundation dogs should have a dog page before purchase.

Current code:

- `apps/web/app/market/page.tsx`
  - Market cards show visible ring categories, age, sex, price, and registration.
  - Each card has a `View Dog` link.
  - Each card also has a direct `Buy Dog` button.
- `apps/web/app/dogs/[dogId]/page.tsx`
  - Shows a foundation dog profile before purchase.
  - Shows price and purchase action when an active foundation listing exists.

Assessment:

- Dog pages exist and are available before purchase.
- The direct card-level buy button is acceptable as long as it stays visually secondary and the dog page remains the central evaluation path.

Recommendation:

- Keep quick-buy available.
- Make sure the market card layout visually encourages opening the dog page for evaluation.
- If the card ever becomes too purchase-forward, revise the UI so `View Dog` is primary and `Buy Dog` is smaller or secondary.

## 2.10 Age

Status: **Aligned**

Evidence:

- `apps/web/server/services/foundationDog.service.ts`
  - Foundation age range is `MIN_BREED_AGE_HOURS` through `MIN_BREED_AGE_HOURS + 365`.
  - This means foundation dogs are breed-eligible and show-eligible adults, with variation.

Assessment:

- This matches the master file's desire for mostly young adults who can show and breed soon/already.

Recommendation:

- Keep.

## 2.11 Raw Trait Visibility

Status: **Aligned**

Evidence:

- `FoundationDogMarketDto` exposes `visibleCategories`, not raw hidden trait fields.
- Market page renders `visibleCategories`.
- Dog page derives visible categories server-side and renders those.
- Purchase response returns visible categories only.

Assessment:

- This matches the master file's hidden-trait trust rule.

Recommendation:

- Keep.

## 2.12 Overall Verdict

Status: **Mostly aligned, with market-policy decisions needed**

What is working:

- Engine/service split is clean.
- Hidden traits remain hidden from players.
- Visible categories are shown in market and dog pages.
- Generation creates varied dogs with strengths and weaknesses.
- Anti-elite and anti-junk safeguards exist.
- Quality bands match the master file and remain hidden.
- Age variation is aligned.
- Pricing has been corrected to ideal-centered scoring.

Main drift / decisions:

- Inventory policy is no longer 10/6/+6; current code uses thin/dense targets of 4/2 plus a female floor, and this is accepted as better from testing.
- Live baseline fallback lacks breed template baselines.
- Literal "breed mean minus offset" should not be used under the 10-ideal model; use ideal-centered quality instead.
- Direct buy from the market card is acceptable if visually secondary to dog-page evaluation.
- Market pricing and player sale pricing need brainstorming before further code changes.

Recommended next code changes:

1. Keep 4/2 thin/dense foundation inventory with the female floor.
2. Keep quick-buy, but preserve dog-page evaluation as the primary user path.
3. Brainstorm market pricing and player selling price strategy before changing pricing code.
4. Later, add breed template baselines for better no-population fallback.

Recommended next audit section:

- Dog Lifecycle, because age eligibility, breeding eligibility, pregnancy, whelping, sale eligibility, and lifecycle states affect both market and litter behavior.
