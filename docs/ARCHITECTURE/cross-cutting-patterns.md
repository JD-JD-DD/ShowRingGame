# ShowRing Cross-Cutting Architecture Patterns

## 1. Purpose

This registry records repeatable implementation contracts evidenced across multiple ShowRing domains. It complements [canonical-rules.md](canonical-rules.md) and [canonical-services.md](canonical-services.md); it does not own gameplay meaning or redefine domain ownership. Domains need not use identical code: intentional domain-specific variants remain valid. Future implementation should inspect the applicable pattern before introducing a second approach.

## 2. How to Use This Registry

Before implementing a cross-domain concern: identify the domain; check the canonical rule and service registries; check this registry; inspect a reference implementation; extend the established pattern where it fits; and do not create another architectural approach unless repository evidence supports the contextual difference.

## 3. Pattern Summary

| Pattern | Classification | Primary reference | Common consumers | Main anti-pattern | Confidence |
| --- | --- | --- | --- | --- | --- |
| Authentication/session resolution | ESTABLISHED | `lib/session`, auth routes | APIs/pages | client-supplied identity | HIGH |
| Kennel context resolution | ESTABLISHED | `getKennelForUser` | player mutations | using user ID as kennel identity | HIGH |
| Ownership/access guards | EMERGING | mutation services | dog/market/stud/messages | UI-only authorization | HIGH |
| Server-authoritative eligibility | ESTABLISHED | show-entry/breeding/health services | all irreversible actions | client/UI eligibility as gate | HIGH |
| Disabled reasons | EMERGING | eligibility reason DTOs | breeding/show/health/grooming | generic unexplained rejection | MEDIUM |
| DTO/read-model mapping | EMERGING | dog/litter/show mappers | profiles/views | passing raw internal model to UI | HIGH |
| Hidden-data boundary | ESTABLISHED | dog mapper/visible categories | dog/market/community | exposing traits/provider/admin fields | HIGH |
| Collection enrichment | ESTABLISHED | bulletin badge enrichment | community/collections | row-by-row enrichment | HIGH |
| Batching/N+1 prevention | ESTABLISHED | show entry/health/bulletin Maps | collection services | per-row DB/API work | HIGH |
| Bulk action architecture | ESTABLISHED | bulk health/show entry/litter actions | workspaces | UI-only bulk mutation | HIGH |
| Economy + ledger writes | INCONSISTENT | show-entry/bulk-health transactions | monetary features | assuming one universal helper | MEDIUM |
| Quote/preview before mutation | EMERGING | bulk health/show planner | selection workflows | UI-only money/eligibility calculation | MEDIUM |
| Multi-write transactions | ESTABLISHED | market/judging/support/art services | durable workflows | split related writes without transaction | HIGH |
| Scheduled progression | ESTABLISHED | Vercel cron → services | breeding/shows/care | unguarded progression route | HIGH |
| Idempotent jobs | EMERGING | source keys/status/unique keys | cron/webhooks/notices | assuming one delivery | MEDIUM |
| Event/audit recording | EMERGING | awards/ledger/provider events | historical workflows | overwriting event context | HIGH |
| Historical snapshots | ESTABLISHED | ShowAward/StudContract | judging/contracts | recomputing then from now | HIGH |
| Current vs historical state | ESTABLISHED | balance vs ledger; subscription periods | read models | substituting current state for history | HIGH |
| Error classification | EMERGING | grooming + `ok`/`fail` routes | mutation APIs | leaking/logging expected rejection | MEDIUM |
| API response shape | INCONSISTENT | `ok`/`fail` and `NextResponse` | API routes | assuming one response convention | HIGH |
| Admin-only mutations | EMERGING | admin/moderation routes | admin services | hidden UI as authorization | MEDIUM |
| Debug/development routes | INCONSISTENT | test/support-sandbox routes | test/debug APIs | treating environment alone as authority | MEDIUM |
| Integration adapter boundary | ESTABLISHED | PayPal webhook/services | Support/Breed Art | provider payload as domain truth | HIGH |
| Webhook idempotency/reconciliation | ESTABLISHED | provider event records + runners | Support/Breed Art | non-durable duplicate handling | HIGH |
| Enum/code vs display label | ESTABLISHED | health/support/status presentation | UI/DTOs | localizing machine values | HIGH |
| Locale-aware formatting | INCONSISTENT | money/date helpers | UI/services | assuming one formatter | HIGH |
| Game time vs real time display | EMERGING | `gameTimeFormat`, epoch fields | time UI | ambiguous timestamp terminology | HIGH |
| Accessible interaction | EMERGING | forms/semantic controls | bulk/action UI | color-only or unlabeled state | MEDIUM |
| Centralized player copy | INCONSISTENT | selected eligibility constants | UI/services | duplicate sentence fragments | HIGH |
| Naming/identifier conventions | ESTABLISHED | Prisma schema | all domains | inventing divergent field names | HIGH |
| Internal vs player-facing ID | EMERGING | Dog `id`/`regNumber`, kennel slug | routes/UI | assuming internal ID is hidden | MEDIUM |
| Service-to-service dependency | EMERGING | market/breeding service calls | cross-domain mutations | recreating upstream rules | HIGH |
| Server component reads vs API reads | ESTABLISHED | direct server reads + client APIs | Next.js app | forcing internal HTTP reads | HIGH |
| Mutation route thinness | EMERGING | route → service examples | APIs | route-owned complex mutation rules | MEDIUM |
| Read-model/query boundary | INCONSISTENT | mappers/services/direct Prisma | pages | assuming one read architecture | HIGH |
| Focused regression scripts | ESTABLISHED | `apps/web/scripts/test*.ts` | features/rules | unscoped broad test substitution | HIGH |
| Build/validation | ESTABLISHED | `apps/web` `pnpm run build` | implementation stages | direct Prisma substitute by default | HIGH |
| Collection selection state | ESTABLISHED | show-entry/litter bulk Sets/Maps | bulk workspaces | stale selection as authority | HIGH |
| Stable dedupe/source keys | ESTABLISHED | `KennelNotice.sourceKey`, provider events | retryable fan-out | duplicate retry writes | HIGH |
| Presentation enrichment/order | ESTABLISHED | bulletin badges after base query | Community | cosmetic metadata changing order | HIGH |

## 4. Authenticated Context and Access Guards

### Problem solved

Ensures player mutations are attributed to an authenticated account and playable kennel before domain behavior is invoked.

### Applies to

Authentication/session resolution, kennel context resolution, ownership/access guards, admin-only mutations, and internal/player ID handling.

### Classification

**ESTABLISHED** for session → kennel resolution; **EMERGING** for uniform guard placement and admin checks.

### Approved/current architecture

```text
request → getSessionUserId → getKennelForUser → domain service ownership/party check → mutation
```

### Reference implementation

- `apps/web/app/api/breedings/route.ts` resolves kennel then delegates to breeding service.
- `apps/web/app/api/market-dogs/[listingId]/buy/route.ts` resolves kennel before market/foundation purchase.
- `apps/web/server/services/kennelMessaging.service.ts:assertKennelsCanMessage` is a service-level participant/block guard.

### Legitimate variants

Public server pages may read public data without a session; admin/cron routes use their own authorization mechanisms. `Dog.id`/contract/listing IDs are route identifiers, while `Dog.regNumber` and kennel slug/name are player-facing identifiers; production does not fully hide all internal IDs, so visibility policy is **UNKNOWN**.

### Anti-patterns to avoid

Do not trust client-supplied user/kennel identity or treat hidden UI as authorization. Do not mutate dog/market/contract records solely from a route parameter without service-level ownership/party validation.

### Boundary / preservation rules

Accounts remain distinct from Kennels. Authorization determines access, not gameplay eligibility or presentation labels.

### Localization/accessibility implications

Use player-safe access errors; do not expose internal IDs or moderation detail unnecessarily.

### Evidence

Session and kennel lookup imports across player routes; service-level ownership/party checks in market, health, contract, and messaging services.

### Confidence

HIGH for normal player mutation context; MEDIUM for a single admin convention.

### Follow-up

Inventory all admin/debug route guards before declaring a universal admin pattern.

## 5. Authoritative Mutations, Eligibility, and Player Feedback

### Problem solved

Separates a player-facing explanation/preview from the server decision that changes durable state.

### Applies to

Server-authoritative eligibility, disabled reasons, quote/preview, mutation route thinness, bulk actions, and secondary rechecks.

### Classification

**ESTABLISHED** for server mutation revalidation; **EMERGING** for a uniform preview/reason DTO style.

### Approved/current architecture

```text
selection/UI explanation → route parses/authenticates → domain service revalidates
→ transaction/persistence → safe response → refreshed presentation
```

### Reference implementation

- `showEntry.service.ts` provides eligibility reason/availability and revalidates in single/bulk entry mutations.
- `healthTest.service.ts` has preview/prepare/run flows, with transactional bulk writes.
- `grooming.service.ts` validates independently at self-groom, listing, and acceptance stages.

### Legitimate variants

Judging rechecks show eligibility at event time; contract execution rechecks state after request; list-versus-purchase and provider-versus-completion checks differ by lifecycle stage. These are **DOMAIN-SPECIFIC VARIANTS**, not duplicated authorization.

### Anti-patterns to avoid

Avoid UI-only eligibility, stale preview acceptance, generic “Ineligible” where an existing reason code/message exists, and duplicating cost/affordability arithmetic in the client.

### Boundary / preservation rules

Presentation may explain but does not authorize irreversible actions. Keep biological, contract, market, and grooming stage-specific gates distinct.

### Localization/accessibility implications

Disabled controls should expose actual plain-language reasons, with text/status beyond color alone. Existing strings are not a localization framework; retain machine reason codes separately from display text.

### Evidence

Stage 4 rule chains; show-entry reason helpers; bulk health preview and service mutations; grooming/market/stud service guards.

### Confidence

HIGH server-side; MEDIUM for consistent reason presentation.

### Follow-up

Later compare reason-code/message duplication without changing current wording.

## 6. Safe Read Models, Hidden Data, and Presentation

### Problem solved

Turns durable/internal domain state into player-safe, surface-specific data without treating UI values as business truth.

### Applies to

DTO/read-model mapping, hidden data boundary, enum/code labels, player-facing copy, locale/time formatting, and presentation ordering.

### Classification

**ESTABLISHED** for hiding/deriving sensitive state; **EMERGING** for dedicated mapper use; **INCONSISTENT** for copy and formatting centralization.

### Approved/current architecture

```text
internal Prisma/rules state → service or mapper shaping → presentation helper/label/format → UI
```

### Reference implementation

- `server/mappers/dog.mapper.ts` maps dog profile DTOs rather than passing raw records.
- `dogVisibleCategories.service.ts` derives player-visible categories from hidden traits/health inputs.
- `lib/supporterBadgePresentation.ts` maps subscription truth and preference into cosmetic badge output.

### Legitimate variants

Dedicated dog/litter/show mappers coexist with route/page/service-local shaping. `Intl.NumberFormat` appears in art/support helpers, while money/date formatting is also local in dog/grooming code: **INCONSISTENT**, not a current mandate to refactor.

### Anti-patterns to avoid

Avoid exposing genotype/hidden traits, internal judge/RNG data, provider identifiers, private emails, or moderation metadata through a casual full-model payload. Avoid localizing enum/database/API codes; convert machine values to player labels at presentation boundaries.

### Boundary / preservation rules

Presentation enrichment must not mutate domain truth or change base collection ranking/order unless the owning gameplay domain says so. Current snapshots remain historical inputs, not display-only substitutes.

### Localization/accessibility implications

Prefer locale-aware `Intl`/shared formatters where an existing helper fits; distinguish game epoch/calendar labels from real `createdAt` timestamps. Keep labels, errors, and status semantic and not color-only. Existing scattered player copy is **INCONSISTENT**.

### Evidence

Dog/litter/show mappers, visible-category service, community badge loader, `gameTimeFormat.ts`, art/support formatting helpers, and Master File hidden-trait/time conventions.

### Confidence

HIGH for safe DTO boundary; MEDIUM for formatting/accessibility/copy conventions.

### Follow-up

Audit per-surface hidden-field exposure and formatting/copy reuse later; do not introduce a generic translation layer now.

## 7. Collection Enrichment, Batching, and Selection

### Problem solved

Builds collection views and bulk operations without per-row persistence/API work or stale client selection becoming authority.

### Applies to

Collection enrichment, batching/N+1 prevention, bulk action architecture, collection selection state, and presentation enrichment ordering.

### Classification

**ESTABLISHED**.

### Approved/current architecture

```text
base collection → stable IDs/Set → bounded `in` queries / grouped reads
→ Map keyed by ID → enrich DTOs → render or validate selected current records → transaction
```

### Reference implementation

- `bulletin.service.ts` batches prestige and supporter badges and enriches after base collection work.
- `communitySupporterBadge.service.ts` de-duplicates user IDs, performs `in` queries, builds maps.
- `showEntry.service.ts` uses Sets/Maps, set queries, `createMany`, and bulk transaction rows; health bulk paths do the same.

### Legitimate variants

In-memory loops over already loaded records are normal. Litter bulk sale returns per-dog results through `Promise.all`; show entry and health batches use different atomic/per-item semantics appropriate to their action.

### Anti-patterns to avoid

Avoid a DB/API request per displayed row when IDs can be batch resolved. Avoid treating a client selection list as current authorization; reload selected records and separate structural manageability from action-specific eligibility.

### Boundary / preservation rules

Batching is an implementation pattern, not a license to merge domain decisions. Cosmetic enrichments must not alter base ordering.

### Localization/accessibility implications

Bulk UI needs stable row-specific errors/status and accessible selection controls; no full accessibility standard was established beyond semantic controls/labels/status messaging in existing UI.

### Evidence

Community, health, show-entry, litter bulk naming/sale service Map/Set/`in`/`createMany` usage.

### Confidence

HIGH.

### Follow-up

Inspect bounded parallelism use before making it a required pattern.

## 8. Transactions, Ledger, Events, and Historical State

### Problem solved

Keeps multi-record changes coherent and preserves event-time context needed after current state/rules change.

### Applies to

Economic transaction/ledger writes, transaction boundaries, event/audit recording, historical snapshots, current-vs-historical state, and stable dedupe keys.

### Classification

**ESTABLISHED** for multi-write `$transaction`, snapshots, and retry-safe keys where present; **INCONSISTENT** for a universal ledger-writing pattern.

### Approved/current architecture

```text
validate → calculate event values → Prisma transaction
  ├─ mutate domain current state
  ├─ create event/history/snapshot rows where the feature does so
  └─ use uniqueness/status/source key for retry-sensitive work
```

### Reference implementation

- `showEntry.service.ts` bulk entry transaction with `createMany` entries and ledger rows.
- `market.service.ts` / foundation purchase transactional owner/listing transitions.
- `artPaymentFinalization.service.ts`, support lifecycle, and judging services use transactions; `KennelNotice.sourceKey` and provider-event IDs are durable dedupe precedents.

### Legitimate variants

`ShowAward`/`ShowResult`, accepted `StudContract` terms, support tier periods, and ledger rows preserve different domain histories. They are not generic event sourcing. Some balance writers, including reproductive care, are not proven to follow one shared ledger helper, so Economy/Ledger remains **INCONSISTENT**.

### Anti-patterns to avoid

Avoid reconstructing historical competition/contract/payment context from current Dog/Breed/offer/subscription state when frozen fields exist. Avoid retryable fan-out writes without an appropriate status, uniqueness, or semantic source key.

### Boundary / preservation rules

Do not substitute current kennel balance for ledger history, current owner for breeder/contract parties, current title summary for credits/awards, or current subscription for tier-period history.

### Localization/accessibility implications

Event/history identifiers and machine codes remain internal; UI should present safe labels/amounts/times without altering snapshots.

### Evidence

Stage 3 data register; observed `$transaction` services; ShowAward, StudContract, LedgerTransaction, provider event and KennelNotice schema fields.

### Confidence

HIGH for transactions/snapshots/source keys; MEDIUM for ledger completeness.

### Follow-up

Trace all balance writers and identify which require ledger rows before asserting a stronger accounting pattern.

## 9. Scheduled Progression and Idempotency

### Problem solved

Runs time/provider-driven work safely across repeated cron or webhook delivery.

### Applies to

Scheduled progression, idempotent jobs, webhook idempotency/reconciliation, and integration adapter boundaries.

### Classification

**ESTABLISHED** for cron/webhook delegation and provider durable state; **EMERGING** for one common idempotency mechanism.

### Approved/current architecture

```text
Vercel cron or provider → guarded route → batch/adapter service
→ status/unique/source-key/event guard → transaction → durable state
→ later read/presentation
```

### Reference implementation

- `apps/web/vercel.json` plus cron/job routes delegate to mortality, breeding, show, art, care, and schedule services with secrets/job authorization.
- `app/api/webhooks/paypal/route.ts` verifies/parses provider events then dispatches Support or Art domain services.
- Art/support provider-event records and reconciliation/replay runners preserve retry state.

### Legitimate variants

Cron uses authorization secrets/job guard and bounded batches; provider webhook uses provider verification/event identity. Notices use source-key dedupe. These are **DOMAIN-SPECIFIC VARIANTS**.

### Anti-patterns to avoid

Avoid accepting a provider payload as durable domain truth without verification/normalization. Avoid assuming cron/webhook delivery occurs once or exposing unguarded production progression endpoints.

### Boundary / preservation rules

Routes are entrypoints; services own progression/state. Provider enum/payload shape must not become the domain’s presentation or gameplay authority.

### Localization/accessibility implications

Webhook/cron errors are operator-facing; player-facing state is derived later from durable records.

### Evidence

Vercel config, cron/job routes, PayPal webhook route, support/art runners and provider-event models.

### Confidence

HIGH for delegation/durable event shape; MEDIUM for full idempotency coverage.

### Follow-up

Inspect non-Vercel-configured job invocation and idempotency of each high-risk finalizer.

## 10. API, Errors, Admin, and Debug Boundaries

### Problem solved

Maps expected business failures to safe responses while distinguishing production administration from test/debug surfaces.

### Applies to

Error classification, API response shape, admin-only mutations, debug/development routes, and mutation route thinness.

### Classification

**EMERGING** for thin authenticated routes and typed business errors; **INCONSISTENT** for HTTP response helper and debug-guard usage.

### Approved/current architecture

Routes commonly parse/authenticate/context-load, call a service, and map expected errors to 4xx/safe response; unexpected errors are logged and return generic failures. `lib/http` `ok`/`fail` is a strong helper precedent but raw `NextResponse.json` also exists.

### Reference implementation

- `api/jobs/process-emergency-vet-care/route.ts` uses job authorization and `ok`/`fail`.
- Show/breeding/market routes resolve context then delegate to services.
- PayPal webhook maps recognized provider errors to status and logs unexpected failure.

### Legitimate variants

Cron/webhook Node handlers legitimately use `NextResponse`; development/test routes have purpose-specific guards. No one production-wide response shape is established.

### Anti-patterns to avoid

Avoid business mutations embedded in UI, hiding admin controls as the sole security layer, or treating a `NODE_ENV` condition as equivalent to user authorization. Avoid logging expected player rejections as unexpected server errors where typed service errors already distinguish them.

### Boundary / preservation rules

Admin interfaces normally target underlying domain services; do not make Administration a replacement gameplay domain. Debug/test routes must remain separate from production operations.

### Localization/accessibility implications

Return player-safe actionable messages and status codes; keep diagnostic/provider/internal detail out of player response bodies.

### Evidence

`lib/http.ts`, job/webhook routes, service error types, admin/test/debug route families.

### Confidence

MEDIUM.

### Follow-up

Audit each admin/debug route guard before standardizing response/error behavior.

## 11. Naming, Time, Formatting, and Copy

### Problem solved

Keeps persistent and API identifiers stable while presenting understandable player text/time/money.

### Applies to

Shared enum/code labels, locale-aware formatting, game-time versus real-time presentation, centralized copy, naming/identifier conventions, and focused validation/build patterns.

### Classification

**ESTABLISHED** for schema naming and focused validation/build; **EMERGING** for game-time terminology; **INCONSISTENT** for locale/copy reuse.

### Approved/current architecture

Use machine code/value in Prisma/rules/API (`breedCode2`, enums, `...Epoch`, `createdAt`/`updatedAt`, `ownerKennelId`/`breederKennelId`), then map to player labels/formatting in presentation helpers. Run focused `apps/web` `test:...` scripts for feature validation; `pnpm run build` in `apps/web` is the established full validation command and includes Prisma migrate/generate/build.

### Reference implementation

- `schema.prisma` consistently models `Breed.code2` / `breedCode2`, epoch and audit timestamp fields, ownership IDs.
- `lib/gameTimeFormat.ts` separates game time formatting; support/art helpers use `Intl.NumberFormat`.
- `apps/web/package.json` exposes focused `tsx` test commands and its build command.

### Legitimate variants

Some services construct money/date labels locally; this is **INCONSISTENT**, not evidence to replace them now. Game epoch and real `DateTime` are different data types and require different presentation terminology.

### Anti-patterns to avoid

Avoid localizing stored enums, route names, API fields, audit codes, or internal identifiers. Avoid ambiguous manually assembled time strings where existing game-time or locale-aware formatting applies. Avoid substituting direct Prisma commands for the normal build validation unless the task specifically requires it.

### Boundary / preservation rules

Naming conventions are persistence/API contracts. Focused scripts are regression harnesses, not production jobs.

### Localization/accessibility implications

Player copy should be plain-language and reuse a shared helper/constant where current evidence shows one; otherwise mark reuse as emerging rather than inventing i18n. Dates, money, percentages and large numbers should be assessed per surface for locale readiness.

### Evidence

Schema, `gameTimeFormat`, support/art/grooming/dog formatting functions, focused scripts and package scripts.

### Confidence

HIGH naming/build; MEDIUM formatting/copy/time presentation.

### Follow-up

Create no localization framework until a later stage audits the scattered strings.

## 12. Service Boundaries and Next.js Read Paths

### Problem solved

Uses service delegation for cross-domain mutation while allowing efficient server-component reads without unnecessary internal HTTP.

### Applies to

Service-to-service dependency, server component reads versus API reads, mutation route thinness, and read-model/query boundary.

### Classification

**ESTABLISHED** for mutation delegation and server-component direct reads; **EMERGING/INCONSISTENT** for a universal read-model boundary.

### Approved/current architecture

Server pages may call services and, where needed, Prisma directly. Client components call API routes for mutations/read refreshes. Mutation routes commonly resolve context and delegate to services. Upstream domain services are called for cross-domain rules rather than recreated where observed.

### Reference implementation

- `/shows` server page reads Prisma and services/rules directly.
- market/breeding services call health, contract, lifecycle, kennel-run and notice services for cross-domain behavior.
- show/breeding/market route handlers delegate after context resolution.

### Legitimate variants

Dedicated mappers/read services coexist with direct page Prisma and route-local shaping: **INCONSISTENT** as a single query style, but direct Prisma is not inherently wrong.

### Anti-patterns to avoid

Avoid internal HTTP solely to read from a server component. Avoid recreating upstream mutation rules in a consumer service when a concrete upstream service path exists. Avoid bypassing a known authoritative mutation service with direct model writes.

### Boundary / preservation rules

Do not impose CQRS, repositories, or a universal API-only read layer; those are not established repository patterns.

### Localization/accessibility implications

Read shaping should supply player-safe labels/statuses without leaking internal data.

### Evidence

Stage 1 flow, Stage 2 dependency map, Stage 4 service registry, `/shows` page and cross-service imports.

### Confidence

HIGH for mutation/server-read distinction; MEDIUM for preferred complex-read construction.

### Follow-up

Audit high-risk direct reads separately before any read-layer consolidation.

## 13. Core Cross-Cutting Flows

```text
AUTHENTICATED PLAYER MUTATION
Browser → API route → session resolution → kennel/access context → domain service
→ canonical validation → transaction/persistence → safe response

COLLECTION PRESENTATION
base query → stable IDs → batch enrichment → lookup Map → presentation DTO → render

SCHEDULED PROGRESSION
Vercel cron → secret/job guard → bounded progression service → status/unique guard → durable result

EXTERNAL PROVIDER EVENT
PayPal → webhook route → verification/normalization → Support or Art service
→ durable provider/domain state → later read/presentation
```

## 14. Pattern Inconsistency Register

| Pattern | Approach A | Approach B | Current classification | Risk | Later question |
| --- | --- | --- | --- | --- | --- |
| API responses | `ok`/`fail` helper | raw `NextResponse.json` | INCONSISTENT | medium | map route-family rationale |
| Read models | dedicated services/mappers | direct page Prisma/local shaping | INCONSISTENT | medium | identify high-risk leakage/drift cases |
| Economy/ledger | transaction + ledger rows in entry/health | feature-local/direct balance paths | INCONSISTENT | critical | trace every balance writer |
| Formatting | shared Intl/time helpers | local labels/formatters | INCONSISTENT | low-medium | localization audit |
| Player copy | selected shared messages | scattered local messages | INCONSISTENT | medium | identify same-concept strings |
| Idempotency | source keys/provider IDs/status guards | per-domain mechanisms | EMERGING | high | determine coverage per retryable job |

## 15. Future Implementation Contract

1. Authenticate server-side and resolve the playable kennel for player mutations.
2. Delegate irreversible changes to the owning domain service and revalidate there.
3. Preserve intentional lifecycle-stage rechecks rather than flattening them.
4. Batch collection enrichment with stable IDs, set queries, and lookup maps where collection data crosses domains.
5. Shape player-safe DTOs; keep hidden/internal/provider/audit data out of client payloads.
6. Use Prisma transactions for related multi-record mutations where current services do so.
7. Preserve event snapshots and current-versus-historical distinctions.
8. Make retryable cron/webhook/fan-out work use an appropriate durable status, uniqueness, event identity, or source key.
9. Keep machine enums/IDs internal and convert them to player labels in presentation.
10. Do not force server-component reads through internal HTTP; use API routes for client interaction and mutation paths.
11. Add or update focused regression coverage for meaningful feature changes; use `apps/web` focused scripts and `pnpm run build` when full validation is required.
12. Prefer small changes that extend an evidenced pattern; preserve documented UNKNOWNs until later audit.
