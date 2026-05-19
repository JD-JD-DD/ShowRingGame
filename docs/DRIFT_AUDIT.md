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
  - Uses `FOUNDATION_MIN_ACTIVE_MALES = 1`.
  - Uses live player listings and recent player sales to decide whether a breed is thin or dense.
  - Creates enough dogs to reach target inventory, plus enough females to satisfy `FOUNDATION_MIN_ACTIVE_FEMALES = 2` and enough males to satisfy `FOUNDATION_MIN_ACTIVE_MALES = 1`.
  - Expires foundation listings after 7 in-game weeks.
  - Replaces sold inventory immediately by calling `ensureFoundationInventoryForBreed()` after purchase.

Assessment:

- This is clear drift from the concrete starter rule.
- This developed from actual game testing and is accepted as a better current design:
  - 10 dogs per breed across many released breeds could flood the market and database.
  - Thin/dense targets are more responsive to actual player supply.
  - Ensuring at least 2 active females supports breeding availability.
  - Ensuring at least 1 active male prevents the market from showing only bitches.
  - Listing expiry prevents stale market stock.

Risk:

- Dense breeds may feel understocked with only 2 foundation dogs, but the sex floors now make the effective minimum 3 when both floors are needed.
- The master file's shopping psychology expects enough choice to hunt for "a nice one"; 2 dogs may feel thin.

Recommendation:

- Keep the tested 4/2 thin/dense inventory policy with female and male floors.
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

- Inventory policy is no longer 10/6/+6; current code uses thin/dense targets of 4/2 plus female and male floors, and this is accepted as better from testing.
- Live baseline fallback lacks breed template baselines.
- Literal "breed mean minus offset" should not be used under the 10-ideal model; use ideal-centered quality instead.
- Direct buy from the market card is acceptable if visually secondary to dog-page evaluation.
- Market pricing and player sale pricing need brainstorming before further code changes.

Recommended next code changes:

1. Keep 4/2 thin/dense foundation inventory with female and male floors.
2. Keep quick-buy, but preserve dog-page evaluation as the primary user path.
3. Brainstorm market pricing and player selling price strategy before changing pricing code.
4. Later, add breed template baselines for better no-population fallback.

Recommended next audit section:

- Dog Lifecycle, because age eligibility, breeding eligibility, pregnancy, whelping, sale eligibility, and lifecycle states affect both market and litter behavior.

---

# 3. Dog Lifecycle

Master-file anchors:

- `MasterFile4_3.md`, "2.2 Dog Lifecycle"

Canonical intent:

- Lifecycle gates puppy sale eligibility, show eligibility, breeding eligibility, pregnancy, aging, retirement, and death.
- All timing uses ShowDog epoch-hour thresholds.
- Key constants:
  - `PUPPY_SALE_MIN_AGE_HOURS = 56`
  - `MIN_SHOW_AGE_HOURS = 182`
  - `MIN_BREED_AGE_HOURS = 730`
  - `PREG_CHECK_HOURS = 30`
  - `GESTATION_HOURS = 60`
  - `DAM_MAX_BREED_AGE_HOURS = 2520`
  - `AGE_DEATH_START_HOURS = 2880`
  - `VETERAN_START_HOURS = 3240`
  - `MAX_SHOW_AGE_HOURS = 3840`
- Derived life stages:
  - `PUPPY`
  - `JUNIOR`
  - `ADULT`
  - `VETERAN`
  - `RETIRED`
- Permanent/availability states:
  - `DECEASED`
  - `FOREVER_HOME`
  - `TRANSFERRED`
- Master file says lifecycle stage should be derived from timestamps, not stored directly.

## 3.1 Age and Eligibility Constants

Status: **Partially implemented / clarified by design discussion**

Evidence:

- `packages/rules/constants/lifecycle.constants.ts`
  - `PUPPY_SALE_MIN_AGE_HOURS = 56` aligns.
  - `MIN_SHOW_AGE_HOURS = 182` aligns.
  - `MIN_BREED_AGE_HOURS = 2 * SHOW_YEAR_HOURS = 730` aligns because `SHOW_YEAR_HOURS = 365`.
  - `AGE_DEATH_START_HOURS = 2880` aligns.
  - `VETERAN_START_HOURS = 3240` aligns.
  - `MAX_SHOW_AGE_HOURS = 3840` aligns.
  - `PREG_CHECK_HOURS = 4 * SHOW_WEEK_HOURS = 28`, but master says 30.
  - `GESTATION_HOURS = 8 * SHOW_WEEK_HOURS = 56`, but master says 60.
  - `DAM_MAX_BREED_AGE_HOURS = 7 * SHOW_YEAR_HOURS = 2555`, but master says 2520.
- `apps/web/server/services/breeding.service.ts`
  - Now uses a rules-package timing helper when creating breeding attempts.
- `apps/web/components/breeding/BreedPageClient.tsx`
  - Now displays usual 28/56 timing and the actual rolled timing returned by the API after a breeding is created.

Assessment:

- Puppy sale, show age, breed age, death risk, veteran start, and max show age are aligned.
- Pregnancy check and gestation have been reconciled in code, but the master file text is now stale:
  - rules package says 28/56
  - web service/UI now use rules-package variable timing around 28/56
  - master says 30/60
  - updated design direction is variable timing around 28/56
- Dam cutoff is close but not exact:
  - rules package says 2555 because 7 * 365
  - master says 2520
- Duplicated timing constants in the web service/client were removed during the lifecycle pass.

Recommendation:

- Keep the rules package as the single source of truth for breeding timing.
- Replace fixed pregnancy timing with a deterministic seeded timing roll:
  - 80%: pregnancy check at 28, whelping due at 56
  - 15%: pregnancy check at 27 or 29, whelping due at 55 or 57
  - 5%: pregnancy check at 26 or 30, whelping due at 54 or 58
- Timing variation should be determined when the breeding attempt is created and stored as `pregCheckEpoch` and `dueEpoch`.
- Decision needed: exact male/female breeding age-out thresholds.

Resolved direction:

- Use variable timing centered on 28/56, not fixed 30/60.
- Keep timing deterministic after creation so the user can see due dates reliably.

## 3.2 Derived Life Stage

Status: **Needs redesign / clarified by design discussion**

Master-file lifecycle stage algorithm:

```txt
if ageHours < MIN_SHOW_AGE
    state = PUPPY
else if ageHours < MIN_BREED_AGE
    state = JUNIOR
else if ageHours < VETERAN_START
    state = ADULT
else if ageHours < MAX_SHOW_AGE
    state = VETERAN
else
    state = RETIRED
```

Current code:

- `packages/rules/src/lifecycle.ts`
  - `lifeStage()` returns `PUPPY`, `JUNIOR`, `ADULT`, `VETERAN`, or `SENIOR`.
  - It uses `AGE_DEATH_START_HOURS` as the adult/veteran boundary.
  - It returns `SENIOR` after max show age, not `RETIRED`.

Assessment:

- This conflicts with the master file:
  - veteran should start at `VETERAN_START_HOURS = 3240`, not `AGE_DEATH_START_HOURS = 2880`.
  - post-show-age should be `RETIRED`, not `SENIOR`, if we follow the master file.
- The code comment says veteran age can be refined later, so this appears to be an older placeholder.
- Updated design discussion clarifies that `VETERAN`, `SENIOR`, and `RETIRED` are not the same kind of state:
  - `VETERAN` belongs to the show-entry system and means the dog can enter veteran classes.
  - `SENIOR` belongs to the death-risk/aging system.
  - `RETIRED` is a user-chosen kennel state that removes show/breeding functionality while keeping the dog in the kennel.
- Veteran and senior may begin at the same age threshold, but they are separate derived classifications from separate engines.

Recommendation:

- Stop treating one `lifeStage()` value as responsible for every lifecycle concept.
- Consider separate helpers:
  - `getShowEntryClass()` for show-entry classes such as puppy, open/adult, and veteran.
  - `getDogAgeStage()` for puppy/adult/senior gameplay aging.
  - `getAgingRiskStage()` for senior/death-risk logic.
  - stored user-chosen `retired` state for retirement couch behavior.
- Decision needed: the exact shared threshold where veteran show eligibility and senior death-risk begin.

## 3.3 Stored Lifecycle State vs Derived Stage

Status: **Needs schema/API redesign**

Master-file statement:

- "Lifecycle state itself is never stored directly. It is always computed from age."

Current code:

- `apps/web/prisma/schema.prisma`
  - Stores `Dog.lifecycleState` as enum:
    - `ALIVE`
    - `DECEASED`
    - `TRANSFERRED`
    - `RETIRED`
- `packages/rules/src/lifecycle.ts`
  - `DogStatus` is similarly:
    - `ALIVE`
    - `RETIRED`
    - `DECEASED`
    - `TRANSFERRED`
- Age stage is separately derived by `lifeStage()`.

Assessment:

- The code is not storing age stage like `PUPPY`, `JUNIOR`, `ADULT`, or `VETERAN`.
- It stores an availability/status flag: alive, retired, transferred, deceased.
- That may be better database design than storing a fully derived age stage.
- The drift is mostly vocabulary:
  - master file uses "lifecycle state" for both derived age stage and durable terminal/ownership states.
  - code uses `lifecycleState` for durable availability state.
- Updated design discussion clarifies a better separation:
  - biological status should be `ALIVE` or `DECEASED`
  - sold/transferred should be represented by owner kennel change plus ledger/listing history, not as a biological lifecycle state
  - retired should be a user-chosen active-kennel state that moves the dog to a retirement couch
  - forever home should remove the dog from active kennel play while preserving the dog page/pedigree

Recommendation:

- Do not rush a database rename.
- In future docs/code, distinguish:
  - **vitalStatus**: biological status (`ALIVE`, `DECEASED`)
  - **kennelPlacement** or similar: active kennel, retirement couch, forever home
  - **ownership**: represented by `ownerKennelId`
  - **show age class**: derived from age and show rules
  - **aging risk stage**: derived from age and death-risk rules
- Decision needed: whether to evolve the current Prisma enum in place or introduce new fields/migrations later.

## 3.4 Missing FOREVER_HOME State

Status: **Drift / design direction clarified**

Evidence:

- Master file includes `FOREVER_HOME`.
- Prisma `DogLifecycleState` does not include `FOREVER_HOME`.
- Rules `DogStatus` does not include `FOREVER_HOME`.
- `apps/web/app/api/dogs/[dogId]/rehome/route.ts` maps rehoming to `TRANSFERRED`.

Assessment:

- Current implementation treats "re-home dog" as `TRANSFERRED`.
- Master file says `FOREVER_HOME` means removed from active play and preserved in pedigree.
- Those are semantically different:
  - `TRANSFERRED` implies ownership changed.
  - `FOREVER_HOME` implies the dog leaves the active game economy but remains historical.
- Updated design discussion:
  - `FOREVER_HOME` should remove the dog from the user's kennel page.
  - The dog page should remain accessible through pedigrees/litters.
  - The dog should have no functionality and cannot be brought back into play.
  - Ideally the dog may still age and die, but a better near-term design is a static forever-home dog page showing breed, pedigree, stats, and forever-home status.

Recommendation:

- Use `FOREVER_HOME` for voluntary remove-from-active-play.
- Do not use `TRANSFERRED` for forever-home rehoming.
- Reserve ownership change for sales/transfers through `ownerKennelId` and ledger/listing records.

## 3.5 Show Eligibility

Status: **MVP gap / partial alignment**

Evidence:

- `packages/rules/src/lifecycle.ts`
  - `canEnterShows()` checks:
    - status is `ALIVE`
    - age is between `MIN_SHOW_AGE_HOURS` and `MAX_SHOW_AGE_HOURS`
- `apps/web/app/dogs/[dogId]/page.tsx`
  - Displays show eligibility based on age and alive state.
- Shows pages/API are currently placeholders:
  - `apps/web/app/shows/page.tsx` returns null.
  - `apps/web/app/api/shows/showId/enter/route.ts` returns `{ ok: true }`.
  - `apps/web/server/services/show.service.ts` is empty.

Assessment:

- The rule helper is aligned.
- The dog page displays eligibility.
- Actual show-entry enforcement is not implemented yet.

Recommendation:

- Treat as MVP gap.
- When show entry is implemented, use the rules lifecycle helper or equivalent server-side check.
- Master edge case says eligibility should be determined at show start time, not necessarily at entry time; this should be included when show entries become real.

## 3.6 Breeding Eligibility

Status: **Partially working / needs cooldown and single-source cleanup**

Evidence:

- `packages/rules/src/lifecycle.ts`
  - `canBreed()` enforces alive state, min breeding age, female max age, pregnancy state, and cooldown.
- `packages/rules/engines/breeding.engine.ts`
  - `canBreedSire()` and `canBreedDam()` enforce sex, alive state, min age, dam cutoff, pregnancy, and cooldown.
- `apps/web/server/services/breeding.service.ts`
  - Enforces ownership, alive state, same breed, opposite sex, min breed age, dam max age, and no active dam conflict.
- `apps/web/app/breed/page.tsx`
  - Displays breeding eligibility based on alive state, min breed age, female max age, and active dam attempts with status `INITIATED` or `PREGNANT`.
- `apps/web/app/dogs/[dogId]/page.tsx`
  - Displays breed button/status based on ownership, alive state, min breed age, and female max age.
  - Does not check active pregnancy/pending attempt for the dog-page button.
- `apps/web/app/api/dogs/mine/route.ts`
  - Kennel roster displays breeding card status from alive state, age, active/recent dam attempts, and recent result statuses.
- `apps/web/prisma/schema.prisma`
  - `Dog` has `deathEpoch` and `lifecycleState`.
  - `BreedingAttempt` has `status`, `checkedEpoch`, `isPregnant`, and `whelpedEpoch`.
  - There is no persisted `whelpingCooldownUntil` field.

Assessment:

- Core server-side breeding creation is mostly aligned and blocks the most important invalid attempts.
- The web service is the current source of truth at creation time, but it does not use rules `canBreed()` or `canBreedDam()` directly; it duplicates the age logic.
- The breed page, dog page, kennel roster, rules helpers, and service all calculate eligibility slightly differently.
- Whelping cooldown exists in rules but is not persisted or enforced in the web service after whelping.
  - Current rules constant: `WHELPING_COOLDOWN_HOURS = 270`, noted as about 9 months.
- `resolveWhelp()` returns `damReproUpdate.whelpingCooldownUntil`, but the web service does not store that value or derive future eligibility from the latest whelped attempt.
- `CHECKED_NOT_PREGNANT` is not treated as an active conflict in the web service or breed page, which matches the desired design that the bitch can be bred again immediately if otherwise eligible.
- The current female breeding cutoff is close to, but not exactly, the master file:
  - code: `DAM_MAX_BREED_AGE_HOURS = 7 * 365 = 2555`
  - master file: `DAM_MAX_BREED_AGE_HOURS = 2520`
- There is no male breeding age-out yet.
- There is no explicit senior-stage breeding block yet beyond the female max age.
- Retired/deceased/transferred dogs are blocked because code requires `lifecycleState === "ALIVE"`.
- `FOREVER_HOME` does not exist yet, so it cannot be checked.

Eligibility check matrix:

| Case | Current server create behavior | Current UI behavior | Audit result |
| --- | --- | --- | --- |
| Wrong owner | blocked | dog generally not selectable from breed page | working |
| Same dog selected twice | blocked | not specifically prevented before submit | server works; UI can improve |
| Same sex pair | blocked | selectable controls separate sire/dam by sex | working |
| Different breed | blocked | UI filters and warns for mismatch | working |
| Too young | blocked | shown disabled/not eligible | working |
| Female over max age | blocked | shown disabled/not eligible | working, but cutoff value needs decision |
| Male over future max age | not blocked | not blocked | missing pending male cutoff decision |
| Pending pregnancy check | blocked through active dam conflict | breed page disables; dog page may still show breed button | server works; dog page display drift |
| Pregnant | blocked through active dam conflict | breed page disables; kennel status shows pregnant; dog page may still show breed button | server works; dog page display drift |
| Did not take | not blocked | recent roster label shows result, then dog returns open | working as desired |
| Post-whelp cooldown | not blocked after recent whelp window | not shown as cooldown | missing |
| Retired/deceased/transferred | blocked because not `ALIVE` | generally excluded/disabled | works for current enum |
| Forever home | no state exists | no state exists | missing |
- Updated design discussion:
  - dogs and bitches should have different age-out thresholds for breeding.
  - there should be a status/condition that makes dogs ineligible to breed at a certain age.
  - retired dogs should be ineligible for breeding regardless of biological age.

Recommendation:

- Make one shared eligibility helper the source of truth for service/API/UI presentation.
- Have server-side creation call the shared helper, or at least call the same lower-level rule functions used by the UI DTO builders.
- Add male and female breeding age-out thresholds when the exact values are decided.
- Resolve the female max age mismatch: keep 2555 as 7 game years or change to the master-file 2520.
- Implement post-whelp cooldown, either by:
  - deriving from latest `WHELPED` attempt plus `WHELPING_COOLDOWN_HOURS`
  - or persisting `whelpingCooldownUntil` on the dog/repro state.
- Add a visible post-whelp cooldown countdown so the breeder can see when a bitch becomes eligible to breed again.
- Update the dog page breed button to reflect active pregnancy/pending attempts and future cooldown, not only age.
- Do not apply a cooldown to `CHECKED_NOT_PREGNANT`; a bitch should be breedable again immediately after a pregnancy check does not take, assuming she otherwise meets age/status eligibility.

## 3.7 Pregnancy and Gestation

Status: **Partially implemented**

Evidence:

- Master file says:
  - pregnancy check after 30 hours
  - gestation 60 hours
- `packages/rules/constants/lifecycle.constants.ts` says:
  - pregnancy check 28 hours
  - gestation 56 hours
- `apps/web/server/services/breeding.service.ts` says:
  - new attempts use `rollBreedingTiming()` from the rules package
  - the rolled values are stored as `pregCheckEpoch` and `dueEpoch`
- `apps/web/components/breeding/BreedPageClient.tsx` says:
  - pregnancy check usually 28 game days
  - expected whelping usually 56 game days
  - actual rolled timing is shown after attempt creation

Assessment:

- Updated design direction supersedes fixed 30/60:
  - base timing should be 28/56
  - most pregnancies use 28/56
  - a minority vary by 1-2 days to mimic real-life variation

Implemented in first lifecycle pass:

- Added a seeded pregnancy timing helper to the rules package.
- Store the rolled `pregCheckEpoch` and `dueEpoch` on `BreedingAttempt`.
- Use those stored values for breeding-page confirmation, kennel roster due dates, and backend resolution.
- Kennel roster loading now calls the breeding progress resolver so pregnancy checks/whelping can advance when the player opens the kennel.

Remaining recommendation:

- Do not recompute timing differently after the attempt is created.
- Add a fuller notification/dashboard panel if the roster status is not enough.

Current behavior check:

- Pregnancy check resolution is implemented in `apps/web/server/services/breeding.service.ts`.
- It runs when `resolveBreedingProgressForKennel()` is called.
- That resolver is called by:
  - `/api/dogs/mine`
  - `listBreedingsForKennel()`
  - `listLittersForKennel()`
  - `getLitterForKennel()`
- If the user never hits an endpoint that calls the resolver, pregnancy status may not advance immediately.
- `PREGNANT` is visible on kennel/breeding cards.
- `CHECKED_NOT_PREGNANT` is now surfaced on the kennel roster for a short recent-results window.

UX requirement:

- The user should be able to see at a glance:
  - which bitches are pregnant
  - which recent breedings did not take
  - due date for pregnant bitches
- A notification or kennel dashboard panel should summarize pregnancy check outcomes.
- "Did not take" should remain visible for a short recent-results window rather than disappearing immediately.

Open UX decision:

- Due date display can be in game time or real time.
- Game-time display fits the simulation vocabulary.
- Real-time display is easier for the player to know when to check back.
- Best likely design: show both in compact form, e.g. "Due in 56 game days (about 56 real hours)" or a real timestamp tooltip.

## 3.8 Death, Retirement, and Aging Risk

Status: **MVP gap / design clarified**

Evidence:

- `packages/rules/constants/lifecycle.constants.ts` defines `AGE_DEATH_START_HOURS`.
- `packages/rules/src/lifecycle.ts` exposes `isDeathRiskAge`.
- `packages/rules/engines/death.engine.ts` is empty.
- No service appears to process death risk.
- `deathEpoch` exists on `Dog` in Prisma but is not used in observed flows.

Assessment:

- Constants and schema are prepared for death/aging.
- Death risk curve and retirement processing are not implemented.
- Updated design discussion:
  - `SENIOR` belongs to death-risk logic, not show logic.
  - Senior/death risk may begin at the same age as veteran show eligibility, but the systems are separate.
  - Retired is a user-chosen kennel placement/status, not a natural age class.
  - Retired dogs stay in the user's kennel but move to a retirement couch and lose functionality.
  - Retired dogs should continue to age and eventually move to memorial/memorium when deceased.
  - Deceased dogs should leave the main kennel page and be visible through a memorial/memorium section and dog pages with no functionality.

Recommendation:

- Leave as MVP gap unless aging/death is a near-term gameplay priority.
- When implemented, do not expose death probability to players, per master file.
- Add a future retirement couch and memorial section.

## 3.9 Puppy Sale Eligibility

Status: **MVP gap / not yet wired**

Evidence:

- `packages/rules/src/lifecycle.ts` has `canSellPuppy()`.
- Current visible sale flow focuses on foundation dog purchase and rehome.
- Player dog listing/sale workflow is not yet implemented in the observed UI/service paths.

Assessment:

- Rule helper exists and aligns with the master file.
- Player puppy sale enforcement appears future work.

Recommendation:

- Use `canSellPuppy()` when player listings are implemented.

## 3.10 UI Visibility

Status: **Needs UI simplification and pregnancy visibility**

Master-file UI says players should see:

- age
- lifecycle stage
- show eligibility
- breeding eligibility
- pregnancy status
- due date

Current code:

- Dog page shows:
  - age
  - stored lifecycle state (`ALIVE`, etc.)
  - show eligibility
  - breeding eligibility
- Kennel dog panel/API shows:
  - age
  - stored lifecycle state
  - breeding card status including pregnant/pending/whelped for dams
  - pregnancy check/due countdowns in the API DTO
- Litter pages show puppy lifecycle state and age.

Gaps:

- Dog page does not show derived life stage (`PUPPY`, `JUNIOR`, `ADULT`, `VETERAN`, `RETIRED`).
- Dog page does not show pregnancy status/due date for a dam, even though kennel cards can.
- UI currently displays `ALIVE` as "Lifecycle", which is technically an activity state, not the player's expected age stage.
- Updated design direction:
  - UI does not need to show `ALIVE`.
  - If the dog is in the active kennel and not in retirement couch or memorium, the player can infer it is usable.
  - Show entry eligibility and breeding eligibility should mainly be communicated through available/disabled buttons, using red/green or active/inactive treatment.
  - Avoid redundant text labels for eligibility when the action buttons already communicate it.
  - Pregnancy due date should be shown.

Recommendation:

- Do not show `ALIVE` as a prominent user-facing status.
- Add retirement couch and memorium sections later.
- Keep eligibility communication action-oriented through buttons.
- Add pregnancy status/due date to dog page for dams.

## 3.11 Overall Verdict

Status: **Core gates exist, but lifecycle vocabulary and timing need cleanup**

What is working:

- Age gates for puppy sale, show, and breeding exist in the rules package.
- Breeding eligibility is mostly enforced server-side.
- Dog and kennel pages show age and eligibility.
- Death/retirement schema fields exist for future work.

Main drift / decisions:

- Rules package pregnancy/gestation constants are 28/56, while master text still says 30/60; current design decision is variable timing around 28/56.
- Pregnancy timing now uses seeded variable timing around 28/56 for new attempts.
- Pregnancy check works and the kennel roster now triggers it, but a fuller notification/dashboard panel may still be useful.
- Veteran, senior, and retired are separate concepts and should not be collapsed into one stage.
- Prisma currently stores `lifecycleState`; design direction now favors separating vital status, kennel placement, ownership, show age class, and aging risk.
- `FOREVER_HOME` is missing and rehome currently maps to `TRANSFERRED`, which is not the desired final meaning.
- Show entry enforcement, death risk, retirement, and puppy sales are MVP gaps.
- Dog page needs derived life stage and pregnancy/due-date visibility.

Recommended next code changes:

1. Add dog-page pregnancy status/due date for dams, preferably with both game-time and real-time clarity.
2. Add a dedicated notification or dashboard summary if the kennel roster status is not enough.
3. Add post-whelp breeding cooldown enforcement and a countdown to eligibility; use the current `WHELPING_COOLDOWN_HOURS = 270` rule unless superseded.
4. Decide sex-specific breeding age-out thresholds for dogs and bitches.
5. Redesign lifecycle terminology before schema changes:
   - vital status: alive/deceased
   - kennel placement: active/retirement couch/forever home
   - ownership: owner kennel
   - show entry class: puppy/open/veteran
   - dog age stage: puppy/adult/senior
   - aging risk stage: senior/death risk
6. Defer death processing and show-entry enforcement until those systems are actively built.

Recommended next audit section:

- Breeding and Litters, because timing, pregnancy state, whelping, and litter creation are the next layer built on lifecycle.

## 3.12 Lifecycle Stage and Status Decision Matrix

Status: **Design direction clarified / code changes deferred**

Current source shape:

- `packages/rules/src/lifecycle.ts`
  - `lifeStage()` derives `PUPPY`, `JUNIOR`, `ADULT`, `VETERAN`, `SENIOR`.
  - `DogStatus` stores/accepts `ALIVE`, `RETIRED`, `DECEASED`, `TRANSFERRED`.
- `apps/web/prisma/schema.prisma`
  - `DogLifecycleState` stores `ALIVE`, `DECEASED`, `TRANSFERRED`, `RETIRED`.
- `apps/web/app/dogs/[dogId]/page.tsx`
  - Shows `Status: ALIVE` and a `Lifecycle` card, which is not the intended user-facing vocabulary.
- `apps/web/app/api/dogs/[dogId]/rehome/route.ts`
  - Rehome currently sets `ownerKennelId = null` and `lifecycleState = TRANSFERRED`.

Assessment:

- The program currently mixes derived age stage and durable dog status under lifecycle wording.
- This is understandable early scaffolding, but it is now a design risk because:
  - `ALIVE` is a biological/vital state, not something the UI needs to announce on active kennel dogs.
  - `RETIRED` is user-chosen kennel placement, not an automatic age class.
  - `VETERAN` is a show-entry class, not a death-risk status.
  - `SENIOR` is an aging/death-risk stage, not necessarily a show status.
  - `TRANSFERRED` should mean ownership changed to another kennel, not forever-home removal.
  - `FOREVER_HOME` does not exist in code yet.

Decision matrix:

| Concept | Intended meaning | Derived or stored | Current code fit | Player-facing destination |
| --- | --- | --- | --- | --- |
| Vital status | Alive or deceased | Stored | `lifecycleState` partly fits | Active kennel or memorium |
| Show entry class | Puppy, open/adult, veteran | Derived at show entry time | Not implemented; MasterFile has AKC-like judging/points but class age ranges are not yet explicit | Show entry rules/UI |
| Dog age stage | Puppy, adult, senior | Derived from age | `lifeStage()` partly fits but mixes show/death terms | Breeding/show eligibility and lifecycle UI |
| Aging risk stage | Senior/death-risk eligible | Derived from age | `isDeathRiskAge` exists; engine missing | Hidden death-risk engine |
| Retirement couch | User chooses no show/breeding functionality | Stored placement/status | `RETIRED` exists but needs semantics | Retirement couch section |
| Sold/transferred | Ownership changes to another kennel | Stored through owner kennel plus ledger/history | `TRANSFERRED` exists but is overloaded | New owner kennel |
| Forever home | Leaves active play permanently, preserved historically | Stored placement/status | Missing | Not in kennel; visible through litter/pedigree/dog page |
| Deceased/memorium | Dog dies and becomes historical only | Stored vital status plus death epoch | `DECEASED` and `deathEpoch` exist | Memorium section |

Decisions so far:

- Do not show `ALIVE` as a prominent UI status for active kennel dogs.
- Keep active kennel dogs functionally defined by where they appear and which actions are enabled.
- Show and breed eligibility should be communicated primarily by available/disabled action buttons.
- Show entry class and dog age stage are separate sections that can follow similar age thresholds but drive different engines.
- Show entry classes should follow the AKC-like show-entry/judging model when show entry is built:
  - puppy
  - open/adult
  - veteran
- The MasterFile currently describes AKC-like judging and point mechanics, including same-sex class competition, Winners Dog/Bitch, Best of Winners, Best of Breed/Opposite calculations, majors, and entry hiding. It does not yet provide explicit Puppy/Open/Veteran class age ranges, so those should be decided during show-entry work.
- Dog age stages for non-show lifecycle logic should be:
  - puppy: ineligible for breeding
  - adult: eligible to breed if otherwise qualified
  - senior: unable to breed and subject to death risk
- Veteran and senior may start at a similar age, but they must remain separate systems:
  - veteran belongs to show entry class eligibility
  - senior belongs to breeding eligibility, aging, death risk, and death
- Retired should be a user-chosen state that moves the dog to a retirement couch and disables show/breed actions.
- Retired dogs should continue aging and eventually become deceased.
- Forever-home dogs should leave active play permanently and not be restorable.
- Sold/transferred dogs should continue functioning for the new owner; the old owner sees the financial record/history, not the dog in their active kennel.
- Dogs of any age stage may be sold, forever-homed, or sent to the retirement couch if the relevant player action is allowed.
- Alive and deceased represent whether the dog object is active in the game world or a historical/memorium placeholder.

Deferred code todos:

1. Rename or split lifecycle concepts in code once the schema migration path is chosen.
2. Replace user-facing `Lifecycle: ALIVE` with age class/placement-aware UI.
3. Add a retirement action and retirement couch view.
4. Add a memorium view for deceased dogs.
5. Add `FOREVER_HOME` semantics instead of using `TRANSFERRED` for rehome.
6. Reserve `TRANSFERRED` for actual ownership changes through sale/transfer flows.
7. Split rule helpers into clearer names:
   - show entry class/eligibility
   - dog age stage
   - breeding eligibility
   - aging risk
   - kennel placement
   - vital status

Open decisions:

- Exact male breeding age-out threshold.
- Exact female breeding age-out threshold if different from current `DAM_MAX_BREED_AGE_HOURS`.
- Whether retired dogs should be completely hidden from breeding/show pages or shown disabled with a retirement label.
- Whether forever-home dogs continue to age/death-process or become a static historical record.

---

# 4. Breeding and Litters

Master-file anchors:

- `MasterFile4_3.md`, "4. Time and Epoch Naming Standard"
- `MasterFile4_3.md`, "5.3 Litter Parentage"
- `MasterFile4_3.md`, "5.4 Breeding Events"
- `MasterFile4_3.md`, "2.2 Dog Lifecycle", BreedingAttempt/Litter objects and edge cases
- `MasterFile4_3.md`, "6.5 Whelping / Litter Page"

Canonical intent:

- `BreedingAttempt` tracks:
  - breeding timing
  - pregnancy check
  - gestation
  - litter resolution
- `Litter` tracks:
  - birth timing
  - puppy count
  - parentage
- Simulation fields use integer epochs:
  - `createdEpoch`
  - `pregCheckEpoch`
  - `dueEpoch`
  - `checkedEpoch`
  - `whelpedEpoch`
  - `bornEpoch`
- Registration format:
  - `<breedCode2><serial7><litterOrder2>`
- Whelping/litter page should manage:
  - pregnancies
  - litters
  - puppies
  - puppy sales
  - puppy listings
  - forever-home flow
  - pricing management
  - naming/call names/registered names

## 4.1 Current Implementation

Status: **Core happy path exists**

Evidence:

- `packages/rules/engines/breeding.engine.ts`
  - creates breeding attempts
  - resolves pregnancy checks
  - resolves whelping
  - returns litter and puppy objects
- `packages/rules/engines/litter.engine.ts`
  - validates breed code, serial, puppy count, puppy ids, and puppy sexes
  - generates `serial7`
  - builds puppy registration numbers in the expected format
  - creates puppy dog objects with sire/dam/litter/order data
- `apps/web/server/services/breeding.service.ts`
  - creates breeding attempts for a kennel
  - resolves due pregnancy checks
  - resolves due whelping
  - writes `Litter`
  - writes puppy `Dog` rows
  - updates the `BreedingAttempt` to `WHELPED`
- `apps/web/server/services/litter.service.ts`
  - lists litters visible to the kennel
  - gets litter detail visible to the kennel
  - resolves breeding progress before loading litter views
- `apps/web/app/litters/page.tsx`
  - shows active breedings and whelped litters
- `apps/web/app/litters/[litterId]/page.tsx`
  - shows litter parents, counts, puppies, registration numbers, and visible categories

Assessment:

- The main happy path works:
  - create breeding
  - wait for pregnancy check
  - possibly become pregnant
  - wait for due date
  - create litter
  - create puppies
  - show litter/list/detail pages
- Epoch naming is mostly aligned with the MasterFile.
- Parentage and puppy registration structure are aligned.
- The litter service now gives players a visible place to review litters, which fixed an earlier visibility gap.

## 4.2 Pregnancy Resolution and Whelping Triggers

Status: **Working but endpoint-triggered**

Current behavior:

- Pregnancy check and whelping are resolved by `resolveBreedingProgressForKennel()`.
- The resolver is called by:
  - kennel dog API
  - breeding list service
  - litter list service
  - litter detail service

Assessment:

- This is acceptable for MVP because opening kennel/breeding/litter pages advances the state.
- It is not a global scheduler/tick processor.
- If no relevant endpoint is visited, due checks/whelping wait until the next resolver call.
- This is fine for the current web app, but should be documented as a lazy-resolution model.

Recommendation:

- Keep lazy resolution for now.
- Later, consider a scheduled/tick processor only if gameplay requires pregnancies to resolve without player page visits.
- Make sure all pages that display breeding/pregnancy state call the resolver first.

## 4.3 Litter Size and Puppy Generation

Status: **Updated / functional**

Evidence:

- Rules constants:
  - `MIN_LITTER_SIZE = 2`
  - `MAX_LITTER_SIZE = 14`
  - `DEFAULT_LITTER_SIZE_DISTRIBUTION = 0 // TBD`
  - `LITTER_VARIATION = 0 // TBD`
  - `STILLBIRTH_RATE = 0 // TBD`
- Rules package `rollLitterSize()` now returns 2-14 puppies with a distribution centered on 8.
- Web service now calls the rules package litter-size roller.
- Puppy sex is seeded around 50/50.
- Puppy traits are generated from sire/dam through the litter/trait engine.

Assessment:

- Puppy generation works.
- The current litter-size distribution is:
  - 70% at 8
  - 10% at +/- 1
  - 7.5% at +/- 2
  - 5% at +/- 3
  - 4% at +/- 4
  - 2.5% at +/- 5
  - 1% at +/- 6
- This produces a full 2-14 puppy range.
- The rules package still advertises litter-size/stillbirth constants as TBD.
- No stillbirth/reproductive complication logic exists.
- The MasterFile mentions breeding outcomes as random, but does not appear to define breed-specific litter size yet.

Recommendation:

- Keep current pup count distribution for MVP unless gameplay testing says otherwise.
- Defer stillbirth/reproductive complications unless the design explicitly wants them.

## 4.4 Registration Numbers and Serial Collisions

Status: **Aligned with small robustness gap**

Evidence:

- Master format:
  - `<breedCode2><serial7><litterOrder2>`
- `packages/rules/engines/litter.engine.ts`
  - implements `buildRegNumber()`
  - validates `breedCode2`
  - validates `serial7`
  - pads litter order to two digits
- Prisma:
  - `Dog.regNumber` is unique
  - `Litter` has unique `(breedCode2, serial7)`

Assessment:

- Registration format is aligned.
- Serial collisions should be rare, but the whelping flow does not retry if `serial7` collides with an existing litter for the same breed.
- A unique constraint would reject the write, causing whelping resolution to fail for that attempt.

Recommendation:

- Add a retry path around litter serial generation before this becomes large-scale.
- Keep unique constraints.

## 4.5 Visibility and Access

Status: **Mostly aligned for MVP**

Evidence:

- `litter.service.ts` makes a litter visible when:
  - the kennel bred the litter, or
  - the kennel owns at least one puppy in the litter.
- Litter detail links to sire, dam, and puppy dog pages.

Assessment:

- This is good for breeder history and future sold-puppy visibility.
- Once sales/transfers exist, owners of puppies should be able to see litter context.
- Once forever-home exists, dog pages should remain visible through litter/pedigree paths without functionality.

Recommendation:

- Keep this visibility model.
- When forever-home/memorium pages are implemented, keep litter/pedigree access to historical dogs.

## 4.6 Missing Whelping/Litter Page Features

Status: **MVP gaps**

MasterFile says the Whelping/Litter Page should support:

- pregnancies
- litters
- puppies
- puppy sales
- puppy listings
- forever-home flow
- pricing management
- call names
- registered names

Current implementation:

- Shows active pregnancies.
- Shows whelped litters.
- Shows puppies and visible categories.
- Links puppy dog pages.
- Does not support puppy listing/sale actions.
- Does not support forever-home actions.
- Does not support pricing management.
- Does not support naming puppies from the litter page.

Recommendation:

- Treat as future feature work after lifecycle/status semantics are settled.
- Prioritize puppy naming and sale/listing flow once player puppy market work begins.
- Do not build forever-home here until `FOREVER_HOME` semantics are added.

## 4.7 Edge Cases

Status: **Known gaps**

MasterFile edge cases:

- Dog dies during pregnancy:
  - litter fails
  - breeding attempt closes
- Dog sold while pregnant:
  - pregnancy remains attached to dog
- Dog dies during show entry:
  - entry voided

Current behavior:

- Death risk/death processing is not implemented, so death during pregnancy is not handled.
- Pregnant dog sale/transfer is not fully implemented.
- Current whelping assigns puppies to `createdByKennelId`, not necessarily the dam's current owner.
- Current resolver queries attempts by `createdByKennelId`; a future pregnant transfer may require resolving attempts by current dam owner or global due attempt processing.

Assessment:

- Edge cases are acceptable as MVP gaps today.
- The sold-while-pregnant behavior must be revisited before pregnant dog transfers/sales become possible.
- The desired policy is that pregnancy remains attached to the dog, so ownership of puppies likely needs a deliberate rule:
  - puppies follow current dam owner at whelping, or
  - puppies follow breeding creator by contract.
- Current implementation implicitly chooses breeding creator, not dog-attached ownership.

Recommendation:

- Block sale/transfer of pregnant dogs until the ownership rule is decided, or implement the chosen rule before allowing pregnant transfers.
- Add death-during-pregnancy handling when death risk is implemented.
- Add show-entry death handling when show entries are implemented.

## 4.8 Overall Verdict

Status: **Happy path working; lifecycle/economy edges pending**

What is working:

- Breeding attempts are created.
- Pregnancy checks resolve.
- Whelping creates litter and puppies.
- Litter parentage and registration numbers are present.
- Litter list/detail UI exists.
- Active pregnancies are visible on the litter page.

Main gaps:

- Post-whelp breeding cooldown is returned by rules but not enforced/stored/derived in web.
- Litter-size distribution now lives in rules package, centered on 8 with a 2-14 range.
- Serial collision retry is missing.
- Puppy sale/listing/pricing/forever-home flows are missing.
- Puppy naming from litter page is missing.
- Death during pregnancy is missing.
- Pregnant dog transfer/sale policy is undecided and current code would not match "pregnancy attached to dog" if ownership should follow dam.

Recommended next code changes:

1. Finish breeding eligibility cleanup and post-whelp cooldown before adding more litter actions.
2. Add dog-page pregnancy and litter context for dams.
3. Add puppy naming flow on litter detail.
4. Plan puppy sale/listing/pricing once market pricing strategy is decided.
5. Decide pregnant dog transfer/sale policy before allowing that flow.
6. Tune pup count distribution later if gameplay testing suggests a different feel.

Recommended next audit section:

- Death Risk and Deceased Stage, because it directly affects pregnancy edge cases, retired dogs, memorium pages, and lifecycle state cleanup.

---

# 5. Death Risk and Deceased Stage

Master-file anchors:

- `MasterFile4_3.md`, "2.2 Dog Lifecycle"
- `MasterFile4_3.md`, Dog Lifecycle states and edge cases
- `MasterFile4_3.md`, UI visibility rules for death probability

Canonical intent:

- Lifecycle creates emotional stakes and prevents immortal super-dogs.
- Death risk begins when:
  - `ageHours >= AGE_DEATH_START_HOURS`
  - current master value: `AGE_DEATH_START_HOURS = 2880`
- Daily death probability should increase gradually after death-risk age.
- Exact mortality curve is TBD in the MasterFile.
- Players should not see:
  - death probability
  - internal mortality curves
- `DECEASED` means immutable historical record.
- Deceased dogs should not remain active game objects for gameplay functions.
- Edge cases:
  - dog dies during pregnancy: litter fails and breeding attempt closes
  - dog dies during show entry: entry voided
  - retired dogs should continue aging and eventually become deceased

## 5.1 Current Code and Schema Support

Status: **Schema prepared / engine missing**

Evidence:

- `packages/rules/constants/lifecycle.constants.ts`
  - `AGE_DEATH_START_HOURS = 2880`
- `packages/rules/src/lifecycle.ts`
  - imports `AGE_DEATH_START_HOURS`
  - exposes `isDeathRiskAge` through `getLifecycleFlags()`
  - uses death-risk age as part of its current mixed `lifeStage()` logic
- `packages/rules/engines/death.engine.ts`
  - exists but is empty
- `packages/rules/engines/index.ts`
  - has death engine export commented out
- `apps/web/prisma/schema.prisma`
  - `Dog.deathEpoch Int?`
  - `Dog.lifecycleState DogLifecycleState @default(ALIVE)`
  - enum includes `DECEASED`
- `apps/web/server/services/dog.service.ts`
  - can map engine dog status `DECEASED` to Prisma `DogLifecycleState.DECEASED`

Assessment:

- The database can represent deceased dogs.
- The rules constants can identify when death risk begins.
- There is no death-risk curve.
- There is no death resolution engine.
- There is no web service that marks dogs deceased.
- `deathEpoch` is currently unused.

Recommendation:

- Implement death as its own engine/service, separate from show veteran logic.
- Do not overload `lifeStage()` for death risk.
- Keep death probability hidden from UI.

## 5.2 Current UI and Query Behavior

Status: **Partially aligned by filtering, but no memorium**

Evidence:

- `apps/web/app/api/dogs/mine/route.ts`
  - filters kennel roster dogs to `lifecycleState: "ALIVE"`.
- `apps/web/app/dogs/[dogId]/page.tsx`
  - can load a dog by id without requiring active ownership.
  - gates actions through ownership and `lifecycleState === "ALIVE"`.
  - still displays raw `Status: {dog.lifecycleState}` and `Lifecycle`.
- `apps/web/components/kennel/KennelDogsPanel.tsx`
  - only receives dogs returned by `/api/dogs/mine`, so deceased dogs are not in the current main kennel roster.
- No memorium/memorial route was found.

Assessment:

- If a dog were marked `DECEASED`, it would disappear from the main kennel roster because the API filters `ALIVE`.
- The dog page would still be accessible by direct link, which is useful for pedigree/history.
- The dog page is not yet designed as historical-only for deceased dogs.
- There is no memorium section where the user can find deceased dogs.
- The project currently uses the spelling "memorium" in planning discussion; decide whether UI should say "Memorium" or "Memorial" before building routes.

Recommendation:

- Add a memorium/memorial page that lists deceased dogs for a kennel.
- Keep direct dog page access for deceased dogs.
- Disable all gameplay actions for deceased dogs.
- Replace raw `ALIVE`/`DECEASED` lifecycle display with placement-aware UI:
  - active kennel dogs: no need to show `ALIVE`
  - deceased dogs: show historical/memorium state clearly

## 5.3 Death Processing Model

Status: **Open design / implementation needed**

Design choices:

- Processing cadence:
  - lazy resolution when kennel/dog pages load
  - scheduled daily game tick
  - hybrid model
- Scope:
  - only dogs owned by the current kennel when they load
  - all active dogs globally
  - active plus retired dogs
  - forever-home dogs, if they continue aging
- Curve:
  - MasterFile only says daily probability increases gradually.
  - Exact probability curve is still TBD.

Assessment:

- Lazy resolution matches the current pregnancy model and is simpler for MVP.
- Death is more emotionally sensitive than pregnancy, so a visible "your dog died because you opened the page" feeling should be avoided.
- A scheduled or deterministic daily check may feel fairer once the game has enough active users/data.
- The first implementation can still be deterministic and seed-based to avoid repeated rerolls for the same dog/day.

Recommendation:

- Use a deterministic daily death check keyed by dog id and game day/epoch bucket.
- Store `deathEpoch` when death occurs so the outcome is permanent.
- Start with a conservative curve and tune later.
- Process retired dogs.
- Exclude forever-home dogs if the final forever-home design is static historical record; include them only if the design says they continue aging.

## 5.4 Death Effects

Status: **Needs implementation policy**

On death, likely updates:

- Set `Dog.lifecycleState = DECEASED`.
- Set `Dog.deathEpoch = currentEpoch`.
- Set `Dog.marketState = NOT_FOR_SALE`.
- Cancel or close active player listing records.
- Remove dog from active kennel roster.
- Remove dog from breed/show eligibility.
- Prevent fatigue/conditioning changes.
- Preserve dog page, pedigree links, litter links, titles, and historical results.

Pregnancy edge case:

- MasterFile says if a dog dies during pregnancy:
  - litter fails
  - breeding attempt closes
- Current code has no death processor, so this is not handled.
- Needed behavior:
  - if dam dies while `INITIATED` or `PREGNANT`, close attempt as failed/cancelled and no litter is created.
  - if sire dies after breeding but before whelping, policy needs decision; the MasterFile edge case says "dog dies during pregnancy" but does not specify sire vs dam.

Show-entry edge case:

- MasterFile says dog death before judging voids entry.
- Show-entry implementation is currently placeholder, so this waits for show entry work.

Recommendation:

- In death service, explicitly check active breeding attempts and show entries before/while marking deceased.
- Prioritize dam death behavior because it affects litter creation.
- Decide sire-death behavior during pregnancy before implementation.

## 5.5 Senior Stage and Breeding Cutoff

Status: **Design decision needed**

Current model:

- `AGE_DEATH_START_HOURS = 2880`.
- `VETERAN_START_HOURS = 3240`.
- Current `lifeStage()` begins veteran-ish logic at death-risk age, then returns `SENIOR` after max show age.
- Current breeding cutoff:
  - female cutoff uses `DAM_MAX_BREED_AGE_HOURS`.
  - male cutoff does not exist.

Clarified design direction:

- Show entry classes and dog age stages are different systems.
- Dog age stages:
  - puppy: cannot breed
  - adult: can breed if otherwise eligible
  - senior: cannot breed and enters death-risk logic
- Veteran belongs to show entry, not death risk.

Recommendation:

- Decide whether senior begins at `AGE_DEATH_START_HOURS = 2880` or another threshold.
- Make senior-stage breeding cutoff explicit for both sexes.
- Keep veteran class threshold in show-entry rules.
- Rename/split helper functions before implementing death:
  - `getDogAgeStage()`
  - `isDeathRiskAge()`
  - `canBreed()`
  - `getShowEntryClass()`

## 5.6 Overall Verdict

Status: **Not implemented; schema ready**

What is working:

- Schema can store `DECEASED` and `deathEpoch`.
- Rules constants define death-risk start.
- Active kennel roster already filters to alive dogs.
- Dog page actions are mostly gated by alive state.

Main gaps:

- No death-risk engine.
- No death processor/service.
- No mortality curve.
- No memorium/memorial page.
- No historical-only deceased dog page treatment.
- No death during pregnancy handling.
- No death during show-entry handling.
- No senior-stage breed cutoff for males.
- Current helper naming still mixes veteran/senior/death concepts.

Recommended next code changes:

1. Decide senior/death-risk threshold and mortality curve.
2. Split lifecycle helpers so death risk is separate from show veteran class.
3. Implement a deterministic death-risk engine.
4. Add a service to mark dogs deceased and set `deathEpoch`.
5. Add death-during-pregnancy handling before allowing death processing on pregnant dams.
6. Add memorium/memorial page and historical-only dog page treatment.

Recommended next audit section:

- Kennel/Dog Page UI and actions, because many lifecycle decisions now need to appear as action buttons, retirement couch/memorium sections, dog-page pregnancy status, and improved breed-page filtering.

---

# 6. Kennel/Dog Page UI and Actions

Status: **Partially implemented; action semantics need cleanup**

MasterFile anchors:

- `MasterFile4_3.md`, "6.1 Dog Page"
- `MasterFile4_3.md`, "6.4 Show Entry Page"
- `MasterFile4_3.md`, "6.5 Whelping / Litter Page"
- `MasterFile4_3.md`, "Dog Page Before Purchase"

MasterFile intent:

- The Dog Page is the central object page for a dog.
- The server assembles identity, ownership, conditioning, visible judging categories, pedigree summary, sale state, pregnancy state, and allowed actions.
- Allowed actions are computed from ownership, age, lifecycle state, breeding status, show-entry status, and market state.
- The Dog Page displays simulation outcomes from other systems rather than performing simulation itself.
- The kennel page should let the player scan and act on their dogs without exposing raw internal state names.

Current design decisions from audit discussion:

- The UI does not need to show `ALIVE` for normal kennel dogs.
- If a dog is in the active kennel and not in the memorium or retirement couch, it is usable by the player.
- Show entry eligibility and breeding eligibility should primarily be communicated by available or unavailable action buttons.
- Pregnancy should be visible enough that the user can tell at a glance which bitches are pregnant, pending a check, or did not take.
- Retirement couch, memorium, forever-home, and sold/transferred are different placement outcomes and should not be collapsed into one lifecycle label.

## 6.1 Kennel Roster

Status: **Mostly useful MVP**

Evidence:

- `apps/web/app/kennel/page.tsx`
  - renders the kennel summary and `KennelDogsPanel`.
- `apps/web/app/api/dogs/mine/route.ts`
  - calls `resolveBreedingProgressForKennel()` before loading dogs.
  - filters to `ownerKennelId: kennel.id` and `lifecycleState: "ALIVE"`.
  - returns visible categories and a `breedingCardStatus`.
- `apps/web/components/kennel/KennelDogsPanel.tsx`
  - shows sortable columns for breed, dog, sex, age, visible trait categories, and breeding status.
  - supports filters for breed, sex, breedable, and show eligible.
  - formats pregnancy state as `Pregnant, due in Xd`.
  - formats pending checks as `Check in Xd`.

Assessment:

- The active kennel roster is already a good working surface.
- Filtering out non-alive dogs matches the decision that deceased dogs should leave the active kennel page.
- The breeding status column is already close to the desired "at a glance" pregnancy view.
- The page does not yet include retirement couch or memorium sections.
- The show-eligible filter uses local age/lifecycle logic instead of a shared eligibility helper.
- The breedable filter depends on card labels, so it may drift when post-whelp cooldown, retired, forever-home, and senior male age-out are added.

Recommendation:

- Keep the active kennel roster as the main "usable dogs" list.
- Add separate retirement couch and memorium views later.
- Replace local show/breedable filtering with shared eligibility DTOs once those helpers are centralized.
- Keep pregnancy status on the roster, and consider a small dashboard/notification summary only if the roster is not enough in testing.

## 6.2 Dog Page

Status: **Strong page shell; action and status display need refinement**

Evidence:

- `apps/web/app/dogs/[dogId]/page.tsx`
  - loads dog identity, owner, breeder, sire, dam, visible categories, conditioning values, market listing, and active action buttons.
  - gates `Breed Dog` by owner, alive state, minimum breeding age, and female max breeding age.
  - gates `Enter Show` by owner, alive state, and show-age range.
  - shows `Buy for` when a foundation listing is active.
  - shows `Re-Home Dog` for owned alive dogs.
  - displays raw `Status: {dog.lifecycleState}` and a `Lifecycle` card.

Assessment:

- The dog page is already close to the MasterFile page shape.
- Showing raw `ALIVE` is not helpful for normal active dogs.
- The `Breed Dog` button can still appear for a bitch who is pending pregnancy confirmation or pregnant, because the dog page does not query active breeding attempts.
- The `Breeding Eligibility` card is age-only and can disagree with the real service checks.
- The dog page does not show pregnancy status or due/check timing.
- The page does not yet distinguish active, retired, forever-home, transferred/sold, and deceased page modes.
- A deceased dog could be loaded by direct link, but the page is not yet styled or constrained as historical-only.

Recommendation:

- Remove or replace raw `ALIVE`/`Lifecycle` display on normal active dogs.
- Add a placement-aware status display:
  - active kennel: no redundant alive label
  - pregnant/pending/did-not-take: breeding state and due/check timing
  - retired: retirement couch state
  - deceased: memorium/historical state
  - forever-home: permanent inactive placement
  - transferred/sold: current owner kennel
- Make the Dog Page use the same breeding eligibility helper or DTO as the breeding service.
- Disable or hide `Breed Dog` when the bitch is pending, pregnant, post-whelp cooldown, senior, retired, deceased, or forever-homed.
- Keep dog pages accessible by direct pedigree/litter links even when no actions are available.

## 6.3 Breed Page Flow

Status: **First-pass dog-page flow implemented**

Evidence:

- `apps/web/app/dogs/[dogId]/page.tsx`
  - links to `/breed?dogId=${dog.id}`.
- `apps/web/app/breed/page.tsx`
  - now reads the `dogId` query parameter.
  - loads all dogs owned by the kennel.
  - marks each dog `isEligibleToBreed` using local age/alive/conflict logic.
  - derives visible category values for the breed page.
- `apps/web/components/breeding/BreedPageClient.tsx`
  - pins the dog from `/breed?dogId=...` as the selected dog.
  - lists eligible same-breed opposite-sex mates for the pinned dog.
  - hides ineligible dogs from the pinned-dog mate list.
  - shows visible trait/category sliders for the pinned dog and mate cards.
  - preserves a general breeding selector when no `dogId` is supplied.

Assessment:

- The dog-page action flow now matches the intended "breed this dog" experience.
- The page still uses local eligibility logic, so it should eventually move to a shared breeding eligibility helper.
- Post-whelp cooldown, retired, forever-home, senior male age-out, and final status semantics are not yet represented in one centralized helper.

Recommendation:

- Use the same centralized breeding eligibility logic as the service and dog page.

## 6.4 Actions and Placement Semantics

Status: **Needs terminology and state cleanup**

Evidence:

- `apps/web/app/api/dogs/[dogId]/rehome/route.ts`
  - requires ownership and `lifecycleState === "ALIVE"`.
  - sets `ownerKennelId: null`, `marketState: "NOT_FOR_SALE"`, and `lifecycleState: "TRANSFERRED"`.
- Current schema includes `TRANSFERRED`, but not the clarified `FOREVER_HOME` placement.
- No retirement couch route or action was found.
- No memorium route was found.

Assessment:

- Current `Re-Home Dog` behaves more like the desired forever-home action, but stores it as `TRANSFERRED`.
- Clarified design says sold/transferred should mean ownership changes to another kennel.
- Forever-home should remove the dog from active player use permanently and should not be reversible.
- Retire should keep the dog in the user's kennel but remove functionality.
- Deceased should preserve the historical dog page and remove all gameplay actions.

Recommendation:

- Rename or replace `Re-Home Dog` with `Forever Home` when the status model is ready.
- Reserve `TRANSFERRED`/sold for real ownership changes.
- Add a user-chosen retire action that moves the dog to the retirement couch.
- Add memorium for deceased dogs.
- Treat placement state as separate from biological age stage wherever possible.

## 6.5 Overall Verdict

Status: **Good foundation; next code pass should reduce drift in user-facing actions**

What is working:

- Kennel roster exists and is useful.
- Dog page shows the key identity, trait, ownership, and pedigree data.
- Dog page actions are mostly owner/alive gated.
- Pregnancy due/check status now appears in the kennel roster.
- Foundation purchase from dog page exists.

Main gaps:

- Raw `ALIVE`/`Lifecycle` text is still user-facing.
- Dog page breeding eligibility can disagree with actual breeding service checks.
- Dog page does not show pregnancy status.
- Breed page dog-page flow is now implemented, but still needs shared eligibility logic.
- Re-home/forever-home/transfer semantics are not yet clean.
- Retirement couch and memorium routes are missing.

Recommended next code changes:

1. Centralize breeding eligibility into one helper/DTO used by service, dog page, breed page, and kennel roster.
2. Update the dog page to remove raw `ALIVE` display and show pregnancy/placement-aware status.
3. Update the dog page `Breed Dog` button to respect active breeding attempts and cooldown.
4. Move the breed page's local eligibility checks to the shared eligibility helper once it exists.
5. Add retirement couch and memorium routes after the state model is settled.
6. Replace `Re-Home Dog` with final forever-home behavior after schema/status decisions.

Recommended next audit section:

- Show Entry and Judging Flow, because dog-page `Enter Show`, puppy/open/veteran class rules, and judging already intersect with the lifecycle distinctions clarified here.

---

# 7. Show Entry and Judging Flow

Status: **Mostly greenfield; schema and rules scaffolding exist**

MasterFile anchors:

- `MasterFile4_3.md`, "3.1 Judging System"
- `MasterFile4_3.md`, "3.3 Titles & Championship System"
- `MasterFile4_3.md`, "4.5 Show Entry Rules"
- `MasterFile4_3.md`, "4.7 Show History"
- `MasterFile4_3.md`, "6.4 Show Entry Page"

Design framing:

- The game has two major playable halves:
  - breeder path: genetics, breeding, litters, puppy/player market
  - show path: buying dogs, entering shows, earning placements/titles, building prestige
- Either path should be playable on its own.
- Best long-term gameplay should reward using both:
  - breeding creates promising dogs
  - showing proves those dogs
  - results/titles affect prestige, demand, and market value

Audit framing:

- This is not mainly a drift audit yet.
- The show side is mostly an implementation-readiness audit.
- The MasterFile contains the intended show-side structure, but the web routes and services are mostly placeholders.

## 7.1 Schema and Data Model

Status: **Good scaffold**

Evidence:

- `apps/web/prisma/schema.prisma`
  - `Judge`
  - `ShowCluster`
  - `ShowDay`
  - `ShowEntry`
  - `ShowResult`
  - `DogTitleProgress`
  - `LedgerTransaction` supports `showClusterId` and `showEntryId`
- Show enums exist:
  - `ShowClusterStatus`
  - `ShowDayStatus`
  - `ShowEntryStatus`
- `ShowEntry` has useful MVP fields:
  - dog, kennel, breed
  - entry status
  - fee charged
  - handler used
  - conditioning/fatigue snapshots
- `ShowResult` can store:
  - rank/placement
  - base/final score
  - points
  - major flag
  - unique kennels in competition
  - scoring version

Assessment:

- The data model can support a real show loop.
- The model already anticipates title progression, points, judges, results, and financial ledger records.
- There is not yet a `ClusterAttendance` model even though the MasterFile describes kennel-level cluster attendance.
- Current show-entry states are simpler than the MasterFile's `DRAFT/SUBMITTED/CLOSED/JUDGING_LOCKED/RESULT_POSTED/ARCHIVED` flow.

Recommendation:

- Keep the current Prisma scaffold for MVP unless cluster attendance becomes necessary immediately.
- Build the first show-entry service against `ShowCluster`, `ShowDay`, `ShowEntry`, `LedgerTransaction`, and `ShowResult`.
- Decide whether cluster attendance is a separate model or inferred from submitted entries for MVP.

## 7.2 Routes, Pages, and APIs

Status: **Placeholder**

Evidence:

- `apps/web/app/shows/page.tsx`
  - returns `null`.
- `apps/web/app/shows/[showId]/page.tsx`
  - returns `null`.
- `apps/web/app/shows/[showId]/results/page.tsx`
  - returns `null`.
- Show API routes currently return placeholder success:
  - `apps/web/app/api/shows/route.ts`
  - `apps/web/app/api/shows/showId/route.ts`
  - `apps/web/app/api/shows/showId/enter/route.ts`
  - `apps/web/app/api/shows/showId/results/route.ts`
  - `apps/web/app/api/admin/shows/seed/route.ts`
  - `apps/web/app/api/admin/shows/[showId]/judge/route.ts`
- `apps/web/server/services/show.service.ts`
  - empty file.
- `apps/web/server/mappers/show.mapper.ts`
  - empty file.

Assessment:

- No user-facing show workflow currently exists.
- `Enter Show` on the dog page links to `/shows`, but `/shows` renders nothing.
- The API endpoints are shells and do not currently:
  - list clusters
  - return show detail
  - quote entry cost
  - validate entries
  - create entries
  - debit ledger
  - judge shows
  - return results

Recommendation:

- Build `/shows` as the first usable show-side surface.
- Make `/shows` show open/upcoming clusters and give the player a clear path into entry planning.
- Replace placeholder APIs with service-backed endpoints as each workflow is implemented.

## 7.3 Show Entry Rules and Eligibility

Status: **Partial constants; no entry implementation**

Evidence:

- `packages/rules/constants/lifecycle.constants.ts`
  - `MIN_SHOW_AGE_HOURS = 182`
  - `MAX_SHOW_AGE_HOURS = 3840`
  - `VETERAN_START_HOURS = 3240`
- `packages/rules/src/lifecycle.ts`
  - `canEnterShows()` checks alive state and age range.
  - `lifeStage()` currently mixes death-risk/veteran concepts, already flagged in lifecycle audit.
- `apps/web/app/dogs/[dogId]/page.tsx`
  - enables `Enter Show` based on ownership, alive state, and show-age range.

MasterFile intent:

- Show entry is campaign planning:
  - browse calendar
  - select cluster
  - select shows
  - select eligible dogs
  - review fees
  - submit entries
- Rules must enforce:
  - one show per dog per day
  - hidden entries before judging
  - affordability
  - handler requirements
  - geography/travel restrictions
  - entry deadlines

Assessment:

- Basic show-age constants exist.
- Entry class logic does not exist yet.
- Puppy/open/veteran class ranges still need final decisions.
- The dog page's `Enter Show` button is a broad placeholder and does not route to a specific entry planner.
- No service currently validates ownership, lifecycle placement, retirement, deceased status, show age, duplicate entry, entry lock, or affordability for actual show entries.

Recommendation:

- Add explicit show helpers:
  - `canEnterShow()`
  - `getShowEntryClass()`
  - `getShowEligibilityReason()`
- Keep show class eligibility separate from dog age stage and death risk.
- Decide puppy/open/veteran class boundaries before building class placement.
- For MVP, the dog page `Enter Show` can route to `/shows?dogId=...` so the show planner can pin or preselect that dog, matching the improved breed flow.

## 7.4 Entry Economics and Travel

Status: **Rules engine exists; not wired**

Evidence:

- `packages/rules/engines/economy.engine.ts`
  - `getTravelCostBreakdown()`
  - `calculateTripTravelCost()`
  - `getClusterEntryQuote()`
- Quote inputs support:
  - home district
  - cluster district
  - ledger balance
  - selected dogs and show days
- Quote output supports:
  - dogs entered
  - total entries
  - travel
  - entry fees
  - handler fee
  - total cost
  - projected balance
  - shortfall
  - affordability
- `LedgerTransactionType` includes:
  - `SHOW_ENTRY_FEE`
  - `TRAVEL_COST`
  - `HANDLER_FEE`

Assessment:

- The quote math is one of the stronger show-side pieces.
- It is not connected to UI or persistence.
- There is no submitted-entry transaction flow.

Recommendation:

- Use `getClusterEntryQuote()` as the live quote engine for the show-entry page.
- On submit, create `ShowEntry` rows and ledger transactions in one transaction.
- Preserve fee breakdown data in `LedgerTransaction.metadataJson` or a future entry-batch/attendance model.

## 7.5 Judging Engine

Status: **Useful core, missing full show semantics**

Evidence:

- `packages/rules/engines/judge.engine.ts`
  - creates judges with category weights and style bias.
  - supported styles include balanced, type, structure, movement, presentation, temperament.
- `packages/rules/engines/judging.engine.ts`
  - derives show characteristics from dog traits.
  - scores dogs against ideal-centered category values.
  - applies judge category weights.
  - ranks dogs by base score.
- `packages/rules/constants/judging.constants.ts`
  - defines six judging categories.
  - maps traits to categories.
  - defines judge weight variation.
  - defines ring randomness and breed essential constants, but those are not applied in the current judging engine.
- `packages/rules/src/sample-judges.ts`
  - contains one sample judge.

MasterFile intent:

- Judging should evaluate six universal categories.
- Judge preferences should affect weighting.
- Controlled randomness should prevent deterministic outcomes.
- Breed essential checks may add bonuses, penalties, eliminations, or DQs.
- Results should lead to placements, points, titles, prestige, and market effects.

Assessment:

- The core scoring engine is a good first piece.
- It now aligns better with the 0-20, 10-is-ideal trait model because scoring uses `scoreValueAgainstIdeal()`.
- It does not yet include:
  - dog-day/ring randomness
  - fatigue/conditioning beyond genetic `show_shine`
  - breed essential rules
  - class structure
  - Winners Dog/Bitch
  - Best of Winners
  - Best of Breed/Opposite
  - group/BIS
  - points or title progression
  - persistence to `ShowResult`

Recommendation:

- Keep the current ideal-centered scoring as the base.
- Add a show judging service that:
  - loads entries for a show day
  - groups entries by breed/sex/class
  - scores each dog with the assigned judge
  - determines placements and point awards
  - persists `ShowResult`
  - updates `DogTitleProgress`
- Delay breed essential and group/BIS until breed-level shows work.

## 7.6 Titles and Championship

Status: **Schema prepared; implementation missing**

Evidence:

- `apps/web/prisma/schema.prisma`
  - `DogTitleProgress` exists.
  - dog rows include `visibleTitlePrefix` and `visibleTitleSuffix`.
- `docs/DogTitles.md`
  - title reference exists in the working tree but is currently untracked.
- No title service was found.
- No point calculation service was found.
- No code currently updates `DogTitleProgress`, `visibleTitlePrefix`, or `visibleTitleSuffix`.

MasterFile intent:

- CH progression:
  - 15 points
  - 2 majors
  - 3 judges
- GCH progression:
  - champion required
  - 25 GCH points
  - 3 majors
  - 3 judges
- Higher GCH tiers exist.
- Points depend on same-sex class competition, BOW, BOB, BOS, and unique kennel/major logic.

Assessment:

- Title progression is not implemented.
- The schema can store a simple progress object but may need richer history for judge diversity and major tracking.
- The point system is complex enough that it should be its own rules/service layer, not buried in UI code.

Recommendation:

- Build title progression after basic show judging and result persistence.
- Start with CH only before GCH tiers.
- Store enough result history to audit point awards and judge diversity.
- Use visible title prefix/suffix only after result-derived progression is reliable.

## 7.7 Show History and Visibility

Status: **Not implemented**

MasterFile intent:

- Entries are hidden until judging begins.
- Results become permanent after judging.
- Show history supports campaign planning, prestige, rankings, and title progression.

Current code:

- Results route/page are placeholders.
- `ShowResult` schema exists.
- No result listing or history UI was found.

Assessment:

- There is no current show history surface.
- The schema is ready for permanent result records.

Recommendation:

- Build result visibility rules at the same time as judging persistence.
- For MVP:
  - hide entries until judging/status threshold
  - show permanent breed/show-day results after publish
  - link result rows back to dog pages

## 7.8 Overall Verdict

Status: **Ready for first implementation pass**

What is working:

- Show-related schema is mostly present.
- Judge and judging rules engines exist.
- Entry quote economics exist.
- Dog page has a placeholder `Enter Show` action.
- Title-progress schema fields exist.

Main gaps:

- Show pages render nothing.
- Show APIs are placeholders.
- Show service and mapper are empty.
- No cluster/calendar listing.
- No entry planner UI.
- No entry validation service.
- No ledger debit for entry/travel/handler costs.
- No judging persistence.
- No show class logic.
- No point/title system.
- No show history/results UI.

Recommended first code build order:

1. Build read-only `/shows` list for open/upcoming clusters.
2. Add show detail/entry planner page.
3. Add eligible dog filtering and `/shows?dogId=...` preselection.
4. Wire `getClusterEntryQuote()` into the entry planner.
5. Implement submit-entry service with affordability and one-show-per-dog-per-day validation.
6. Seed or generate sample clusters/judges.
7. Implement simple breed-level judging persistence.
8. Add results page.
9. Add CH point progression.
10. Add title display updates.

Recommended next audit section:

- Show-side implementation plan, if we want to break this greenfield work into small Vercel-buildable tasks.
