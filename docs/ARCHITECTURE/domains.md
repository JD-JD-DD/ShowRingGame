# ShowRing Domain Map

## 1. Purpose

This document identifies the current bounded implementation domains discovered in Stage 2. Domain ownership means architectural responsibility, not a declaration that every helper or service is canonical, nor a classification of duplicate implementations. Persistence ownership and rule authority require deeper later-stage audit. The Master File remains design authority rather than implementation topology.

## 2. Domain Identification Standard

Domains below were recognized from converging repository evidence: dedicated services, rules engines/constants, persistent models, mutation routes, public/application interfaces, cohesive gameplay responsibility, and repeated consumers. A folder or filename alone was not treated as evidence.

## 3. Domain Summary Table

| Domain | Owns | Consumes | Exposes | Primary implementation landmarks | Confidence |
| --- | --- | --- | --- | --- | --- |
| Accounts & Authentication | user identity/access/session | none; shared DB | authenticated user context | auth/session libs, `auth.service`, `User` | HIGH |
| Kennels | playable kennel identity, runs, notices | Accounts, Dogs | kennel context and management | kennel/run/notice services, `Kennel*` | HIGH |
| Dogs | dog profile/registration/name/read models | Kennels, Breeds, Lifecycle, genetics outputs | dog state/profile | dog services/mappers, `Dog*` | HIGH |
| Lifecycle | time-driven death/state transitions | Calendar, Dogs | lifecycle transition outcomes | lifecycle service/engine, mortality cron | HIGH |
| Breeds & Catalog | breed metadata/judging profiles | rules constants | breed/released-profile data | breed services, `Breed*` | HIGH |
| Genetics & Pedigree | genotype, inheritance, COI, trait conversion | Dogs, Breeds | genetic/pedigree calculations | genotype/COI engines, genetics services | MEDIUM |
| Health & Care | health tests, disease, emergency care | Dogs, Calendar | health/care status and eligibility inputs | health/infectious/emergency services | HIGH |
| Breeding | attempts, biological eligibility/progression | Dogs, Calendar, Genetics, Health, Stud Services | breeding outcomes/eligibility | breeding services/engine, `BreedingAttempt` | HIGH |
| Litters & Puppy Management | post-whelp litter and puppy workflows | Breeding, Dogs, Kennels | litter views and bulk actions | litter services/mappers, `Litter` | HIGH |
| Stud Services & Contracts | offers, contracts, selections, return services | Dogs, Kennels, Health, Breeding | contract and offer state | stud services, `StudOffer*`, `StudContract*` | HIGH |
| Grooming & Kennel Services | grooming and service claims/stewarding | Dogs, Kennels, Calendar | care/service availability and effects | grooming/kennel-service services | HIGH |
| Calendar & Game Time | epoch/time conversion and schedules | shared infrastructure | current epoch/calendar templates | clock/calendar engines, gameClock | HIGH |
| Showing | schedules, show event/entry orchestration | Calendar, Dogs, Kennels, Breeds | show availability/entries | show/schedule/entry services, `Show*` | HIGH |
| Judging | competition evaluation and result production | Showing, Dogs, Breeds, Health, Genetics | judged results/audit records | judging services/engines, `ShowResult` | HIGH |
| Championships, Titles & Prestige | points, awards, title/prestige progression | Judging, Showing, Calendar | credits/title status/rankings | title/grand-champion services and engines | HIGH |
| Economy & Ledger | balances, ledger transaction records, shared value rules | Kennels | transfer/accounting outcomes | economy engine, `LedgerTransaction` | MEDIUM |
| Market & Rehoming | listings, purchases, transfers/rehome flows | Dogs, Kennels, Economy, Health | market listings/transfer outcomes | market/rehome/foundation services, `DogListing` | HIGH |
| Community | bulletin categories, threads, posts, moderation | Kennels, Support presentation | community content/status | bulletin service, `Bulletin*` | HIGH |
| Messaging & Notices | private conversations, notices, reports | Kennels, moderation | inbox counts/messages/notices | messaging/notice services, `KennelConversation*` | HIGH |
| Support | subscriptions, provider events, supporter state | Accounts/Kennels, PayPal | support status/management data | support/PayPal services, `Support*` | HIGH |
| Breed Art & Funding | campaigns, contributions, art-payment lifecycle | Kennels, PayPal | funding progress/completed art | art services, `Art*` | HIGH |
| Administration & Operations | moderation/audit and authorized operational entrypoints | underlying domains | admin actions, audits, jobs | admin routes, moderation/audit services, cron/jobs | MEDIUM |

## 4. Accounts & Authentication

### Responsibility

Manages account identity, authentication, sessions, password reset, and access-control state.

### Owns

- `User`, access-denylist, password-reset, user-access-audit, and moderation-status records.
- Login/signup/logout/reset routes and session/auth helpers.

### Consumes

- Shared persistence and HTTP infrastructure.

### Exposes

- Authenticated user identity and session context used before resolving a playable kennel.

### Current dependents

- Kennels; API routes across player features; Support; Administration & Operations.

### Primary implementation landmarks

- `apps/web/lib/auth.ts`, `session.ts`, `sessionToken.ts`; `server/services/auth.service.ts`; `app/api/auth`; Prisma `User`, `PasswordResetToken`, `UserAccessAudit`.

### Boundary notes

Account identity and playable kennel identity are separate: routes commonly resolve a user, then call `getKennelForUser`.

### Legitimate dependents and dependencies that should not exist

- Kennels and route orchestration may consume authenticated identity. Gameplay domains should not depend on password-reset/email delivery; this is a STRONG boundary from the dedicated auth route/helper split.

### Confidence

HIGH — dedicated models, services, libraries, and route family.

## 5. Kennels

### Responsibility

Manages the playable kennel identity and kennel-scoped organization, notices, runs, and service participation.

### Owns

- `Kennel`, rename history, areas, runs, planner tags, private notes, notices, service profiles, and service claims.

### Consumes

- Accounts & Authentication for user-to-kennel resolution; Dogs for dog/run assignment; Showing for stewarding availability.

### Exposes

- Kennel context, ownership checks, roster organization, notices, service claims, and public kennel presentation data.

### Current dependents

- Dogs, Litters, Breeding, Showing, Market, Messaging & Notices, Support, Breed Art & Funding, and many API routes.

### Primary implementation landmarks

- `kennel*.service.ts`, `kennelRun*.service.ts`, `kennelNotice.service.ts`, `app/api/kennel`; Prisma `Kennel*` and `KennelRun`.

### Boundary notes

Kennel service/stewarding functions are kept with Kennels/Grooming & Kennel Services because their records are kennel-scoped, while showing consumes stewardship availability.

### Legitimate dependents and dependencies that should not exist

- Player-facing domains may consume kennel identity/ownership. Kennels should not determine judging scores; no evidence supports that direction, so it is TENTATIVE rather than established.

### Confidence

HIGH — pervasive explicit service and model boundary.

## 6. Dogs

### Responsibility

Manages dog identity, registration, naming, profile/read-model assembly, and dog-scoped player actions outside specialized lifecycle, health, breeding, market, and showing operations.

### Owns

- `Dog`, registration reservations, private notes, visible-category and profile mapping, naming, and dog profile/read endpoints.

### Consumes

- Kennels, Breeds & Catalog, Lifecycle, Genetics & Pedigree, Health & Care, Grooming, Breeding, Market, Stud Services, and Showing.

### Exposes

- Dog profile DTOs, identifiers, traits/presentation inputs, ownership context, and dog-scoped action availability.

### Current dependents

- Lifecycle, Health & Care, Breeding, Litters, Stud Services, Grooming, Showing, Judging, Market, and Championships.

### Primary implementation landmarks

- `dog.service.ts`, registration/naming/visible-category services, `server/mappers/dog.mapper.ts`, `app/api/dogs`; Prisma `Dog`, `DogRegistrationReservation`.

### Boundary notes

Dog services orchestrate several neighboring domains in read models. That does not establish ownership of those neighboring rules.

### Legitimate dependents and dependencies that should not exist

- Specialized domains may consume dog identity/state. Presentation components should not directly mutate Dog truth; this is ESTABLISHED by mutation routes delegating to services rather than UI components.

### Confidence

HIGH — dedicated models, APIs, services, mapper, and broad consumers.

## 7. Lifecycle

### Responsibility

Owns time-driven dog lifecycle transitions, particularly mortality resolution and its consequences.

### Owns

- Lifecycle rule constants/engine use, mortality scan state, death transition handling, and scheduled mortality resolution.

### Consumes

- Calendar & Game Time for current epoch; Dogs for target state; Health & Care and Stud Services for transition consequences.

### Exposes

- Lifecycle transition outcomes and deceased-state effects for Dogs, Breeding, Market, and Stud Services.

### Current dependents

- Dogs, Breeding, Market & Rehoming, Stud Services & Contracts, Messaging & Notices, and cron orchestration.

### Primary implementation landmarks

- `lifecycle.service.ts`, `packages/rules/engines/death.engine.ts`, lifecycle constants, `api/cron/resolve-dog-mortality`; Prisma `MortalityScanState` and dog lifecycle fields.

### Boundary notes

Lifecycle is separately represented by service, rules constants, and a cron entrypoint, so it is a current boundary rather than merely a Dog field. Effects still touch dog-related services.

### Legitimate dependents and dependencies that should not exist

- Time-consuming state-transition work may depend on Calendar and Dogs. Calendar should not depend on Lifecycle decisions; this is STRONG from one-way current-epoch imports.

### Confidence

HIGH — dedicated service, engine/constants, persistence support, and scheduled route.

## 8. Breeds & Catalog

### Responsibility

Manages breed catalog data, released-breed access, breed judging profiles, and breed genetic background records.

### Owns

- `Breed`, `BreedJudgingProfile`, breed genetic-background snapshots, and catalog/profile service operations.

### Consumes

- Rules constants and imported catalog/static data.

### Exposes

- Breed identity, released breed codes, catalog options, judging profile inputs, and genetic-background context.

### Current dependents

- Dogs, Genetics & Pedigree, Breeding, Showing, Judging, Foundation/Market flows, and scheduled inventory maintenance.

### Primary implementation landmarks

- `breed.service.ts`, breed-profile/background services, `app/api/breeds`; Prisma `Breed*`; rules breed constants.

### Boundary notes

Breed catalog is distinct from per-dog genetics even where breed information seeds or constrains genetic calculations.

### Legitimate dependents and dependencies that should not exist

- Dog and competition domains may consume breed data. Breed catalog should not depend on results-presentation systems for its identity/profile data; evidence is TENTATIVE.

### Confidence

HIGH — dedicated persistence and services with multiple consumers.

## 9. Genetics & Pedigree

### Responsibility

Provides genotype/inheritance, genetic-background, trait conversion, pedigree loading, and COI calculations.

### Owns

- Genotype, polygenic inheritance, legacy genotype reconstruction, COI, trait and foundation-dog rule utilities; breed genetic background; persisted phenotype/genotype conversion helpers.

### Consumes

- Dogs and Breeds & Catalog for persisted inputs and breed context.

### Exposes

- Genetic trait outputs, pedigree/COI calculations, and conversion inputs used by dog, breeding, foundation, and judging flows.

### Current dependents

- Dogs, Breeding, Litters, Health & Care, Judging, Foundation/Market flows, and program planning.

### Primary implementation landmarks

- `genotype.engine.ts`, `polygenicInheritance.engine.ts`, `coi.engine.ts`, trait/foundation engines; genetics constants; `breedGeneticBackground.service.ts`, `puppyGenetics.service.ts`, `phenotypePersistence.service.ts`.

### Boundary notes

Genetics is independently represented in shared rules and dedicated services. Player-visible categories are assembled through `dogVisibleCategories.service.ts` and presentation helpers; Stage 2 therefore does not assign visible phenotype presentation to Genetics.

### Legitimate dependents and dependencies that should not exist

- Simulation and specialized gameplay domains may consume genetic outputs. Genetics should not depend on player-facing labels to calculate genotype/COI; STRONG from separate engine versus presentation-helper locations.

### Confidence

MEDIUM — the calculation boundary is clear, but persistence/conversion and visible phenotype edges cross Dog/Health presentation paths.

## 10. Health & Care

### Responsibility

Manages health testing/expression, infectious-disease status, veterinary/reproductive emergency care, and related dog safety checks.

### Owns

- Health-test records and health-condition truth, disease screening/status, emergency-care events, reproductive-emergency events, and care resolution workflows.

### Consumes

- Dogs; Calendar & Game Time for due/expiry processing; Genetics & Pedigree inputs for phenotype health expression; Kennels for acting context.

### Exposes

- Test/care status, safety checks, health presentation inputs, and eligibility constraints to Breeding, Stud Services, Market, Dogs, and Judging.

### Current dependents

- Dogs, Breeding, Litters, Stud Services, Grooming, Market, Judging, and scheduled job routes.

### Primary implementation landmarks

- `healthTest.service.ts`, `infectiousDisease.service.ts`, emergency-care/reproductive-emergency services; health/expression/emergency engines; `app/api/dogs/*/health-tests`, emergency routes; Prisma health/care/event models.

### Boundary notes

Health influences breeding and market decisions through explicit checks but is separately stored and serviced; it is not merged into Breeding.

### Legitimate dependents and dependencies that should not exist

- Eligibility consumers may read health status. Health should not depend on Support tier to determine test/care truth; this is TENTATIVE because no direct negative invariant was found.

### Confidence

HIGH — dedicated models, services, engines, routes, and job orchestration.

## 11. Breeding

### Responsibility

Manages biological breeding attempts, breeding eligibility, due progression, whelping outcomes, and associated simulation orchestration.

### Owns

- `BreedingAttempt`, breeding eligibility/progression, breeding rule invocation, whelping orchestration, and breeding-result notices.

### Consumes

- Dogs, Calendar, Genetics & Pedigree, Health & Care, Kennels, and Stud Services where a public/contracted sire is used.

### Exposes

- Eligibility results, active-attempt status, and whelping outcomes consumed by Dogs, Litters, Stud Services, and player routes.

### Current dependents

- Dogs, Litters, Stud Services, Health & Care jobs, and `api/cron/resolve-breeding-progress`.

### Primary implementation landmarks

- `breeding.service.ts`, `breedingEligibility.service.ts`, `packages/rules/engines/breeding.engine.ts`, `app/api/breedings`; Prisma `BreedingAttempt`.

### Boundary notes

`breeding.service.ts` calls litter persistence after whelping, while Litter has its own services, mapper, UI, and bulk endpoints. This supports a Breeding-to-Litters handoff rather than one merged domain.

### Legitimate dependents and dependencies that should not exist

- Breeding may consume health/contract eligibility and emit whelping outcomes. It should not depend on Community content to decide biological eligibility; TENTATIVE, with no direct rule proving a prohibition.

### Confidence

HIGH — dedicated rules, services, model, routes, cron, and explicit cross-domain calls.

## 12. Litters & Puppy Management

### Responsibility

Manages litter records and post-whelp puppy management, including list/read models and bulk puppy actions.

### Owns

- `Litter`, litter metadata/read mapping, puppy bulk sale/rehome/naming/run workflows, and litter presentation.

### Consumes

- Breeding for creation/whelping context; Dogs for individual puppy actions; Kennels for ownership/runs; Market for sale operations.

### Exposes

- Litter DTOs, puppy-management actions, and litter state to pages, kennel views, and Stud Services selection flows.

### Current dependents

- Dogs, Kennels, Market, Stud Services, Breeding, and litter API/page routes.

### Primary implementation landmarks

- `litter.service.ts`, `litterPersistence.service.ts`, `litterBulk*.service.ts`, `server/mappers/litter.mapper.ts`, `app/api/litters`; Prisma `Litter`.

### Boundary notes

Some puppy actions delegate to Dog Naming, Market, Rehome, and Kennel Run services. That coordination does not make Litters the owner of each delegated concern.

### Legitimate dependents and dependencies that should not exist

- Breeding may create/hand off to Litters; UI and contracts may consume litter state. Litters should not calculate judging outcomes; STRONG from the separate judging services/engines and no observed litter-to-judging call.

### Confidence

HIGH — independent services, mapper, API family, model, and user workflows after breeding.

## 13. Stud Services & Contracts

### Responsibility

Manages public stud offers, request/approval and contract lifecycle, compensation terms, puppy selection, protections, and return services.

### Owns

- `StudOffer*`, `StudContract*`, contract selection/return-service state, lifecycle deadlines, offer presentation/history, and contract-specific eligibility.

### Consumes

- Dogs, Kennels, Health & Care, Breeding eligibility/progression, Calendar, and Market listing context.

### Exposes

- Offer discovery, contract status/history, eligibility/approval outcomes, and puppy-selection/return-service actions.

### Current dependents

- Dogs, Breeding, Litters, Market, Lifecycle, Messaging & Notices, player pages, and contract cron processing.

### Primary implementation landmarks

- `studOffer*.service.ts`, `studContract*.service.ts`, `publicStud.service.ts`, rules `studContractTerms.ts`, contract API/page families; Prisma `StudOffer*`, `StudContract*`.

### Boundary notes

The contract/offer set has persistent records, route families, terms helper, and its own scheduled lifecycle. It is a meaningful boundary from biological Breeding despite explicit integration at request and whelping steps.

### Legitimate dependents and dependencies that should not exist

- Breeding and Lifecycle may consume contract protections/terms where relevant. Stud Services should not own generic dog lifecycle calculation; STRONG from its consumption of lifecycle outcomes rather than a lifecycle engine.

### Confidence

HIGH — extensive dedicated persistence, APIs, services, rules helper, and cron use.

## 14. Grooming & Kennel Services

### Responsibility

Manages grooming actions/listings/decay and kennel service claims, including showing-related stewarding capability.

### Owns

- Grooming listings/actions, kennel service profiles/claims, condition-event records, grooming eligibility/actions, and scheduled grooming decay.

### Consumes

- Dogs, Kennels, Calendar, Health & Care, and Showing availability for stewarding.

### Exposes

- Grooming status/effects, service availability, claims, and stewarding commitments.

### Current dependents

- Dogs, Kennels, Showing, show-entry planning, and job routes.

### Primary implementation landmarks

- `grooming.service.ts`, `kennelService.service.ts`, grooming/conditioning engines, `app/api/services`, `app/api/kennel/services`; Prisma `Grooming*`, `KennelService*`, `DogConditionEvent`.

### Boundary notes

Grooming is implemented as application services plus a scheduled job. Training appears in rules constants and conditioning engine, but no dedicated training services/models/routes were established; it is not a separately documented current domain.

### Legitimate dependents and dependencies that should not exist

- Showing may consume service availability; Dogs may display grooming state. Grooming should not directly determine final judging results; TENTATIVE because it can contribute condition inputs but no final scoring ownership is evidenced.

### Confidence

HIGH — dedicated services, persistence, routes, and scheduled work; Training is UNKNOWN as an independent boundary.

## 15. Calendar & Game Time

### Responsibility

Provides current game epoch, time conversion, calendar templates, and recurring time structure consumed across simulations and jobs.

### Owns

- Game-clock helpers, time/calendar constants, clock and show-calendar engines, annual schedule templates, and current-epoch acquisition.

### Consumes

- Generic runtime time only; no observed dependency on domain-specific business decisions.

### Exposes

- Current epoch, formatted game time, schedules/templates, and due-time inputs.

### Current dependents

- Lifecycle, Breeding, Health & Care, Grooming, Showing, Judging jobs, Stud Services, pages, and cron/job routes.

### Primary implementation landmarks

- `lib/gameClock.ts`, `gameTimeFormat.ts`, clock/show-calendar engines and time/calendar constants; annual show-schedule services.

### Boundary notes

Show schedule generation uses calendar utilities, but current-epoch use is broader than Showing and supports an independent Calendar & Game Time boundary.

### Legitimate dependents and dependencies that should not exist

- Any time-sensitive domain may consume Calendar. Calendar must not depend on downstream domain-specific business decisions; STRONG from its broad helper/engine use and one-way imports.

### Confidence

HIGH — shared helpers/engines/constants and broad observed consumers.

## 16. Showing

### Responsibility

Manages show schedule/event structure, availability, entries, event orchestration, and player-facing show views before competition evaluation.

### Owns

- Show clusters/days/blocks/entries, schedule generation/maintenance, show availability, entry maintenance, and show-entry planning.

### Consumes

- Calendar, Dogs, Kennels, Breeds & Catalog, Grooming & Kennel Services, and current time.

### Exposes

- Show availability/status, schedules, entries, event context, and show records to Judging, Championships, Dogs, and UI.

### Current dependents

- Judging, Championships/Titles/Prestige, Dogs, Kennels, player show pages, and scheduled routes.

### Primary implementation landmarks

- `show.service.ts`, `showSchedule.service.ts`, `showEntry*.service.ts`, `showAvailability.service.ts`, `dogShowEntryPlanner.service.ts`, `app/api/shows`; Prisma `ShowCluster`, `ShowDay`, `ShowJudgingBlock`, `ShowEntry`.

### Boundary notes

Showing is distinct from Judging: entry/schedule services and models are separate from judging engines/result production. Calendar remains a consumed cross-cutting boundary.

### Legitimate dependents and dependencies that should not exist

- Judging may consume eligible event/entry context; UI may consume availability. Showing should not depend on title-display presentation to create entries; TENTATIVE.

### Confidence

HIGH — services, APIs, persistent event structure, UI, and jobs.

## 17. Judging

### Responsibility

Evaluates show competition and produces judged results, judge assignments/panels, and judging audit records.

### Owns

- Judging engines, judge/panel assignment, result calculation/production, judging audit, and judge-facing profile inputs.

### Consumes

- Showing event/entry state, Dogs, Breeds & Catalog, Genetics & Pedigree/phenotype inputs, Health & Care truth, Calendar, and annual point schedules.

### Exposes

- `ShowResult`, judging outcomes, audit records, and completed event data consumed by Championships/Titles/Prestige and results UI.

### Current dependents

- Championships/Titles/Prestige, Showing results pages, Dogs show records, and results-publishing jobs.

### Primary implementation landmarks

- `judging.service.ts`, `showJudgingJob.service.ts`, judge/panel/assignment/audit services; judging/judge/weight engines; Prisma `Judge`, `ShowResult`, `BreedJudgingResultAudit`.

### Boundary notes

Judging imports annual point schedule, title-progress, prestige, grand-champion, and notice services during result processing. This is an observed orchestration edge requiring later cycle/ownership audit; it does not erase the distinct competition-evaluation boundary.

### Legitimate dependents and dependencies that should not exist

- Titles/points may consume judged results. Support should not influence judging eligibility or score: UNKNOWN as an established invariant from current code alone, although no direct dependency was found.

### Confidence

HIGH — dedicated engines/services/models, route jobs, and result consumers.

## 18. Championships, Titles & Prestige

### Responsibility

Manages annual championship point schedules, awards/credits, title and grand-champion progression, producer merit, prestige, and related result-derived recognition.

### Owns

- Annual point schedule records/build/resolution, show awards, title progress, grand-champion credits, prestige statistics, producer merit, and ribbon-room read models.

### Consumes

- Judging results, Showing event context, Dogs, Breeds, Calendar, and Kennels for notices/presentation.

### Exposes

- Point/title/award/credit outcomes, prestige summaries, milestones, and result-history presentation.

### Current dependents

- Dogs, Judging result processing, Kennels, public results/ribbon-room pages, and annual schedule consumers.

### Primary implementation landmarks

- `titleProgress.service.ts`, `grandChampion*.service.ts`, annual-point services, `prestige.service.ts`, `producerMerit.service.ts`, `ribbonRoom.service.ts`; corresponding rules engines and Prisma award/credit/schedule models.

### Boundary notes

Awards and title progression have dedicated engines/services/models beyond Showing. Current judging-service imports in both directions with progression/points make the precise orchestration boundary a later-stage concern.

### Legitimate dependents and dependencies that should not exist

- This domain may consume completed judging/results data. Judging should not require downstream ribbon-room presentation to calculate results; TENTATIVE, based on the dedicated `ribbonRoom.service` read-model location.

### Confidence

HIGH — distinct persistent records, engines, services, and result-derived consumers.

## 19. Economy & Ledger

### Responsibility

Provides ledger/balance accounting and shared economic rule utilities for value-transfer operations.

### Owns

- `LedgerTransaction`, economy rules/constants, and transaction/balance mutation primitives visible in market, breeding, care, and service flows.

### Consumes

- Kennels as account holders and feature requests that cause transfers.

### Exposes

- Balance/transaction outcomes to Market, Breeding, Health & Care, Grooming, and player ledger views.

### Current dependents

- Market, Breeding, Health & Care, Grooming & Kennel Services, Dogs, and ledger UI.

### Primary implementation landmarks

- `economy.service.ts`, `packages/rules/engines/economy.engine.ts`, economy constants, `app/ledger`; Prisma `LedgerTransaction`.

### Boundary notes

Economy is represented by a rules engine and ledger persistence, while feature services initiate feature-specific transfers. Money involvement alone is not treated as proof that Economy owns the feature lifecycle.

### Legitimate dependents and dependencies that should not exist

- Feature domains may request value transfer without surrendering their eligibility/lifecycle decisions. Economy should not own Support subscription/provider state; STRONG from separate Support models/services and PayPal integration paths.

### Confidence

MEDIUM — clear engine/model, but service-level transfer orchestration is distributed across features.

## 20. Market & Rehoming

### Responsibility

Manages dog/foundation listings, purchases, listing lifecycle, transfers, and rehoming operations.

### Owns

- `DogListing`, foundation inventory/listing flow, player listing lifecycle, purchases, rehoming, listing visibility, and transfer consequences.

### Consumes

- Dogs, Kennels, Economy & Ledger, Health & Care, Stud Services, Lifecycle, and Kennel Runs.

### Exposes

- Market search/listings, buy/cancel/price outcomes, transfer/rehome outcomes, and player-facing market data.

### Current dependents

- Dogs, Litters, Kennels, Stud Services, Account Closure, player market pages/routes.

### Primary implementation landmarks

- `market.service.ts`, `foundationDog.service.ts`, `rehome.service.ts`, `app/api/market-dogs`; Prisma `DogListing`.

### Boundary notes

Market calls health, contract, lifecycle, and run services to protect transitions. It is distinct from Economy because its own listing/transfer lifecycle is separately modeled and routed.

### Legitimate dependents and dependencies that should not exist

- Economy may supply value transfers; Dogs/Litters may request listing operations. Market should not determine genetic inheritance; STRONG from separate genetics engines and no market-to-genetics calculation path.

### Confidence

HIGH — dedicated model, services, APIs, UI, and lifecycle integrations.

## 21. Community

### Responsibility

Manages public bulletin/community categories, threads, posts, posting policy, and related moderation state.

### Owns

- Bulletin categories, threads, posts, post/thread status, and community posting/moderation mutations.

### Consumes

- Kennels for author identity; Messaging & Notices for notices; Support presentation and Kennel prestige summaries for displayed community context.

### Exposes

- Community content, moderation outcomes, and player-facing threads/posts.

### Current dependents

- Community/bulletin pages and APIs, Kennels, Messaging & Notices, and admin moderation routes.

### Primary implementation landmarks

- `bulletin.service.ts`, `app/api/community`, `app/api/bulletin`, community/bulletin components; Prisma `BulletinCategory`, `BulletinThread`, `BulletinPost`.

### Boundary notes

Community is distinct from private Messaging by models, routes, and dedicated service. It consumes supporter-badge presentation, not subscription mutation.

### Legitimate dependents and dependencies that should not exist

- UI and moderation may consume community state. Community must not authoritatively mutate Support subscription state; STRONG from dedicated Support services/provider events and the observed presentation-only badge service.

### Confidence

HIGH — separate models/service/API/page families.

## 22. Messaging & Notices

### Responsibility

Manages private kennel conversations, participant/message state, blocks/reports, and in-app notices.

### Owns

- Conversation, participant, message, block, communication-report, and notice records; unread counts and message/notice mutations.

### Consumes

- Kennels for participants; Administration & Operations for report handling; other domains as notice producers.

### Exposes

- Inbox data, unread counts, message/report actions, and domain-event notifications.

### Current dependents

- Kennels, Community, Breeding, Lifecycle, Judging/Championships, Market, Stud Services, and inbox/notices UI.

### Primary implementation landmarks

- `kennelMessaging.service.ts`, `kennelNotice.service.ts`, communication-moderation service, `app/api/inbox`, `app/api/notices`; Prisma `KennelConversation*`, `KennelNotice`, reports/blocks.

### Boundary notes

Notices are a cross-domain delivery mechanism; producer domains retain their own business-state ownership.

### Legitimate dependents and dependencies that should not exist

- Domains may emit notices after their own mutations. Messaging/Notices should not decide the originating domain’s eligibility or state transition; STRONG from producer-service calls into notice creation.

### Confidence

HIGH — dedicated models, services, APIs, and broad producer calls.

## 23. Support

### Responsibility

Manages voluntary support subscriptions, provider events, tier changes, reconciliation, and supporter-state presentation.

### Owns

- Support subscription, tier-period/change, provider-event records, PayPal subscription interaction, and support lifecycle reconciliation.

### Consumes

- Accounts/Kennels for subscriber association; PayPal integration; shared payment HTTP utilities.

### Exposes

- Support status, management actions, badge/presentation data, and provider-event processing outcomes.

### Current dependents

- Support/account pages, Community supporter-badge presentation, webhook processing, and support scripts.

### Primary implementation landmarks

- `supportSubscription.service.ts`, `paypalSupport.service.ts`, `paypalWebhook.service.ts`, support APIs/pages/components; Prisma `SupportSubscription*`, `SupportProviderEvent`.

### Boundary notes

Support has separate persistence/provider lifecycle from gameplay ledger economy. It is consumed by Community as presentation data in observed service calls.

### Legitimate dependents and dependencies that should not exist

- UI and Community presentation may consume support state. Support influencing judging, show eligibility, or gameplay-economy advantages is UNKNOWN as an established invariant from repository evidence; no such direct dependency was found.

### Confidence

HIGH — dedicated models, service/API family, external provider boundary, webhook, and regression harnesses.

## 24. Breed Art & Funding

### Responsibility

Manages breed-art campaigns, contributions, payment attempts/events, reconciliation, and completed artwork.

### Owns

- Campaigns, contributions, art payment attempts/provider events, completion state, and funding progress.

### Consumes

- Kennels for contributor association; PayPal payment capability; Breeds for campaign context.

### Exposes

- Campaign/funding-board data, checkout/finalization outcomes, completed-art gallery data, and admin completion actions.

### Current dependents

- Breed-art pages/components, PayPal webhook, cron reconciliation/replay, and administrative completion routes.

### Primary implementation landmarks

- `artCampaign.service.ts`, `artPayment*.service.ts`, `artworkCompletion.service.ts`, art APIs/pages; Prisma `ArtCampaign`, `ArtContribution`, `ArtPayment*`, `ArtArtwork`.

### Boundary notes

Art funding has an independent persistence/payment lifecycle, separate service set, webhook branch, and cron runners. It is not combined with Support merely because both use PayPal.

### Legitimate dependents and dependencies that should not exist

- PayPal/web UI may consume campaign/payment state. Breed Art should not mutate Support subscription records; STRONG from separate models/services and webhook dispatch paths.

### Confidence

HIGH — dedicated model family, APIs, services, payment workflow, and scheduled runners.

## 25. Administration & Operations

### Responsibility

Provides administrative interfaces, moderation/audit records, and authorized operational job entrypoints into underlying domains.

### Owns

- Moderation/access audit records, communication-report resolution, system broadcasts, and job authorization behavior.

### Consumes

- Accounts/Auth, Kennels, Community/Messaging reports, and individual domain services invoked by cron/jobs/admin routes.

### Exposes

- Administrative actions, audit trails, broadcasts, authorized operational triggers, and diagnostics.

### Current dependents

- Admin pages/routes, Communication/Messaging report flows, scheduled infrastructure, and moderation scripts.

### Primary implementation landmarks

- `app/admin`, `app/api/admin`, `app/api/cron`, `app/api/jobs`, `lib/jobAuthorization.ts`, moderation/request-audit helpers; Prisma moderation/access-audit models.

### Boundary notes

Most admin routes are interfaces into existing domains, not a replacement owner for them. Moderation/audit and authorization are the strongest genuine admin-owned concepts. Handling is not independently established: current stewarding is a Kennel Services/Showing integration.

### Legitimate dependents and dependencies that should not exist

- Operations may orchestrate authorized calls to domain services. Admin UI should not contain independent gameplay-rule mutations that bypass the underlying domain service; STRONG from observed route-to-service delegation, though completeness is UNKNOWN.

### Confidence

MEDIUM — a cross-cutting boundary with genuine moderation/audit concepts, but many endpoints delegate into other domains.

## 26. Candidate Domains Not Established Separately

- **Training:** UNKNOWN as an independently implemented application domain. Training constants and a conditioning engine exist, but no dedicated training services, routes, or persistence family were established.
- **Handling:** not separately established. Stewarding/handling-adjacent functionality is currently evidenced through Kennel Services and Showing consumers.
- **Visible phenotype/presentation:** not established as an independent simulation domain. It is distributed among genetics/phenotype persistence, dog-visible-category service, mappers, and UI/presentation helpers.
- **Foundation population:** not split into a standalone domain. It is implemented through foundation-dog services and rules, currently consumed by Breeds/Genetics and Market flows.
