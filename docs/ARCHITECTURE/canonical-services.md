# ShowRing Canonical Service Registry

## 1. Purpose

This registry records major application-service authority and orchestration boundaries: which current path future implementation should inspect before adding another path. It does not claim every service is perfectly architected.

## 2. Service Authority Categories

**AUTHORITATIVE MUTATION**, **AUTHORITATIVE READ**, **ORCHESTRATOR**, **DOMAIN CALCULATION**, **BATCH RESOLVER**, **MAPPER/PRESENTATION BUILDER**, **INTEGRATION ADAPTER**, **CRON/PROGRESSION ENTRY**, **LEGACY**, and **UNKNOWN** are used below. A path may hold several categories.

## 3. Summary Table

| Domain | Capability | Current service/path | Authority category | Main callers | Important dependencies | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| Accounts | session/auth | lib auth/session; `auth.service` | AUTHORITATIVE READ, MUTATION | auth routes/pages | User, password reset | HIGH |
| Kennels | context lookup | `kennel.service:getKennelForUser` | AUTHORITATIVE READ | most player routes | User/Kennel | HIGH |
| Dogs | profile | `dog.service:getDogProfile`; dog mapper | AUTHORITATIVE READ, MAPPER | dog page/API | Prisma, neighboring read helpers | HIGH |
| Market | ownership transfer | `buyPlayerDogListing`, `buyFoundationDog`, rehome | AUTHORITATIVE MUTATION | market/litter APIs | Dog, Kennel, contract/care, transactions | HIGH |
| Breeding | creation/progression | `createBreedingAttemptForKennel`, `resolveDueBreedingProgressBatch` | MUTATION, BATCH RESOLVER | API, cron | eligibility, rules, litter/contracts | HIGH |
| Litters | whelp/persistence | litter persistence and bulk services | MUTATION, READ | breeding/litter APIs | Dog, kennel runs, market | HIGH |
| Stud | offers/contracts | offer/request/lifecycle/selection services | MUTATION, BATCH RESOLVER | APIs, cron, breeding | health, breeding, notices | HIGH |
| Health | single/bulk tests | healthTest and infectiousDisease services | MUTATION, DOMAIN CALCULATION | dog/kennel APIs | rules, Dog, transactions | HIGH |
| Care | emergency/reproductive | care/resolution/treatment services | MUTATION, BATCH RESOLVER | APIs, jobs | Dog, ledger, breeding | HIGH |
| Grooming | listing/accept/action | grooming service | MUTATION, READ | APIs/jobs/dog UI | Dog, care, ledger | HIGH |
| Foundation | inventory/purchase | foundationDog service | ORCHESTRATOR, MUTATION | market API/cron | breed/genetics/market | HIGH |
| Showing | schedule | showSchedule service | MUTATION, BATCH RESOLVER | routes/jobs/pages | calendar, Prisma | HIGH |
| Showing | entry | showEntry service | MUTATION, READ, CALCULATION | APIs/planner | eligibility, economy, Dog | HIGH |
| Judging | evaluation/finalization | judging + publish job services | ORCHESTRATOR, MUTATION, BATCH | cron/jobs | rules, results, titles | HIGH |
| Titles | points/progression | title/grandChampion/prestige services | MUTATION, CALCULATION | judging/results UI | awards, schedules | HIGH |
| Community | bulletin/feed | bulletin service | MUTATION, READ | community APIs/pages | notices/badges | HIGH |
| Messaging | messages/unread | kennelMessaging and notice services | MUTATION, READ | inbox/notices APIs/header | Kennel, moderation | HIGH |
| Support | lifecycle/current selection | supportSubscription service | MUTATION, READ, INTEGRATION | APIs/pages/webhook | PayPal, Support models | HIGH |
| Support | badge batch | community badge service | MAPPER/PRESENTATION BUILDER | bulletin service | canonical resolver/preference | HIGH |
| Art | funding/payments | art campaign/payment/finalization services | MUTATION, INTEGRATION, BATCH | APIs/webhook/cron | PayPal, Art models | HIGH |
| Economy | balance/ledger | feature transaction writers | UNKNOWN | market/show/breeding/care/grooming | Kennel/Ledger | MEDIUM |
| Lifecycle | mortality | lifecycle service | MUTATION, BATCH RESOLVER | cron, breeding | Dog, notices/contracts | HIGH |
| Calendar | current epoch | `lib/gameClock` | DOMAIN CALCULATION | services/jobs/pages | Date/time | HIGH |

## 4. Service Sections

## Session and Kennel Context

### Domain

Accounts & Authentication; Kennels.

### Current authoritative path

`lib/session.ts`/`lib/auth.ts` for session identity; `server/services/kennel.service.ts:getKennelForUser` for user-to-kennel context.

### Authority category

AUTHORITATIVE READ; AUTHORITATIVE MUTATION for auth/kennel lifecycle operations.

### Responsibility, inputs, outputs / side effects

Resolves authenticated user and playable kennel context. Inputs are session/user ID; output is user/kennel context. Kennel creation/rename uses transactions.

### Main callers / downstream dependencies

Most player mutation routes call this before domain services; consumes User/Kennel Prisma records.

### Related/competing paths; do not bypass; limitations; confidence

Direct page Prisma reads can obtain kennel data but do not replace route ownership checks. Do not bypass `getKennelForUser` for player mutation context. Full read-path centralization is **UNKNOWN**. **HIGH**.

## Dog Read Model and Management Actions

### Domain

Dogs; Kennels.

### Current authoritative path

`dog.service.ts:getDogProfile`, dog registration/naming services, and `server/mappers/dog.mapper.ts`.

### Authority category

AUTHORITATIVE READ; AUTHORITATIVE MUTATION; MAPPER/PRESENTATION BUILDER.

### Responsibility, inputs, outputs / side effects

Builds dog profile DTOs and performs dog-scoped name/registration actions. Inputs are Dog/Kennel/session and neighboring domain state; outputs profile/action data or durable dog mutations.

### Main callers / downstream dependencies

Dog routes/pages and kennel UI; consumes health, breeding, grooming, market, titles, show, phenotype helpers and Prisma.

### Related/competing paths; do not bypass; limitations; confidence

Some pages directly query Prisma: **UNKNOWN** as a single read authority. Do not bypass specialized mutation services for naming/registration. **HIGH** mutation, **MEDIUM** universal read.

## Breeding, Litter, and Stud Contract Lifecycle

### Domain

Breeding; Litters; Stud Services & Contracts.

### Current authoritative path

`createBreedingAttemptForKennel`, `resolveDueBreedingProgressBatch`, `litterPersistence.service`, `studOffer.service`, `studContractRequest.service`, `studContractLifecycle.service`, and selection/return-service services.

### Authority category

AUTHORITATIVE MUTATION; ORCHESTRATOR; BATCH RESOLVER.

### Responsibility, inputs, outputs / side effects

Creates/progresses attempts, writes litters/puppies, stores and advances offer/contract/selection/return state. Inputs include Dogs, current epoch, biological eligibility, health, contract and kennel state. Outputs include attempts/litters/contracts/notices and related state changes.

### Main callers / downstream dependencies

Breeding/stud/litter APIs, dog profile paths, and contract/breeding cron paths. Depends on rules, health, lifecycle, kennel runs, market, notices, and Prisma transactions.

### Related/competing paths; do not bypass; limitations; confidence

Automatic/manual contract breeding are **INTENTIONAL VARIANTS**. Do not bypass these paths to write attempt/litter/contract links directly. Exact common biological engine versus service authority is a later audit. **HIGH**.

## Health, Care, and Grooming Operations

### Domain

Health & Care; Grooming & Kennel Services.

### Current authoritative path

`healthTest.service` single/bulk functions; `infectiousDisease.service`; emergency/reproductive care services; `grooming.service` self/list/accept/decay functions; `kennelService.service`.

### Authority category

AUTHORITATIVE MUTATION; DOMAIN CALCULATION; BATCH RESOLVER.

### Responsibility, inputs, outputs / side effects

Validates and persists tests/truth/care events, grooming listings/actions/condition events, and service claims. Inputs include Dogs, ownership, age, care status, epoch, listings and rules. Outputs durable records and some ledger/balance effects.

### Main callers / downstream dependencies

Dog/kennel/service APIs, emergency and grooming jobs, breeding/market/judging consumers. Depends on rules, Dog/Kennel, ledger records, notices and Prisma transactions.

### Related/competing paths; do not bypass; limitations; confidence

Phenotype and brucellosis paths are **INTENTIONAL VARIANTS**; self-groom/list/accept/decay are lifecycle stages. Do not bypass to directly create tests/actions or mutate condition. Exact all-writer ledger policy is **UNKNOWN**. **HIGH**.

## Market, Foundation Inventory, Rehome, and Balance Effects

### Domain

Market & Rehoming; Economy & Ledger.

### Current authoritative path

`market.service` listing/purchase/cancel/bulk functions; `foundationDog.service` inventory/purchase; `rehome.service`.

### Authority category

AUTHORITATIVE MUTATION; ORCHESTRATOR; BATCH RESOLVER for inventory maintenance.

### Responsibility, inputs, outputs / side effects

Mutates listings, owner/market/run state and related money/ledger effects in transactions. Inputs include listing/Dog/Kennel/health/contract/current-epoch state. Outputs purchases, transfers, rehomes, inventory, and cancellations.

### Main callers / downstream dependencies

Market/litter/dog APIs, foundation cron, account closure. Depends on care, contract protection, kennel runs, notices, Dog and Prisma transactions.

### Related/competing paths; do not bypass; limitations; confidence

Foundation and player purchase are **INTENTIONAL VARIANTS**. Do not set `ownerKennelId` or listing status directly for a purchase/transfer. There is no demonstrated shared Economy mutation service. **HIGH** feature paths; **MEDIUM** economy boundary.

## Show Schedule, Entry, Judging, and Results

### Domain

Showing; Judging; Championships, Titles & Prestige.

### Current authoritative path

`showSchedule.service`, `showEntry.service`, `judging.service`, and `publishShowResultsJob.service:runPublishShowResultsJob`; title/grand-champion/prestige services downstream.

### Authority category

AUTHORITATIVE MUTATION; AUTHORITATIVE READ; ORCHESTRATOR; DOMAIN CALCULATION; BATCH RESOLVER; CRON/PROGRESSION ENTRY.

### Responsibility, inputs, outputs / side effects

Generates schedules, plans/creates/pulls entries, judges/finalizes results/awards, then updates titles/credits/prestige. Inputs include time, event/Dog/entry state, rules, profiles, schedules and Judges. Outputs show records, ledger effects, results/awards/credits/notices.

### Main callers / downstream dependencies

Show APIs/pages, cron/job routes, dog planner. Depends on calendar, rules, Dog/Kennel, service claims, annual schedule, title/prestige/notices, and transactions.

### Related/competing paths; do not bypass; limitations; confidence

Block/day/publish/finalize stages are **INTENTIONAL VARIANTS**. Do not bypass entry/finalization services to write ShowEntry/ShowResult/ShowAward. Direct show page reads mean no single read authority. **HIGH** mutations; **MEDIUM** universal reads.

## Support, Badge, and PayPal Integration

### Domain

Support.

### Current authoritative path

`supportSubscription.service:getCanonicalSupportSubscription`, create/change/cancel/reconcile functions; `paypalSupport.service` and `paypalWebhook.service`; `communitySupporterBadge.service` and `lib/supporterBadgePresentation` for display.

### Authority category

AUTHORITATIVE READ; AUTHORITATIVE MUTATION; INTEGRATION ADAPTER; MAPPER/PRESENTATION BUILDER.

### Responsibility, inputs, outputs / side effects

Resolves current subscription, advances provider lifecycle/history, and derives visible badge from resolved tier/status/paid-through/preference. Inputs are user/provider/event/change records and current time. Outputs subscription/event history or presentation DTOs.

### Main callers / downstream dependencies

Support/account/public kennel pages, support APIs, PayPal webhook, Community bulletin batch loading. Depends on PayPal, Support models, Kennel preference and transactions.

### Related/competing paths; do not bypass; limitations; confidence

Badge resolver is **PRESENTATION**, not subscription mutation. Do not select arbitrary ACTIVE rows instead of `getCanonicalSupportSubscription`. Bulk selector behavior beyond inspected community loader remains **UNKNOWN**. **HIGH**.

## Community, Messaging, Notices, and Art Payments

### Domain

Community; Messaging & Notices; Breed Art & Funding.

### Current authoritative path

`bulletin.service`, `kennelMessaging.service`, `kennelNotice.service`, art campaign/payment attempt/finalization/webhook/replay/completion services.

### Authority category

AUTHORITATIVE READ; AUTHORITATIVE MUTATION; INTEGRATION ADAPTER; BATCH RESOLVER.

### Responsibility, inputs, outputs / side effects

Creates/moderates community content, conversations/notices/read state, and art campaign/contribution/payment/artwork state. Inputs are kennel/user/message/payment/campaign state. Outputs durable content/notice/payment records and presentation DTOs.

### Main callers / downstream dependencies

Community/inbox/admin/art APIs/pages, PayPal webhook, art cron runners, producing domain services. Depends on Kennels, support badge presentation, PayPal, Prisma and transactions.

### Related/competing paths; do not bypass; limitations; confidence

Notice and message unread counts are **INTENTIONAL VARIANTS**. Art and Support payments are separate **INTENTIONAL VARIANTS**. Do not bypass payment finalization to create contributions or mark attempts terminal. **HIGH**.

## Lifecycle and Game Clock

### Domain

Lifecycle; Calendar & Game Time.

### Current authoritative path

`lib/gameClock:getCurrentEpoch`; `lifecycle.service:resolveDogDeaths` and `markDogDeceased`.

### Authority category

DOMAIN CALCULATION; AUTHORITATIVE MUTATION; BATCH RESOLVER; CRON/PROGRESSION ENTRY.

### Responsibility, inputs, outputs / side effects

Computes current epoch and resolves durable Dog death/lifecycle effects. Inputs are real time, Dog state, and current epoch. Outputs time values and lifecycle mutations/notices/related contract effects.

### Main callers / downstream dependencies

Cron mortality route, services/jobs/pages; depends on rules constants, Dog, care/contracts/notices and transactions.

### Related/competing paths; do not bypass; limitations; confidence

Local event-time age calculations are **INTENTIONAL VARIANTS**. Do not bypass lifecycle service for a death transition. Rules-time helper production authority is **UNKNOWN**. **HIGH**.

## 5. Service Coverage Notes

- **Bulk show entry:** `createShowEntriesForCluster`; dedicated bulk service exists within show-entry service.
- **Bulk health:** health/infectious bulk preview/prepare/run functions; dedicated paths exist.
- **Sale removal and bulk sale:** market cancellation and bulk listing plus litter-bulk-sale services.
- **Grooming judging consumption:** no separately named service authority established; judging consumes persisted dog/entry inputs. **UNKNOWN**.
- **Ledger/balance operations:** no dedicated exported current service authority established; feature transaction writers are current mutation paths.
- **Breed release:** `breed.service:getReleasedBreedCodes` is an observed read path, but a universal mutation/gate service is **UNKNOWN**.

## 6. Registry Boundary

This registry is discovery evidence only. It does not authorize bypasses beyond evidence-backed mutation paths, refactors, or consolidation.
