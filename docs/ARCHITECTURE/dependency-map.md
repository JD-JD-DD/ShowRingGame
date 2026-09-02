# ShowRing Domain Dependency Map

## 1. Purpose

This document records observed and allowed conceptual dependency directions between the domains identified in [domains.md](domains.md). It is not an enforcement mechanism and does not declare a canonical implementation.

## 2. Reading the Map

**UPSTREAM** supplies truth or capability. **DOWNSTREAM** consumes it. `Calendar → Breeding` means Breeding consumes game-time information from Calendar; it does not mean Calendar knows about Breeding.

## 3. High-Level Dependency Diagram

```text
Accounts & Authentication → Kennels → Dogs
                                    ├─→ Lifecycle ← Calendar & Game Time
                                    ├─→ Health & Care ← Genetics & Pedigree ← Breeds & Catalog
                                    ├─→ Breeding ← Calendar / Health / Stud Services
                                    │      └─→ Litters & Puppy Management
                                    ├─→ Showing ← Calendar / Kennel Services
                                    │      └─→ Judging → Championships, Titles & Prestige
                                    └─→ Market & Rehoming ← Economy & Ledger

Kennels → Community and Messaging & Notices
Accounts/Kennels → Support ← PayPal
Kennels/Breeds → Breed Art & Funding ← PayPal
Administration & Operations → authorized interfaces into domain services
```

## 4. Dependency Table

| Source Domain | May be consumed by | What it supplies | Evidence | Confidence |
| --- | --- | --- | --- | --- |
| Accounts & Authentication | Kennels, API orchestration, Support | user/session identity | session helpers and `getKennelForUser` route pattern | HIGH |
| Kennels | Dogs, player domains, messaging, support | playable identity, ownership, organization | `kennel.service` imported broadly by routes | HIGH |
| Calendar & Game Time | Lifecycle, Breeding, Health, Grooming, Showing, Stud Services | current epoch, conversion, templates | `gameClock`/rules imports and cron calls | HIGH |
| Breeds & Catalog | Dogs, Genetics, Showing, Judging, Market | breed/profile/catalog data | breed services and released-code consumers | HIGH |
| Genetics & Pedigree | Dogs, Breeding, Health, Judging | genotype/traits/COI outputs | engines plus phenotype/genetics service imports | MEDIUM |
| Dogs | specialized gameplay domains | identity/state/profile inputs | `Dog` model and dog services across flows | HIGH |
| Health & Care | Breeding, Stud Services, Market, Judging | safety/test/care status | health service imports in those services | HIGH |
| Breeding | Litters, Dogs, Stud Services | attempt, eligibility, whelping outcomes | breeding-to-litter/contract service calls | HIGH |
| Litters | Dogs, Market, Stud Services | litter/puppy state and bulk workflows | litter APIs/services and contract selection | HIGH |
| Stud Services & Contracts | Breeding, Lifecycle, Market | offer/contract/protection state | explicit imports in those services | HIGH |
| Grooming & Kennel Services | Dogs, Showing | condition/service/claim state | dog and show-entry service imports | HIGH |
| Showing | Judging, Championships, Dogs | event, entry, availability context | show models/services and judging workflows | HIGH |
| Judging | Championships, Dogs, results UI | judged results/audits | result models and title/prestige calls | HIGH |
| Championships, Titles & Prestige | Dogs, results UI, Kennels | awards, credits, title/prestige status | title/ribbon/credit services | HIGH |
| Economy & Ledger | Market, Breeding, Health, Grooming | balance/ledger transfer capability | economy engine/model and feature services | MEDIUM |
| Market & Rehoming | Dogs, Litters, Kennels | listing/transfer outcomes | market/rehome service calls | HIGH |
| Community | pages, Admin, Notices | public threads/posts/moderation state | bulletin service/API/models | HIGH |
| Messaging & Notices | player UI and event producers | inbox, notices, unread state | notice/message services called by domains | HIGH |
| Support | Community presentation, support UI | subscription/status/badge data | support and badge services | HIGH |
| Breed Art & Funding | art UI, cron/webhook/admin | campaigns/payment/art state | art services, webhook and cron routes | HIGH |

## 5. Observed Dependency Directions

- API routes generally resolve Accounts → Kennels, then delegate to domain services (for example, breeding, litters, market, support, and inbox routes).
- Calendar is consumed through `getCurrentEpoch` and rules time/calendar utilities by lifecycle, breeding, emergency-care, grooming, show, and contract job paths.
- Breeding consumes phenotype/genetic conversion, health/infectious checks, lifecycle effects, public-stud/contract checks, kennel runs, and then calls litter persistence after whelping.
- Market consumes health/pending-care checks, contract protection/return-service actions, kennel runs, notices, and dog presentation inputs while handling transfers.
- Judging consumes phenotype/health truth, breed judging profile, event/assignment context, annual point schedules, then calls title/prestige/grand-champion/notices services during result processing.
- Community consumes supporter badge presentation and kennel prestige summaries; it does not import support-subscription mutation services in the inspected community service.
- PayPal webhook dispatches to separate Support and Breed Art payment processing services.

## 6. Allowed Dependency Principles

- UI and route orchestration may consume multiple domains, but observed mutation routes normally delegate to services.
- Calendar & Game Time may be consumed broadly by time-sensitive domains; current evidence shows no reverse dependency from calendar utilities to those business domains.
- Economy & Ledger may provide value-transfer capability to a feature without owning that feature’s eligibility, listing, health, or contract lifecycle.
- Showing supplies event/entry context to Judging; completed judging results may then be consumed by titles, points, prestige, and presentation.
- Health status may constrain breeding, stud contracts, market transitions, and judging inputs without merging those domains.
- Messaging & Notices may deliver outcomes emitted by other domains without owning their originating business transition.

## 7. Dependencies That Should Not Exist

| Source | Must not depend on | Reason | Evidence level |
| --- | --- | --- | --- |
| Calendar & Game Time | domain-specific business decisions | its visible role is broadly consumed time supply; reverse coupling would violate the observed direction | STRONG |
| Presentation components | direct mutation of domain truth | mutations are exposed through route/service paths; components are presentation/client interaction surfaces | ESTABLISHED |
| Community | authoritative Support subscription mutation | community uses supporter-badge presentation while Support owns provider/subscription models and services | STRONG |
| Breed Art & Funding | Support subscription mutation | separate model/service families and PayPal webhook branches | STRONG |
| Economy & Ledger | Support subscription/provider lifecycle | separate Support persistence and provider services; money alone is not ownership | STRONG |
| Stud Services & Contracts | generic lifecycle calculation | lifecycle service/engine supplies death transitions, while contracts react to them | STRONG |
| Market & Rehoming | genetic inheritance calculation | inheritance is located in Genetics rules and breeding flows, not market services | STRONG |
| Support | Judging, show eligibility, gameplay-economic advantages | no direct path found, but current code inspection alone does not establish the intended prohibition | UNKNOWN |
| Grooming | final judging outcome calculation | grooming may provide condition input; final score boundary needs later rule audit | TENTATIVE |

## 8. Bidirectional / Cyclic Relationships

### Judging and Championships, Titles & Prestige

- **Observed relationship:** Judging consumes annual point schedules and calls title, prestige, grand-champion, and notice services during result processing; title/award systems consume show results.
- **Files/evidence:** `judging.service.ts`, `titleProgress.service.ts`, `grandChampion*.service.ts`, annual schedule services, `ShowResult`/award/credit models.
- **Likely reason:** result finalization combines competition evaluation with downstream recognition persistence.
- **Confidence:** HIGH that both directions are present at the service/data level; ownership of the orchestration sequence is not decided.
- **Follow-up stage:** persistent-data and canonical service/rule audits.

### Dogs and Breeding

- **Observed relationship:** Dog read/profile paths invoke breeding progress and eligibility; breeding consumes dog state and writes/creates puppy-related dog records through downstream helpers.
- **Files/evidence:** `dog.service.ts`, `breeding.service.ts`, dog/breeding routes and `Dog`/`BreedingAttempt` models.
- **Likely reason:** player dog read models expose active breeding state while breeding simulation operates on dogs.
- **Confidence:** HIGH that integration is bidirectional; exact read-model versus mutation ownership remains later-stage work.
- **Follow-up stage:** domain service and data ownership audit.

### Market and Stud Services

- **Observed relationship:** market transitions retire offers/extinguish return services; stud offer/contract code consumes market-listing context.
- **Files/evidence:** `market.service.ts`, `studOffer.service.ts`, contract-return/protection services.
- **Likely reason:** transfer/listing changes affect contracted or offered dogs.
- **Confidence:** HIGH.
- **Follow-up stage:** cross-domain transition audit.

## 9. Shared Infrastructure vs Domain Dependencies

The following are shared infrastructure, not domains in this map: Prisma/database access (`lib/db.ts`), HTTP responses (`lib/http.ts`), session/auth transport helpers, job authorization, generic IDs/guards, formatting utilities, shared UI primitives, and PayPal/Resend HTTP transport. Two domains using Prisma, a session helper, or a generic formatter does not establish a domain dependency or shared ownership.

## 10. Unknown or Transitional Boundaries

- **UNKNOWN:** Training as an independent application domain; only constants/conditioning rule evidence was found.
- **UNKNOWN:** Handling as an independent domain; current evidence places stewarding between Kennel Services and Showing.
- **UNKNOWN:** the exact ownership boundary among phenotype persistence, genetics calculation, dog visible categories, health expression, and player-facing presentation.
- **UNKNOWN:** whether all cron/job route handlers absent from `vercel.json` are invoked by another deployment mechanism.
- **UNKNOWN:** the intended direction of the judging ↔ titles/points orchestration cycle; it is recorded, not reconciled.
