# ShowRing Architecture Debt Register

## 1. Purpose

This diagnostic register records evidence-backed duplicate, divergent, legacy, and unresolved implementation paths discovered during Stage 6. It is not a refactor plan and does not authorize gameplay changes. Repeated code appears only when architecturally meaningful; protected intentional variants are included to prevent accidental consolidation. Later cleanup stages may use this evidence to choose surgical canonicalization work.

## 2. Finding Standard

A finding requires a materially repeated/disputed business rule, durable mutation responsibility, independent eligibility reconstruction, legacy/current coexistence, derived-state difference, competing enrichment/monetary/history behavior, actual divergence, or materially unresolved authority. Ordinary JSX, generic utilities, and harmless formatting repetition are excluded.

## 3. Summary Table

| ID | Concept | Classification | Canonical authority | Other locations | Behavior relationship | Severity | Drift risk | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARCH-DEBT-001 | Extended reproductive recovery duration | RESOLVED — CANONICALIZED (was DUPLICATE) | lifecycle constant | breeding eligibility gate | EQUIVALENT (365 hours) | RESOLVED | RESOLVED | HIGH |
| ARCH-DEBT-002 | Gameplay balance/ledger mutation authority | OPEN — BOUNDED ARCHITECTURE QUESTION (was UNKNOWN) | established invariants; no universal writer | feature transaction writers | INTENTIONAL DOMAIN VARIANTS | CRITICAL | VERY HIGH | HIGH |
| ARCH-DEBT-003 | Game-year duration used in player age display | RESOLVED — CANONICALIZED (was DUPLICATE) | `SHOW_YEAR_HOURS` | studs/planner age presentation | EQUIVALENT (365 hours) | RESOLVED | RESOLVED | HIGH |
| ARCH-DEBT-004 | Current title display/source of truth | OPEN — BOUNDED ARCHITECTURE QUESTION (was UNKNOWN) | current title progress, historical awards/credits, presentation mirror | Dog visible title/progress fields | ESTABLISHED WITH BOUNDED QUESTIONS | HIGH | HIGH | HIGH |
| ARCH-DEBT-005 | Current support subscription bulk selection | RESOLVED — CANONICALIZED (was UNKNOWN) | Support current-state predicate | Community batched presentation resolver | EQUIVALENT (read-only batch) | RESOLVED | RESOLVED | HIGH |
| ARCH-DEBT-006 | Dog/show complex read authority | RESOLVED — NO CANONICALIZATION REQUIRED (was UNKNOWN) | established field contracts; no universal read authority required | services/mappers/direct server Prisma | INTENTIONAL VARIANTS | RESOLVED | RESOLVED | HIGH |
| ARCH-DEBT-007 | PLAYER_STUD historical linkage | LEGACY — PRESERVE / DO NOT EXTEND | StudOffer/StudContract services | retained listing/attempt linkage | INTENTIONALLY DIFFERENT | INFO | LOW | HIGH |

## 4. Search Coverage

| Search area | Result |
| --- | --- |
| Show eligibility; judging recheck; dog/planner UI | no meaningful finding; entry and judging are protected variants |
| Breeding eligibility; post-whelp recovery | ARCH-DEBT-001 resolved; other biological/contract distinctions are variants |
| Dog age/lifecycle; clock/calendar | ARCH-DEBT-003 resolved; remaining age display is presentation or event-time variant |
| Visible categories; health labels/eligibility | no confirmed competing business rule; display/judging and phenotype/brucellosis differ intentionally |
| Grooming; market; ownership; kennel runs/bulk actions | no confirmed semantic divergence; action-stage variants retained |
| Balance/ledger; entry cost | ARCH-DEBT-002; no independent UI cost calculation confirmed |
| Points, titles, prestige, show finalization | ARCH-DEBT-004; no second production finalizer found |
| Support selector/badge | ARCH-DEBT-005 resolved; badge remains presentation-only |
| Stud contracts | ARCH-DEBT-007; legacy retained, not current authority |
| Scheduled progression/idempotency | no same-operation competing progression writer confirmed |
| Community enrichment; unread state | no debt; batch enrichment and notice/conversation counts are distinct variants |
| Breed release; DTO/hidden data | no meaningful finding established from static sweep |
| Error/API response/copy/formatting | styles are inconsistent but no material behavioral contradiction established |

## ARCH-DEBT-001 — Extended Reproductive Recovery Duration

### Classification

**Status: RESOLVED — CANONICALIZED.** **Original classification: DUPLICATE.** `REPRODUCTIVE_EMERGENCY_EXTENDED_RECOVERY_HOURS` is the canonical named simulation duration and the breeding eligibility gate now consumes it directly.

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

**Status: OPEN — BOUNDED ARCHITECTURE QUESTION.** **Original classification: UNKNOWN.** Feature-local writers remain current production authorities. Stage 10 established signed per-kennel ledger amounts, logical post-effect `balanceAfter`, normal business/balance/ledger co-persistence, paired player transfers, recipient-only faucets, and payer-only sinks; it did not establish one universal writer, idempotency mechanism, or balance assertion abstraction.

### Owning domain

Economy & Ledger, with Market, Showing, Breeding, Health & Care, Grooming, and Kennel Services as writers.

### Concept

The shared responsibility for mutating `Kennel.balance`, calculating `balanceAfter`, and recording `LedgerTransaction` history.

### Canonical authority

No universal helper/service is established or required by current evidence. Feature transaction services are authoritative for their local mutation and must preserve the documented accounting invariants.

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

Future feature work should preserve established accounting invariants and address a demonstrated inconsistency locally; it does not authorize a universal Economy/Ledger writer, universal idempotency mechanism, or universal `balanceAfter` assertion layer.

## ARCH-DEBT-003 — Game-Year Duration in Player Age Presentation

### Classification

**Status: RESOLVED — CANONICALIZED.** **Original classification: DUPLICATE.** `SHOW_YEAR_HOURS` is the canonical named game-year duration, and both player age-label surfaces consume it directly.

### Owning domain

Calendar & Game Time; Dogs; Breeding.

### Concept

Converting dog age hours into game years/days or game years/weeks for player display.

### Canonical authority

`packages/rules/constants/time.constants.ts:SHOW_YEAR_HOURS` and game-time helpers. No single age-label presentation helper is established.

### Occurrences

- **Location:** rules time constants; **function/service:** `SHOW_YEAR_HOURS`; **purpose:** named 365-hour game year; **classification:** CANONICAL; **role:** rule constant.
- **Location:** `app/studs/page.tsx`; **function/component:** `ageLabel`; **purpose:** player age years/days; **classification:** CANONICAL CONSUMER/PRESENTATION; **inputs/outputs:** age hours → label; **evidence:** divide/modulo `SHOW_YEAR_HOURS`.
- **Location:** `programPlanner.service.ts`; **function/service:** local age label; **purpose:** planner years/weeks; **classification:** CANONICAL CONSUMER/PRESENTATION; **evidence:** divide/modulo `SHOW_YEAR_HOURS` and `7`.

### Behavior comparison

**EQUIVALENT (365 hours).** The formats intentionally differ (days versus weeks) and remain format-specific; their shared duration now has one authority.

### Intent analysis

Presentation format variance is intentional; the duration literal is now canonicalized.

### Current consumers

Stud discovery and program planner surfaces.

### Persistence impact

NONE.

### Player impact

Could display an incorrect game age if the calendar duration changes.

### Severity

RESOLVED (former LOW).

### Drift risk

RESOLVED.

### Test coverage

`testGameTimeFormat` verifies both source consumers and below/exact/after-year boundaries while retaining days versus weeks.

### Evidence

Rules time constant, direct source imports, focused game-time format regression, and target literal search.

### Confidence

HIGH.

### Later-stage question

RESOLVED: retain format-specific output while consuming the shared duration constant.

## ARCH-DEBT-004 — Dog Title Display Source of Truth

### Classification

**Status: OPEN — BOUNDED ARCHITECTURE QUESTION.** **Original classification: UNKNOWN.** Current semantic CH/GCH authority, historical award/credit authority, the synchronized prefix presentation mirror, and compatibility fallbacks are established. Remaining questions are limited to legacy reconciliation, completion metadata, historical current-name presentation, and producer suffix scope.

### Owning domain

Championships, Titles & Prestige; Dogs.

### Concept

Whether current player-visible Dog title prefix/suffix and producer summaries are primary current truth, synchronized caches, or presentation derived from title progress, awards, credits, and producer merit.

### Canonical authority

`DogTitleProgress.currentTitleCode` is the current semantic CH/GCH authority; `ShowAward`, `ShowResult`, and GCH credits are historical authority; `Dog.visibleTitlePrefix` is a synchronized presentation mirror; and existing compatibility fallbacks remain required. The remaining bounded questions do not establish a title-system refactor.

### Occurrences

- **Location:** `titleProgress.service.ts`, `grandChampion.service.ts`; **purpose:** compute/apply title progression; **classification:** CANONICAL for progression; **role:** mutation/calculation; **evidence:** judging calls progression paths.
- **Location:** `DogTitleProgress`, award/credit records; **purpose:** persisted progression/history; **classification:** CANONICAL/DERIVED relationship UNKNOWN; **role:** current/historical state.
- **Location:** visible Dog title/producer fields and dog mapper/profile; **purpose:** player display; **classification:** UNKNOWN cache or PRESENTATION; **role:** read/presentation; **evidence:** fields coexist with progress records.

### Behavior comparison

**UNKNOWN**: static inspection establishes coexistence but not synchronization/rebuild semantics.

### Intent analysis

The current semantic, historical, mirror, and compatibility roles are established. Legacy reconciliation policy, completion metadata authority, historical current-name presentation, and producer suffix scope require a concrete feature, migration, reconciliation need, or explicit design decision.

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

Stage 3 data audit and Stage 4 title registry; schema Dog/title/credit models; judging service dependency chain; [title-source-of-truth-audit.md](title-source-of-truth-audit.md); [title-prefix-presentation-contract.md](title-prefix-presentation-contract.md).

### Confidence

HIGH for the established authority model; MEDIUM for the bounded remaining questions.

### Later-stage question

Preserve the established title contracts and compatibility fallbacks. Address legacy reconciliation, completion metadata, historical current-name presentation, or producer suffix scope only through a concrete feature, migration, reconciliation need, or explicit design decision; do not recalculate titles or remove fallbacks as generic cleanup.

## ARCH-DEBT-005 — Current Support Subscription Selection in Batch Presentation

### Classification

**Status: RESOLVED — CANONICALIZED.** **Original classification: UNKNOWN.** Community retains batched reads and now applies the shared Support current-state predicate after its equivalent source/target selection.

### Owning domain

Support; Community.

### Concept

Selecting one current support subscription for an individual versus a Community batch before deriving supporter badges.

### Canonical authority

`supportSubscription.service:getCanonicalSupportSubscription` remains the individual current-subscription authority. `isCurrentSupportSubscriptionAt` shares its elapsed scheduled-cancellation read rule with batched presentation without transferring lifecycle mutation ownership.

### Occurrences

- **Location:** `supportSubscription.service.ts:getCanonicalSupportSubscription`; **purpose:** resolve current PayPal subscription across eligible records/changes; **classification:** CANONICAL; **inputs/outputs:** user/current subscription/change rows → one subscription/null; **role:** authoritative read.
- **Location:** `communitySupporterBadge.service.ts:getCommunitySupporterBadgePresentations`; **purpose:** batch select subscription plus kennel preference for Community author badges; **classification:** CANONICAL CONSUMER/PRESENTATION; **inputs/outputs:** user IDs/batch records/changes → badge map; **role:** presentation enrichment; **evidence:** equivalent batched source/target selection followed by the shared current-state predicate.
- **Location:** support sandbox/test and former-subscription page queries; **purpose:** test/history selection; **classification:** INTENTIONAL VARIANT; **role:** non-production or historical read.

### Behavior comparison

**EQUIVALENT (read-only batch).** Community preserves batched query/change selection and applies the shared elapsed-cancellation read rule; actual cancellation finalization remains in Support lifecycle services.

### Intent analysis

Batching is an intentional implementation variant. The focused regression covers the shared current-state boundary and preserves set-based Community enrichment.

### Current consumers

Community bulletin author identity, account/support/public kennel pages, support lifecycle services.

### Persistence impact

READ_ONLY.

### Player impact

No remaining audited current-selection inconsistency. The batch path remains presentation-only and does not change subscription truth or gameplay eligibility.

### Severity

RESOLVED (former MEDIUM).

### Drift risk

RESOLVED.

### Test coverage

Badge presentation/community mapping and Support lifecycle scripts cover the shared elapsed-cancellation current-state rule and no-N+1 batch shape.

### Evidence

Support batch parity audit, shared predicate, Community batch regression, canonical lifecycle regression, and paid-through-expiration regression.

### Confidence

MEDIUM.

### Later-stage question

RESOLVED: Community now matches canonical current-state selection read-only while preserving batched I/O; Support lifecycle services retain persisted finalization.

## ARCH-DEBT-006 — Distributed Dog and Show Read Models

### Classification

**Status: RESOLVED — NO CANONICALIZATION REQUIRED.** **Original classification: UNKNOWN.** Field-contract investigation found no concrete same-fact semantic drift, hidden-data leak, historical misuse, or material N+1 defect.

### Owning domain

Dogs; Showing; Judging; presentation surfaces.

### Concept

Complex player read models are assembled through dedicated services/mappers and also direct server-component Prisma queries with local shaping.

### Canonical authority

No universal Dog or Show read authority is required. Existing field contracts remain authoritative where applicable: Dog display/title compatibility, visible categories, health interpretation, show availability, and durable result/award facts. `dog.service:getDogProfile` plus the dog mapper and direct Show page reads are legitimate surface-specific variants.

### Occurrences

- **Location:** `dog.service.ts:getDogProfile` and `server/mappers/dog.mapper.ts`; **purpose:** player-safe Dog profile; **classification:** ACCEPTED service/mapper read; **role:** surface-specific read composition.
- **Location:** `app/shows/page.tsx`; **purpose:** show collection/read model; **classification:** ACCEPTED direct server-component read; **role:** Prisma plus service/rules shaping.
- **Location:** named litter/show mappers and feature-local DTO code; **purpose:** surface-specific presentation; **classification:** ACCEPTED mapper/local shaping; **role:** read shaping.

### Behavior comparison

**INTENTIONAL VARIANTS**. They solve surface-specific player read construction with different boundaries, not the same exact DTO, while retaining narrow shared field contracts where the same fact requires one.

### Intent analysis

Direct Server Component Prisma reads, services, mappers, and narrow presentation/semantic helpers are legitimate current variants. The audit found no evidence that their coexistence creates a competing read authority.

### Current consumers

Dog pages/API, show pages, kennel/player collections, market/litter results.

### Persistence impact

READ_ONLY.

### Player impact

No concrete status/field exposure, historical interpretation, or material performance defect was found. Future work should act only on a demonstrated field-level defect.

### Severity

RESOLVED (formerly MEDIUM).

### Drift risk

RESOLVED.

### Test coverage

The field-contract audit found no defect requiring cross-surface DTO parity. Existing focused dog/show/read-model scripts remain relevant to concrete future changes.

### Evidence

Stage 1 system flow; Stage 4/5 registry; direct `/shows` page and mapper/service directories; [read-model-field-contract-audit.md](read-model-field-contract-audit.md).

### Confidence

HIGH.

### Later-stage question

Future changes should preserve established field contracts and address concrete defects locally; this finding does not authorize a universal Dog/Show read service, repository, CQRS layer, or other centralized read architecture.

## ARCH-DEBT-007 — Historical PLAYER_STUD Listing and Attempt Linkage

### Classification

**Status: LEGACY — PRESERVE / DO NOT EXTEND.** **Original classification: LEGACY.**

### Owning domain

Stud Services & Contracts; Market; Breeding.

### Concept

Historical PLAYER_STUD listing and `BreedingAttempt.studListingId` linkage retained after the current StudOffer/StudContract architecture.

### Canonical authority

Current public stud/contract authority is StudOffer/StudContract services and persisted models. PLAYER_STUD listing/attempt linkage is historical compatibility only; new runtime code must not use it as active commercial-stud truth.

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

Preserve historical linkage and its tests where needed. Do not delete, migrate, or extend PLAYER_STUD as active commercial-stud authority without a separately scoped migration/design decision.

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

## Architecture Debt Summary

### Counts by final Stage 10 status

| Status | Count |
| --- | --- |
| RESOLVED — CANONICALIZED | 3 |
| RESOLVED — NO CANONICALIZATION REQUIRED | 1 |
| OPEN — BOUNDED ARCHITECTURE QUESTION | 2 |
| LEGACY — PRESERVE / DO NOT EXTEND | 1 |

### Counts by severity

| Severity | Count |
| --- | --- |
| CRITICAL | 1 |
| HIGH | 2 |
| MEDIUM | 0 |
| LOW | 0 |
| INFO | 1 |
| RESOLVED (former HIGH) | 1 |
| RESOLVED (former LOW) | 1 |
| RESOLVED (former MEDIUM) | 2 |

### Counts by owning domain

| Domain | Findings |
| --- | --- |
| Economy & Ledger | 1 |
| Breeding / Health & Care / Lifecycle | 1 (resolved) |
| Calendar / Dogs | 1 (resolved) |
| Championships / Dogs | 1 |
| Support / Community | 1 (resolved) |
| Dogs / Showing | 1 (resolved) |
| Stud Services / Market / Breeding | 1 |

### Highest-risk findings

- **ARCH-DEBT-002:** feature-local balance writers can drift in financial history/transaction invariants because no shared authority is established.
- **ARCH-DEBT-004:** title display/cache authority is unresolved across historical and current title state.

### Broadest drift surfaces

Economy/ledger mutation spans the most independently implemented writers. Dog/title presentation also spans multiple services, persistence models, pages, and presentation layers. These are bounded architecture questions, not generalized refactor mandates.

This register intentionally contains no remediation plan, refactor steps, or implementation prescription.
