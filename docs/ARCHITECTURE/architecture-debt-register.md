# ShowRing Architecture Debt Register

## 1. Purpose

This diagnostic register records evidence-backed duplicate, divergent, legacy, and unresolved implementation paths discovered during Stage 6. It is not a refactor plan and does not authorize gameplay changes. Repeated code appears only when architecturally meaningful; protected intentional variants are included to prevent accidental consolidation. Later cleanup stages may use this evidence to choose surgical canonicalization work.

## 2. Finding Standard

A finding requires a materially repeated/disputed business rule, durable mutation responsibility, independent eligibility reconstruction, legacy/current coexistence, derived-state difference, competing enrichment/monetary/history behavior, actual divergence, or materially unresolved authority. Ordinary JSX, generic utilities, and harmless formatting repetition are excluded.

## 3. Summary Table

| ID | Concept | Classification | Canonical authority | Other locations | Behavior relationship | Severity | Drift risk | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARCH-DEBT-001 | Extended reproductive recovery duration | RESOLVED (was DUPLICATE) | lifecycle constant | breeding eligibility gate | EQUIVALENT (365 hours) | RESOLVED | RESOLVED | HIGH |
| ARCH-DEBT-002 | Gameplay balance/ledger mutation authority | UNKNOWN | no universal authority established | feature transaction writers | PARTIALLY OVERLAPPING | CRITICAL | VERY HIGH | HIGH |
| ARCH-DEBT-003 | Game-year duration used in player age display | DUPLICATE | `SHOW_YEAR_HOURS` | studs/planner local `365` arithmetic | EQUIVALENT today | LOW | MODERATE | HIGH |
| ARCH-DEBT-004 | Current title display/source of truth | UNKNOWN | title/credit services for progression | Dog visible title/progress fields | UNKNOWN | HIGH | HIGH | MEDIUM |
| ARCH-DEBT-005 | Current support subscription bulk selection | UNKNOWN | `getCanonicalSupportSubscription` | community bulk resolver | PARTIALLY OVERLAPPING | MEDIUM | HIGH | MEDIUM |
| ARCH-DEBT-006 | Dog/show complex read authority | UNKNOWN | no single path established | services/mappers/direct server Prisma | PARTIALLY OVERLAPPING | MEDIUM | HIGH | HIGH |
| ARCH-DEBT-007 | PLAYER_STUD historical linkage | LEGACY | StudOffer/StudContract services | retained listing/attempt linkage | INTENTIONALLY DIFFERENT | INFO | LOW | HIGH |

## 4. Search Coverage

| Search area | Result |
| --- | --- |
| Show eligibility; judging recheck; dog/planner UI | no meaningful finding; entry and judging are protected variants |
| Breeding eligibility; post-whelp recovery | ARCH-DEBT-001 resolved; other biological/contract distinctions are variants |
| Dog age/lifecycle; clock/calendar | ARCH-DEBT-003; local age display is otherwise presentation or event-time variant |
| Visible categories; health labels/eligibility | no confirmed competing business rule; display/judging and phenotype/brucellosis differ intentionally |
| Grooming; market; ownership; kennel runs/bulk actions | no confirmed semantic divergence; action-stage variants retained |
| Balance/ledger; entry cost | ARCH-DEBT-002; no independent UI cost calculation confirmed |
| Points, titles, prestige, show finalization | ARCH-DEBT-004; no second production finalizer found |
| Support selector/badge | ARCH-DEBT-005; badge remains presentation-only |
| Stud contracts | ARCH-DEBT-007; legacy retained, not current authority |
| Scheduled progression/idempotency | no same-operation competing progression writer confirmed |
| Community enrichment; unread state | no debt; batch enrichment and notice/conversation counts are distinct variants |
| Breed release; DTO/hidden data | no meaningful finding established from static sweep |
| Error/API response/copy/formatting | styles are inconsistent but no material behavioral contradiction established |

## ARCH-DEBT-001 — Extended Reproductive Recovery Duration

### Classification

**RESOLVED (formerly DUPLICATE).** `REPRODUCTIVE_EMERGENCY_EXTENDED_RECOVERY_HOURS` is the canonical named simulation duration and the breeding eligibility gate now consumes it directly.

### Owning domain

Breeding; Health & Care; Lifecycle.

### Concept

The duration of extended reproductive recovery after a resolved reproductive emergency.

### Canonical authority

`packages/rules/constants/lifecycle.constants.ts:REPRODUCTIVE_EMERGENCY_EXTENDED_RECOVERY_HOURS`; server breeding eligibility is the authoritative mutation gate that should consume that value.

### Occurrences

- **Location:** `packages/rules/constants/lifecycle.constants.ts`; **function/service:** named constant; **purpose:** defines 365-hour extended recovery; **classification:** CANONICAL; **inputs/outputs:** no runtime inputs → duration; **role:** rule input; **evidence:** named lifecycle constant.
- **Location:** `apps/web/server/services/breedingEligibility.service.ts`; **function/service:** `getIndividualBreedingEligibility`; **purpose:** computes next eligible epoch; **classification:** CANONICAL CONSUMER; **inputs/outputs:** reproductive consequence/resolved epoch + named lifecycle duration → recovery eligibility; **role:** authoritative server validation; **evidence:** consumes `REPRODUCTIVE_EMERGENCY_EXTENDED_RECOVERY_HOURS` for `EXTENDED_RECOVERY`.

### Behavior comparison

**EQUIVALENT:** behavior remains 365 game hours. The independent literal no longer exists in this eligibility gate.

### Intent analysis

Canonicalization confirmed: the gate consumes the existing named lifecycle rule.

### Current consumers

Breeding creation, dog/planner eligibility presentation, stud/contract flows that consume breeding eligibility.

### Persistence impact

CURRENT_STATE and IRREVERSIBLE_MUTATION: it controls whether a dam can create a later breeding attempt.

### Player impact

Could incorrectly permit or deny breeding after an extended recovery rule change.

### Severity

RESOLVED (former HIGH).

### Drift risk

RESOLVED.

### Test coverage

`apps/web/scripts/testReproductiveEmergencyEligibility.ts` derives both extended-recovery boundary assertions from the named constant.

### Evidence

Rules lifecycle constants, breeding eligibility source, and focused boundary regression.

### Confidence

HIGH.

### Later-stage question

Resolved: the server eligibility gate consumes the named lifecycle constant.

## ARCH-DEBT-002 — Gameplay Balance and Ledger Mutation Authority

### Classification

**UNKNOWN**. Feature-local writers are current production authorities for their own operations, but no universal balance/ledger authority or complete ledger invariant was established.

### Owning domain

Economy & Ledger, with Market, Showing, Breeding, Health & Care, Grooming, and Kennel Services as writers.

### Concept

The shared responsibility for mutating `Kennel.balance`, calculating `balanceAfter`, and recording `LedgerTransaction` history.

### Canonical authority

No single canonical helper/service established. Feature transaction services are authoritative for their local mutation: show entry, health, market/foundation purchase, breeding, grooming, care, rehome, kennel service, and repair paths.

### Occurrences

- **Location:** `showEntry.service.ts`; **function/service:** single/bulk entry writers; **purpose:** debit fees and write entry/ledger rows; **classification:** CANONICAL for show entry; **inputs/outputs:** quotes/kennel/entries → balance, ledger, entries; **role:** transactional mutation; **evidence:** transaction and bulk `ledgerTransaction.createMany`.
- **Location:** `healthTest.service.ts` and `infectiousDisease.service.ts`; **function/service:** test mutations; **purpose:** debit test costs/write records; **classification:** CANONICAL for health testing; **role:** transactional mutation; **evidence:** single and bulk health paths co-persist balance, records, and ledger history through Health-domain transactions.
- **Location:** `market.service.ts`, `foundationDog.service.ts`, `breeding.service.ts`, `grooming.service.ts`, `emergencyVetCare.service.ts`, `reproductiveEmergencyTreatment.service.ts`, `rehome.service.ts`, `kennelService.service.ts`; **purpose:** feature-local debits/credits; **classification:** UNKNOWN as a common accounting pattern; **role:** transactional mutation; **evidence:** materially different set/increment balance updates and feature-specific ledger handling.
- **Location:** `year13RegularShowRepair.service.ts`; **purpose:** historical repair; **classification:** LEGACY/operational variant; **role:** transaction writer; **evidence:** direct balance update in repair service.

### Behavior comparison

**PARTIALLY OVERLAPPING**: all modify the same durable balance, but update form, ledger construction, and source references vary. Static inspection does not prove a missing ledger row or incorrect sign in any specific path.

### Intent analysis

Feature-local monetary semantics may be intentional. A shared `economy.service` authority was not found, so a universal pattern is **UNKNOWN**.

### Current consumers

Market, show entry, breeding/stud, health/care, grooming, kennel services, rehome, ledger UI, and account closure/repair operations.

### Persistence impact

FINANCIAL and IRREVERSIBLE_MUTATION.

### Player impact

Potential balance/history inconsistency could affect purchases, entry, care, and player ledger trust if writers drift.

### Severity

CRITICAL.

### Drift risk

VERY HIGH.

### Test coverage

Focused market, show entry, support, health, grooming, breeding, and care scripts exist; no repository-wide balance/ledger invariant test was established.

### Evidence

Direct inventory of `Kennel.balance` writers; Stage 3/4/5 registries; visible Prisma transactions. The former single-brucellosis route/service split was canonicalized in Stage 10C; broader writer authority remains unresolved.

### Confidence

HIGH for writer spread; MEDIUM for any assertion about individual ledger omissions.

### Later-stage question

What common balance/ledger invariants, if any, do all current gameplay money writers intentionally share?

## ARCH-DEBT-003 — Game-Year Duration in Player Age Presentation

### Classification

`SHOW_YEAR_HOURS` is **CANONICAL** for named game-year duration; local `365` age arithmetic is a **DUPLICATE** presentation implementation.

### Owning domain

Calendar & Game Time; Dogs; Breeding.

### Concept

Converting dog age hours into game years/days or game years/weeks for player display.

### Canonical authority

`packages/rules/constants/time.constants.ts:SHOW_YEAR_HOURS` and game-time helpers. No single age-label presentation helper is established.

### Occurrences

- **Location:** rules time constants; **function/service:** `SHOW_YEAR_HOURS`; **purpose:** named 365-hour game year; **classification:** CANONICAL; **role:** rule constant.
- **Location:** `app/studs/page.tsx`; **function/component:** `ageLabel`; **purpose:** player age years/days; **classification:** DUPLICATE/PRESENTATION; **inputs/outputs:** age hours → label; **evidence:** local divide/modulo `365`.
- **Location:** `programPlanner.service.ts`; **function/service:** local age label; **purpose:** planner years/weeks; **classification:** DUPLICATE/PRESENTATION; **evidence:** local divide/modulo `365` and `7`.

### Behavior comparison

**EQUIVALENT** today. The formats intentionally differ (days versus weeks); the duration literal is the shared drift surface.

### Intent analysis

Presentation format variance is intentional; literal copying is not explained.

### Current consumers

Stud discovery and program planner surfaces.

### Persistence impact

NONE.

### Player impact

Could display an incorrect game age if the calendar duration changes.

### Severity

LOW.

### Drift risk

MODERATE.

### Test coverage

`testGameTimeFormat` exists; coverage for these local labels against `SHOW_YEAR_HOURS` is **UNKNOWN**.

### Evidence

Rules time constant and direct literal searches in player/planner code.

### Confidence

HIGH.

### Later-stage question

Should player age-label surfaces consume a shared duration/helper while retaining format-specific output?

## ARCH-DEBT-004 — Dog Title Display Source of Truth

### Classification

**UNKNOWN**.

### Owning domain

Championships, Titles & Prestige; Dogs.

### Concept

Whether current player-visible Dog title prefix/suffix and producer summaries are primary current truth, synchronized caches, or presentation derived from title progress, awards, credits, and producer merit.

### Canonical authority

Title progression mutation authority is `titleProgress.service` with grand-champion/credit services during judging finalization. Persistence includes `DogTitleProgress`, credit/award records, and visible fields on `Dog`. No single display authority established.

### Occurrences

- **Location:** `titleProgress.service.ts`, `grandChampion.service.ts`; **purpose:** compute/apply title progression; **classification:** CANONICAL for progression; **role:** mutation/calculation; **evidence:** judging calls progression paths.
- **Location:** `DogTitleProgress`, award/credit records; **purpose:** persisted progression/history; **classification:** CANONICAL/DERIVED relationship UNKNOWN; **role:** current/historical state.
- **Location:** visible Dog title/producer fields and dog mapper/profile; **purpose:** player display; **classification:** UNKNOWN cache or PRESENTATION; **role:** read/presentation; **evidence:** fields coexist with progress records.

### Behavior comparison

**UNKNOWN**: static inspection establishes coexistence but not synchronization/rebuild semantics.

### Intent analysis

Likely current-summary/history distinction, but cache purpose is not proven.

### Current consumers

Dog profiles/show records, ribbon room, producer merit, notices, judging finalization.

### Persistence impact

HISTORICAL_STATE and CURRENT_STATE.

### Player impact

Could show incorrect titles/merit or cause confusion after finalization if paths drift.

### Severity

HIGH.

### Drift risk

HIGH.

### Test coverage

Dog-title, title-notice, grand-champion, prestige, and show-record scripts exist; cross-store synchronization coverage is **UNKNOWN**.

### Evidence

Stage 3 data audit and Stage 4 title registry; schema Dog/title/credit models; judging service dependency chain.

### Confidence

MEDIUM.

### Later-stage question

Which persisted title/producer fields are current authoritative summaries versus replaceable display caches?

## ARCH-DEBT-005 — Current Support Subscription Selection in Batch Presentation

### Classification

**UNKNOWN**.

### Owning domain

Support; Community.

### Concept

Selecting one current support subscription for an individual versus a Community batch before deriving supporter badges.

### Canonical authority

`supportSubscription.service:getCanonicalSupportSubscription` is the individual current-subscription authority used by account/support/public-kennel surfaces and support lifecycle work.

### Occurrences

- **Location:** `supportSubscription.service.ts:getCanonicalSupportSubscription`; **purpose:** resolve current PayPal subscription across eligible records/changes; **classification:** CANONICAL; **inputs/outputs:** user/current subscription/change rows → one subscription/null; **role:** authoritative read.
- **Location:** `communitySupporterBadge.service.ts:getCommunitySupporterBadgePresentations`; **purpose:** batch select subscription plus kennel preference for Community author badges; **classification:** UNKNOWN/DERIVED; **inputs/outputs:** user IDs/batch records/changes → badge map; **role:** presentation enrichment; **evidence:** independent `findMany` filters and change resolution.
- **Location:** support sandbox/test and former-subscription page queries; **purpose:** test/history selection; **classification:** INTENTIONAL VARIANT; **role:** non-production or historical read.

### Behavior comparison

**PARTIALLY OVERLAPPING**. Both target current PayPal support state, but the batch resolver implements selection with its own set query and change handling. Equivalence for all upgrade/cancellation edge cases was not established.

### Intent analysis

Batching may require a distinct implementation; no test proving parity with individual canonical resolution was found in the inspected code.

### Current consumers

Community bulletin author identity, account/support/public kennel pages, support lifecycle services.

### Persistence impact

READ_ONLY.

### Player impact

Could show an inconsistent supporter badge between Community and account/public-kennel surfaces; it does not change subscription truth or gameplay eligibility.

### Severity

MEDIUM.

### Drift risk

HIGH.

### Test coverage

Badge presentation/community mapping and support lifecycle scripts exist. Parity coverage between the two selectors is **UNKNOWN**.

### Evidence

Direct selector inventory, community batch service, canonical support service, and Stage 4 support registry.

### Confidence

MEDIUM.

### Later-stage question

Does the Community batch resolver produce identical current-subscription selection to `getCanonicalSupportSubscription` for upgrades, paid-through cancellations, and former supporters?

## ARCH-DEBT-006 — Distributed Dog and Show Read Models

### Classification

**UNKNOWN**.

### Owning domain

Dogs; Showing; Judging; presentation surfaces.

### Concept

Complex player read models are assembled through dedicated services/mappers and also direct server-component Prisma queries with local shaping.

### Canonical authority

No single authoritative read path established. `dog.service:getDogProfile` plus dog mapper is a strong Dog precedent; show pages directly combine `db` reads with schedule/availability/service helpers.

### Occurrences

- **Location:** `dog.service.ts:getDogProfile` and `server/mappers/dog.mapper.ts`; **purpose:** player-safe Dog profile; **classification:** AUTHORITATIVE READ precedent; **role:** service/mapper.
- **Location:** `app/shows/page.tsx`; **purpose:** show collection/read model; **classification:** UNKNOWN direct server-component read; **role:** Prisma plus service/rules shaping; **evidence:** imports `db` and several services/rules.
- **Location:** named litter/show mappers and feature-local DTO code; **purpose:** surface-specific presentation; **classification:** DERIVED/PRESENTATION; **role:** read shaping.

### Behavior comparison

**PARTIALLY OVERLAPPING**. They solve player read-model construction with different boundaries, not the same exact DTO.

### Intent analysis

Server-component direct reads are an accepted Next.js pattern; whether any specific surface should reuse a mapper/service is **UNKNOWN**.

### Current consumers

Dog pages/API, show pages, kennel/player collections, market/litter results.

### Persistence impact

READ_ONLY.

### Player impact

Could create inconsistent status/field exposure or performance drift across surfaces, without proving a current defect.

### Severity

MEDIUM.

### Drift risk

HIGH.

### Test coverage

Focused dog/show/read-model scripts exist; cross-surface DTO parity coverage is **UNKNOWN**.

### Evidence

Stage 1 system flow; Stage 4/5 registry; direct `/shows` page and mapper/service directories.

### Confidence

HIGH for distributed topology; MEDIUM for any specific drift consequence.

### Later-stage question

Which high-risk player fields require a shared read/mapping authority, while preserving intentional direct server-component reads?

## ARCH-DEBT-007 — Historical PLAYER_STUD Listing and Attempt Linkage

### Classification

**LEGACY**.

### Owning domain

Stud Services & Contracts; Market; Breeding.

### Concept

Historical PLAYER_STUD listing and `BreedingAttempt.studListingId` linkage retained after the current StudOffer/StudContract architecture.

### Canonical authority

Current public stud/contract authority is StudOffer/StudContract services and persisted models. Historical listing/attempt linkage is not current contract authority.

### Occurrences

- **Location:** current StudOffer/StudContract services/models; **purpose:** current commercial stud lifecycle; **classification:** CANONICAL; **role:** mutation/read authority.
- **Location:** historical DogListing/attempt linkage and legacy compatibility tests; **purpose:** preserve cancelled/historical PLAYER_STUD context; **classification:** LEGACY; **role:** historical read compatibility; **evidence:** Stage 3 requirement and `testStudContractLegacyAbsence`/transfer-compatibility scripts.

### Behavior comparison

**INTENTIONALLY DIFFERENT**: current contracts use dedicated records; legacy fields preserve prior history.

### Intent analysis

Legacy compatibility is explicitly documented by the Stage 3 audit task and regression naming; no removal/change was made.

### Current consumers

Contract history, market transfer compatibility, historical attempts/listings, regression scripts.

### Persistence impact

HISTORICAL_STATE.

### Player impact

Risk arises only if future code mistakes legacy linkage for current contract authority or deletes historical context.

### Severity

INFO.

### Drift risk

LOW.

### Test coverage

Stud contract legacy absence and sale/stud transfer compatibility scripts.

### Evidence

Stage 3 persistence audit, current contract services, legacy-focused regression scripts.

### Confidence

HIGH.

### Later-stage question

Which historical screens or reports still intentionally consume PLAYER_STUD linkage, if any?

## Protected Intentional Variants

| Concept | Variant A | Variant B | Why difference is intentional | Evidence | Risk if accidentally unified |
| --- | --- | --- | --- | --- | --- |
| Show eligibility | entry-time gate | judging-time disposition | state can change before scheduled event | show-entry and judging services | invalid entries/results |
| Breeding | biological eligibility | contract/offer eligibility | commercial terms/parties/health differ | breeding and stud services | invalid contract or breeding |
| Market | player sale | foundation inventory purchase | seller/inventory lifecycle differs | market/foundation services | invalid transfer/inventory |
| Health testing | phenotype test | brucellosis test | disease validity/transmission workflow differs | health/infectious services | incorrect test outcome/gate |
| Unread | conversation state | notice read/dismiss state | separate durable objects and semantics | messaging/notice services | incorrect inbox counts |
| Visible phenotype | player categories | judging characteristics | presentation and competition consumers differ | rules/service paths/tests | distorted display or judging |

## Legacy Compatibility Register

| Concept | Legacy implementation/state | Current authority | Why retained | May new code depend on it? | Confidence |
| --- | --- | --- | --- | --- | --- |
| PLAYER_STUD linkage | DogListing/attempt historical linkage | StudOffer/StudContract | preserve historical cancelled/attempt context | NO | HIGH |
| Year 13 repair path | `year13RegularShowRepair.service` | ordinary show/judging services | historical repair operation | NO | MEDIUM |

## Unresolved Authority Register

| Concept | Competing locations | Why authority is unresolved | Risk | Required later investigation |
| --- | --- | --- | --- | --- |
| Economy/ledger mutation | feature-local writers | no universal helper/invariant established | VERY HIGH | compare each balance update and ledger expectation |
| Dog title display | Dog fields, progress, awards, credits | cache/primary relationship unknown | HIGH | trace all writers/readers/synchronization |
| Support batch current selector | canonical service, community batch resolver | parity not established | HIGH | test edge-case selector parity |
| Dog/show reads | services/mappers/direct server Prisma | multiple valid read styles | HIGH | identify high-risk field contracts |
| Current epoch helper | lib game clock and rules time helper | production call authority differs | HIGH | trace non-production and deployment consumers |

## Architecture Debt Summary

### Counts by classification

| Classification | Count |
| --- | --- |
| RESOLVED (former DUPLICATE) | 1 |
| DUPLICATE | 1 |
| UNKNOWN | 3 |
| LEGACY | 1 |
| DIVERGENT | 0 |

### Counts by severity

| Severity | Count |
| --- | --- |
| CRITICAL | 1 |
| HIGH | 2 |
| MEDIUM | 2 |
| LOW | 1 |
| INFO | 1 |
| RESOLVED (former HIGH) | 1 |

### Counts by owning domain

| Domain | Findings |
| --- | --- |
| Economy & Ledger | 1 |
| Breeding / Health & Care / Lifecycle | 1 (resolved) |
| Calendar / Dogs | 1 |
| Championships / Dogs | 1 |
| Support / Community | 1 |
| Dogs / Showing | 1 |
| Stud Services / Market / Breeding | 1 |

### Highest-risk findings

- **ARCH-DEBT-002:** feature-local balance writers can drift in financial history/transaction invariants because no shared authority is established.
- **ARCH-DEBT-004:** title display/cache authority is unresolved across historical and current title state.

### Broadest drift surfaces

Economy/ledger mutation spans the most independently implemented writers. Dog/title presentation and Dog/show read-model construction also span multiple services, persistence models, pages, and presentation layers. Support current-state selection spans individual and batch presentation paths.

This register intentionally contains no remediation plan, refactor steps, or implementation prescription.
