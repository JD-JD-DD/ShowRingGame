# ShowRing Persistent Data Ownership

## 1. Purpose

This Stage 3 persistence audit records where durable game truth currently lives. It does not define every canonical business-rule helper or decide whether duplicate reads/writes should be consolidated. It distinguishes persistence authority from implementation authority (what production executes), design authority (the Master File), and presentation authority (DTO/UI labels). The Master File remains design authority.

## 2. Persistence Ownership Standard

### Persistence authority

The durable record or field production relies on as current or historical truth.

### Derived state

A value computed from persisted inputs; it is not authoritative merely because it appears in a DTO or UI.

### Cached derived state

A persisted value that might be recomputed. When the synchronization path or replaceability is unclear, it is recorded as a cache candidate rather than assumed redundant.

### Snapshot

A copy frozen at an event boundary, such as a show entry’s kennel/condition fields, judged result scoring fields, award competition counts, contract terms, or genetic/rules versions. Snapshots are not presumed duplicate data.

### Historical record

An event or prior value whose historical interpretation matters after current state/rules change.

### Current-state record

State expected to transition over time, commonly through status, timestamp, owner, balance, or availability fields.

### Reference data

Durable shared configuration, such as `Breed` records and persisted judging profiles. Health-test definitions are currently code/rules configuration rather than a dedicated Prisma reference model.

## 3. Summary Table

| Object | Owning domain | Persistence class | Primary storage | Main writer(s) | Main reader(s) | History sensitivity | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| User/account access | Accounts & Authentication | IDENTITY, CURRENT_STATE, HISTORICAL | `User`, reset/access/moderation records | auth/moderation services | session/auth routes | high for identity/audit | HIGH |
| Kennel | Kennels | IDENTITY, CURRENT_STATE | `Kennel`, rename/run/note records | kennel services | all player domains | high for identity/balance | HIGH |
| Breed/profile | Breeds & Catalog | REFERENCE, CONFIGURATION, SNAPSHOT | `Breed`, judging profile/background tables | breed/profile services | dog/genetics/judging services | profile/version dependent | HIGH |
| Dog | Dogs | IDENTITY, CURRENT_STATE, SNAPSHOT | `Dog`, reservations, notes | dog/lifecycle/market/breeding services | profiles and all dog consumers | very high | HIGH |
| Breeding/litter | Breeding; Litters | EVENT, HISTORICAL, CURRENT_STATE | `BreedingAttempt`, `Litter` | breeding/litter persistence | dog/litter/contract services | very high | HIGH |
| Show event/entry | Showing | EVENT, CURRENT_STATE, SNAPSHOT | `ShowCluster`, `ShowDay`, `ShowEntry` | schedule/entry services | show pages/judging | high | HIGH |
| Results/awards | Judging; Championships | HISTORICAL, SNAPSHOT | `ShowResult`, `ShowAward` | judging/finalization services | titles/results UI | very high | HIGH |
| Titles/points/prestige | Championships, Titles & Prestige | CURRENT_STATE, HISTORICAL, SNAPSHOT | progress, credits, annual schedules | title/grand-champion/point services | dogs/results/ribbon UI | high | HIGH |
| Health/care | Health & Care | EVENT, CURRENT_STATE, SNAPSHOT | test/truth/disease/emergency records | health/care services/jobs | breeding/market/judging/dogs | high | HIGH |
| Ledger/balance | Economy & Ledger | LEDGER, CURRENT_STATE | `LedgerTransaction`, `Kennel.balance` | feature services | ledger UI/features | very high | MEDIUM |
| Listings/transfers | Market & Rehoming | CURRENT_STATE, HISTORICAL | `DogListing` | market/foundation/rehome services | market/dog/litter pages | high | HIGH |
| Stud offers/contracts | Stud Services & Contracts | CURRENT_STATE, HISTORICAL, SNAPSHOT | offer/contract/selection/return tables | contract/offer services, cron | breeding/dog/history UI | very high | HIGH |
| Grooming/services | Grooming & Kennel Services | CURRENT_STATE, EVENT | listing/action/claim/event tables | grooming/kennel-service services | dogs/show-entry/UI | medium-high | HIGH |
| Support | Support | INTEGRATION_STATE, CURRENT_STATE, HISTORICAL | subscription/change/period/event tables | webhook/subscription services | support/badge UI | high | HIGH |
| Community/messages/notices | Community; Messaging & Notices | HISTORICAL, CURRENT_STATE | bulletin/conversation/message/notice tables | bulletin/messaging/notice services | pages/inbox/admin | high for authored content | HIGH |
| Breed art funding | Breed Art & Funding | INTEGRATION_STATE, EVENT, HISTORICAL | campaign/contribution/payment/art tables | art payment/finalization/webhook services | art UI/cron/admin | high | HIGH |
| Moderation/audit | Administration & Operations | HISTORICAL | audit/access/moderation fields | admin/moderation services | admin/report flows | high | HIGH |

## 4. User, Account, and Kennel Identity

### Owning domain

Accounts & Authentication for `User`, password-reset/access records; Kennels for `Kennel`, rename, run, private-note, and playable identity state.

### Purpose

Separates login identity from the playable kennel that owns dogs, balances, content, and player activity.

### Primary storage

`User` (`id`, unique `email`, password/moderation/login fields); `PasswordResetToken`, `UserAccessAudit`, `AccessDenylist`, `ModerationAudit`; `Kennel` (`id`, unique `userId`, `name`, `slug`, `balance`, moderation fields); `KennelRenameHistory`, `KennelRun`, and kennel-private records.

### Canonical persisted fields

- **Stored authoritative:** User/kennel IDs and unique email/name/slug; `Kennel.userId`; kennel balance and moderation state.
- **History-sensitive:** access audit, rename history, original kennel/dog relationships, and moderator timestamps/reasons.
- **Mutable current state:** login/activity timestamps, moderation status, public slogan, badge preference, balance, district, and reputation.

### Identity / immutable fields

`User.id`, `Kennel.id`, unique email, name, and slug are identity keys. Whether user email or kennel name/slug are immutable is **UNKNOWN**: explicit kennel rename operations/history exist, so they must not be treated as immutable.

### Stored versus derived state

Session context is derived from authentication/session helpers and durable user records. `Kennel.balance` is stored current state; ledger history is separate. Player-facing labels are presentation-only.

### Authoritative read and mutation paths

Routes resolve sessions through `lib/session.ts`/`auth.ts`, then commonly call `getKennelForUser` in `kennel.service.ts`. Auth, kennel, and moderation services provide visible mutation paths; `kennel.service` uses transactions for kennel creation/rename.

### Transaction / atomicity boundary

Kennel creation/rename paths visibly use Prisma transactions. No single transaction boundary for every account/moderation action was established.

### Downstream consumers, deletion / retention, and reconstruction

All player domains consume kennel identity. `UserAccessAudit`, `ModerationAudit`, and rename history are reconstructive records. General deletion/retention policy is **UNKNOWN**; account closure is a dedicated transactional service, not evidence that identity/audits are generally deleted.

### Primary evidence

`schema.prisma` User/Kennel/audit models; `auth.service.ts`, `kennel.service.ts`, `accountClosure.service.ts`; routes that call `getKennelForUser`.

### Confidence

HIGH.

### Follow-up for later stages

Determine canonical balance reconciliation and full account-closure retention semantics.

## 5. Breed Reference, Judging Profiles, and Genetic Background

### Owning domain

Breeds & Catalog, with Genetics & Pedigree consuming background/profile inputs.

### Purpose

Supplies durable breed identity and profile/configuration records referenced by dogs, shows, judging, schedules, and art campaigns.

### Primary storage

`Breed` (`code2` primary key, unique `name`, group/activity/release fields); `BreedJudgingProfile`; `BreedGeneticBackgroundSnapshot`; rules-package breed/genetics/health constants as non-Prisma reference configuration.

### Canonical persisted fields

- **Stored authoritative:** `Breed.code2`, name, group, active/release state; persisted judging-profile and background snapshot identity/version fields.
- **Snapshot:** a `ShowResult` references a specific breed judging profile/rules version, preserving event context separately from current `Breed` fields.
- **Mutable reference state:** current name/group/activity/release/profile records where writers permit changes.

### Identity / immutable fields

`Breed.code2` is the relational identity key. Mutability of name/group/release state is **UNKNOWN** without a complete catalog mutation audit.

### Stored versus derived state

Rules constants and service-produced catalog options are derived/reference views. No claim is made that current Breed data reconstructs historical result meaning; results persist profile/rules identifiers and audit JSON.

### Authoritative read and mutation paths

`breed.service.ts`, judging-profile/background services, and their consumers are the observed read/write landmarks. The foundation-inventory cron reads released breed codes.

### Transaction / atomicity boundary

Breed judging-profile persistence visibly uses a transaction. Broader catalog mutation boundaries are **UNKNOWN**.

### Downstream consumers, deletion / retention, and reconstruction

Dogs, breeding, judging, showing, annual schedules, and art campaigns reference `code2`. `ShowResult` profile/rules fields aid historical reconstruction. Reference-data deletion policy is **UNKNOWN**; relational references make removal high-impact.

### Primary evidence

`schema.prisma` Breed/profile/background/result models; breed/profile/background services; rules constants; judging service.

### Confidence

HIGH.

### Follow-up for later stages

Audit whether current profile reads versus stored result snapshots have one canonical historical interpretation.

## 6. Dog Identity, Pedigree, Traits, and Current State

### Owning domain

Dogs, consuming Breeds, Lifecycle, and Genetics & Pedigree.

### Purpose

Represents each dog’s durable identity, parentage, ownership, lifecycle, hidden inherited traits, current condition, and cross-domain references.

### Primary storage

`Dog`; `DogRegistrationReservation`; kennel runs/notes; related `DogTitleProgress`, health, listing, entry/result, contract, and credit models. Architecturally significant types include Decimal hidden traits, `genotype`/`geneticsVersion`, lifecycle/visibility/market enums, and self-relations for `sireId`/`damId`.

### Canonical persisted fields

- **Stored authoritative:** `id`, unique `regNumber`, breed/owner/breeder IDs, sire/dam/litter IDs, sex, birth/death epochs, lifecycle/visibility/origin/foundation state, hidden Decimal traits, genotype/version, and current dog condition fields.
- **History-sensitive:** registration number, parentage, breeder identity, birth/origin, persisted traits/genotype version, show and title relations.
- **Mutable current state:** owner/kennel run, lifecycle/visibility/market state, names where mutation paths allow, breeding-active flag, condition/fatigue, and derived-summary cache candidates such as visible title/producers fields.

### Identity / immutable fields

`Dog.id` and unique `regNumber` are stable internal/player-facing identifiers. Parentage, breeder, and genetic fields are high-risk historical fields, but complete immutability enforcement is **UNKNOWN**; do not infer it from UI absence.

### Stored versus derived state

- **Derived at read:** age from `birthEpoch` plus current game epoch; visible conformation categories from persisted traits/health inputs and rules/presentation helpers; action availability, show/breeding status, and profile labels.
- **Stored cache candidate:** `coiPercent`, COI generation depth, visible title/producer-merit summary fields. Their replacement/synchronization authority requires later audit.
- **Presentation only:** mapper and UI labels.

### Authoritative read and mutation paths

`dog.service.ts` and `dog.mapper.ts` are major profile-read landmarks; some pages/routes also query Prisma directly. Writers include dog registration/naming services, lifecycle, breeding, market/rehome, grooming, and health services. No single authoritative read path is established in Stage 3.

### Transaction / atomicity boundary

Dog naming is transactional; dog mutation also occurs inside broader breeding, market, lifecycle, grooming, health, and contract transactions.

### Downstream consumers, deletion / retention, and reconstruction

Consumed by nearly every gameplay domain. Parentage plus linked litter/breeder relations support pedigree reconstruction; trait/genotype fields preserve inputs. General Dog deletion policy is **UNKNOWN**; lifecycle and market flows visibly transition state rather than proving deletion semantics.

### Primary evidence

`schema.prisma` Dog and relations; dog/registration/naming/visible-category/phenotype services; dog mapper; phenotype persistence and genetics rules; focused phenotype/pedigree/title tests.

### Confidence

HIGH for storage and consumers; MEDIUM for cache authority and immutability enforcement.

### Follow-up for later stages

Audit title/producer/COI cached fields, phenotype persistence boundaries, and all dog writers.

## 7. Breeding Attempts and Litters

### Owning domain

Breeding owns attempts; Litters & Puppy Management owns the post-whelp litter record and puppy workflows.

### Purpose

Persists biological attempt timing/outcome and permanent litter parentage, birth, breeder, and puppy relationship context.

### Primary storage

`BreedingAttempt` (`sireId`, `damId`, breed, epochs, pregnancy/status, unique `litterId`, RNG seed, stud-fee and contract links); `Litter` (unique breed/serial identity, parents, birth epoch, count, breeder, metadata) with `Dog.litterId` puppy relations. Reproductive emergency and contract models connect to both.

### Canonical persisted fields

- **Stored authoritative:** attempt parents, created/preg-check/due/whelped epochs, pregnancy/status and litter link; litter identity, parents, `bornEpoch`, `pupCount`, breeder and puppy relations.
- **History-sensitive:** sire/dam, breed, RNG seed, birth/whelping timing, litter serial, breeder, live/litter counts, and contract qualification links.
- **Mutable current state:** pre-final attempt status/check fields; litter custom name/note where mutation paths permit.

### Identity / immutable fields

Attempt/litter IDs and unique litter link/serial constraint establish identity. Whether all completed attempt fields are immutable after WHELPED/failed state is **UNKNOWN**, although their event role and focused lifecycle/persistence scripts make them history-sensitive.

### Stored versus derived state

Current puppy count can be read through related Dogs; `Litter.pupCount` is a stored event count and must not be assumed replaceable. Breeding eligibility/pregnancy display is derived from stored state plus Calendar/rules. Contract qualification fields are stored snapshots, not merely current litter recomputation.

### Authoritative read and mutation paths

`breeding.service.ts` writes attempts/progression and calls `litterPersistence.service.ts`; `litter.service.ts` and `litter.mapper.ts` provide major reads. Breeding and litter API routes delegate to those services.

### Transaction / atomicity boundary

Breeding service has visible transactions for attempt/progression; litter persistence is called within breeding/reproductive-resolution workflows. Exact end-to-end atomicity for every whelping path is **UNKNOWN**.

### Downstream consumers, deletion / retention, and reconstruction

Dogs, contracts/selections, kennel runs, market/rehome workflows, and UI consume this data. Parentage, breeder, count, and puppy links permit reconstruction. Retention/deletion behavior is **UNKNOWN**; relationship restrictions/unique links indicate historical importance.

### Primary evidence

Schema attempt/litter relations; breeding, litter persistence, litter bulk, reproductive emergency, and stud-contract services; litter ownership/lifecycle/qualification tests.

### Confidence

HIGH.

### Follow-up for later stages

Determine cache/snapshot semantics for `pupCount` and completed-attempt update policy.

## 8. Show Schedule, Entries, Results, and Awards

### Owning domain

Showing owns schedule and entries; Judging owns results; Championships/Titles owns downstream recognition.

### Purpose

Stores scheduled show identity and state, event entries with entry-time snapshots, and published competition outcomes/awards.

### Primary storage

`ShowCluster`, `ShowDay`, `ShowJudgingBlock`, `ShowDayGroupJudgeAssignment`; `ShowEntry`; `ShowResult`; `ShowAward`. Key uniqueness includes cluster/day identity, one entry per day/dog, one result per entry, and an optional unique award finalization key.

### Canonical persisted fields

- **Schedule/current state:** cluster name/year/district/open-close/start-end/status; day schedule/judge/status/published/prestige epochs; entry status/absence/judging-block link.
- **Entry snapshots:** entered kennel ID/name/slug, breed, fee, handler use, conditioning and fatigue snapshots at entry.
- **Historical result/award:** dog/show/day/block/judge/breed links, ranks/placement/scores/DQ, points/major, competition counts, publication epoch, scoring/profile/rules version, result audit JSON, award type/group/sex/rank/finalization key.

### Identity / immutable fields

Show IDs and cluster/day/entry uniqueness keys are stable identities. Published result/award field immutability is **UNKNOWN** as a global enforcement claim, but scores, awards, competition counts, judge/profile versions, and published timing are high-risk historical fields.

### Stored versus derived state

- **Stored authoritative:** schedule/status, entries, results, awards, and frozen competition/scoring fields.
- **Derived at read:** show availability, countdowns, player display status, formatted dates, and show record presentation.
- **Stored snapshot:** entry and result/award snapshot fields listed above.

### Authoritative read and mutation paths

Show/schedule/entry services and show pages are major reads; `/shows` also makes direct Prisma reads. Writers are schedule, entry-maintenance, judging, and `publishShowResultsJob` services through API/cron routes. No single authoritative read path is established.

### Transaction / atomicity boundary

Show schedule, entry, and judging services visibly use Prisma transactions. Judging/finalization is the visible high-risk boundary for results, awards, title progression, and related records; correctness/completeness is out of scope.

### Downstream consumers, deletion / retention, and reconstruction

Dogs, results UI, title/grand-champion/prestige services, ledger entries, notices, and rankings consume outcomes. Result/award links, counts, point values, scoring/profile version, and audit JSON provide substantial reconstruction context. Published-result deletion/overwrite policy is **UNKNOWN**; no current-rules reconstruction authority was established.

### Primary evidence

Schema show/result/award models; show schedule/entry/judging/publish services; cron routes; show-title/award and finalizer regression scripts.

### Confidence

HIGH.

### Follow-up for later stages

Audit result finalization writers and the relationship between stored award points and title/point calculations.

## 9. Title, Championship, and Prestige State

### Owning domain

Championships, Titles & Prestige.

### Purpose

Records current title progress plus show-derived credits, yearly prestige, and annual championship point schedules/publication state.

### Primary storage

`DogTitleProgress`; `DogGrandChampionCredit`; `DogShowPrestigeCredit`; `DogYearlyPrestigeStat`; `AnnualChampionshipPointSchedulePublication` and `AnnualChampionshipPointSchedule`; `ShowAward` supplies award history.

### Canonical persisted fields

- **Current state/cache candidate:** DogTitleProgress points/majors/grand counters, title code, completed-at show/day/epoch, wins JSON.
- **Historical/snapshot:** grand champion credit award/show/judge/competition/rules/version/finalization fields; show prestige credit per dog/show; annual schedule publication/year/version/status and per breed/district/sex thresholds/resolution/provenance/rates.
- **Mutable current state:** publication status/timestamps, title progress counters, yearly prestige summary fields.

### Identity / immutable fields

DogTitleProgress is one-to-one by dog; credits have uniqueness per dog/show/award or dog/show; schedules unique by effective year/district/breed/sex. Whether current progress counters can be rebuilt/replaced is **UNKNOWN**; credit/schedule records are history-sensitive.

### Stored versus derived state

Title/ribbon labels and eligibility displays are derived from stored progress/credits/awards and current presentation code. Dog title prefix/suffix/producer fields may be stored cache candidates. Published annual schedule records are persisted inputs rather than UI-only threshold displays.

### Authoritative read and mutation paths

Title, grand-champion, annual-schedule, prestige, producer-merit, and ribbon-room services are major paths. Judging service calls title/prestige/grand-champion logic during finalization; annual-schedule services provide published schedule reads.

### Transaction / atomicity boundary

Annual schedule publication operations and judging/title flows visibly use transactions. The complete authoritative reconciliation path for all current title summaries is **UNKNOWN**.

### Downstream consumers, deletion / retention, and reconstruction

Dog profiles, show records/results UI, ribbon room, notices, and judging finalization consume this state. Credits preserve award/event/rules context; yearly stats are derived-summary candidates. Deletion policy is **UNKNOWN**.

### Primary evidence

Schema title/credit/schedule models; title/grand-champion/annual schedule/prestige services and engines; point schedule persistence and dog-title tests.

### Confidence

HIGH for records/writers; MEDIUM for summary-cache authority.

### Follow-up for later stages

Determine whether DogTitleProgress and yearly prestige models are authoritative summaries or replaceable caches.

## 10. Health, Infectious Disease, and Emergency Care

### Owning domain

Health & Care.

### Purpose

Persists test outcomes, genetic health truth, infectious disease state, and emergency/reproductive care event decisions.

### Primary storage

`HealthTestRecord`; `DogHealthConditionTruth`; `DogInfectiousDiseaseStatus`; `InfectiousDiseaseTestRecord`; `DogEmergencyCareEvent`; `ReproductiveEmergencyEvent`. Test definitions/applicability are rules/service configuration, not a dedicated Prisma definition table.

### Canonical persisted fields

- **Historical tests:** dog/test/result, tested/revealed epochs, visibility, notes/details; infectious test result/validity and breeding-attempt relation.
- **Current health state:** one condition-truth or disease-status record per dog/condition/disease, liabilities/alleles/environment/status and infection provenance.
- **Emergency snapshots/events:** source keys, deadlines, cost/survival or reproductive intended counts, ruleset/RNG/roll/outcome metadata, treatment/payment/resolution/status and related ledger/litter/attempt links.

### Identity / immutable fields

Event IDs, unique source keys, and unique dog-condition/disease keys are structural identities. Test/outcome immutability after recording is **UNKNOWN** as enforcement, but result/date/roll/version fields are history-sensitive.

### Stored versus derived state

Health display summaries, availability, breeding safety, and phenotype presentation are derived from records plus rules/current epoch. `DogHealthConditionTruth` is stored simulation truth; whether it is a replaceable cache from genotype/rules needs later audit. Emergency outcome metadata is a stored snapshot.

### Authoritative read and mutation paths

Health-test/infectious/emergency/reproductive services are primary writers/readers. Dog health APIs and emergency job routes delegate to them; breeding, market, grooming, and judging import health checks/truth helpers.

### Transaction / atomicity boundary

Health, infectious-disease, emergency-care, and reproductive resolution/treatment services visibly use transactions; emergency events link a ledger transaction where applicable.

### Downstream consumers, deletion / retention, and reconstruction

Dogs, Breeding, Stud Services, Market, Grooming, Judging, and jobs consume records. Test dates/results, emergency ruleset/seed/rolls/outcomes, and ledger links support reconstruction. Transfer/death retention and general deletion policy are **UNKNOWN**.

### Primary evidence

Schema health/care models; healthTest, infectiousDisease, emergencyVetCare, reproductive-emergency services; health/emergency engines; focused health/persistence tests.

### Confidence

HIGH.

### Follow-up for later stages

Audit truth-cache regeneration and historical health-result update/deletion policy.

## 11. Ledger, Economy, Market, and Rehoming

### Owning domain

Economy & Ledger owns accounting records/current balance; Market & Rehoming owns listing and transfer lifecycle.

### Purpose

Persists kennel monetary history and balances alongside sale, foundation purchase, rehome, and listing state.

### Primary storage

`Kennel.balance`; `LedgerTransaction` (type, amount, `balanceAfter`, epoch, dog/show/entry/counterparty references, metadata); `DogListing` (dog, seller/buyer, price/type/status/epochs and requirements).

### Canonical persisted fields

- **Stored current state:** kennel balance; listing status, buyer/seller, price, active/expiry/sold timing; Dog owner/market state after transfer.
- **Ledger/history:** amount, balance-after, transaction type/time, counterparties and source references.
- **History-sensitive:** listing seller/buyer/type/price and sale timing; retained legacy PLAYER_STUD `DogListing`/`BreedingAttempt.studListingId` history is explicitly noted by the task and remains unmodified. Current authority for legacy linkage is not asserted here.

### Identity / immutable fields

Ledger/listing IDs are identities. Ledger append-only behavior is **UNKNOWN** without a complete writer/deletion audit, though the model’s event shape and feature transactions make amount/balanceAfter/type/time history-sensitive.

### Stored versus derived state

Market search/presentation and eligibility are derived from listings/dogs/health/current time. `Kennel.balance` is stored current state; ledger provides event history. Listing requirements are stored constraints, not inferred from current dog state alone.

### Authoritative read and mutation paths

Market/foundation/rehome services and market APIs are main listing paths; `economy.service.ts` and feature services write value-transfer records. Ledger page reads persistence. No single authoritative balance-read/reconciliation path was established.

### Transaction / atomicity boundary

Market, foundation purchase, rehome, and account-closure paths visibly use transactions. These operations coordinate Dog ownership/listing/kennel-run/contract effects and, where applicable, ledger state; complete atomicity semantics require later audit.

### Downstream consumers, deletion / retention, and reconstruction

Dogs, Litters, Stud Services, account closure, player market/ledger UI, and health constraints consume this state. Ledger source links and balance-after values support reconstruction. Listing retention after cancellation/sale is evidenced by status/epochs and the preserved legacy fields; general deletion policy is **UNKNOWN**.

### Primary evidence

Schema Kennel/LedgerTransaction/DogListing; market, foundationDog, rehome, economy, account-closure services; market and litter sale routes/tests.

### Confidence

HIGH for listing lifecycle; MEDIUM for ledger append-only/reconciliation authority.

### Follow-up for later stages

Audit all balance/ledger writers and legacy PLAYER_STUD read authority.

## 12. Stud Offers, Contracts, Selection Rights, and Return Services

### Owning domain

Stud Services & Contracts.

### Purpose

Stores public offer versions and accepted/requested contract terms, lifecycle milestones, puppy-back selection state, and return-service entitlements.

### Primary storage

`StudOffer` and `StudOfferHealthRequirement`; `StudContract` and health requirements; `StudContractPuppySelection`; `StudContractReturnService`, with links to Dogs, Kennels, BreedingAttempt, and Litter.

### Canonical persisted fields

- **Offer/current state:** sire/owner, status/version, compensation, requirements, approval mode, publication timestamps.
- **Contract snapshot/history:** source offer ID/version; sire/dam and kennel IDs; copied compensation/puppy/health/title/approval terms; request/accept/decline/expiry timestamps; attempt/litter links and live-born/qualification snapshots.
- **Selection/entitlement current state:** selection actor/status/deadlines/selected dogs/forfeitures; return-service trigger/status/availability/expiry/use/extinguishment and return attempt.

### Identity / immutable fields

Offer uniqueness is sire/version; contract, selection, return-service and attempt/litter links are uniquely constrained. Accepted-term immutability is not proven as an enforcement claim, but copied contract terms/version and lifecycle timestamps are history-sensitive snapshots.

### Stored versus derived state

Contract history/presentation, eligibility, deadline labels, and offer discovery are derived from records plus current time/rules. Contract term copies and whelp qualification fields are stored snapshots; they should not be treated as redundant current-offer reads.

### Authoritative read and mutation paths

Offer, request, eligibility, lifecycle, selection, history, return-service, and protection services are primary paths; stud APIs/pages and cron lifecycle route delegate to them. Breeding service also writes linked progression/outcomes.

### Transaction / atomicity boundary

Offer, request, selection, and lifecycle services visibly use transactions. Breeding and market/lifecycle transitions invoke protection/return-service logic inside broader transactions.

### Downstream consumers, deletion / retention, and reconstruction

Dogs, Breeding, Litters, Market, Lifecycle, notices, history UI, and cron consumers use this data. Source version, copied terms, participant IDs, dates, selection/forfeiture state, and entitlement status provide historical reconstruction. General deletion policy is **UNKNOWN**; several relations use `onDelete: Restrict`.

### Primary evidence

Schema offer/contract models; stud offer/contract services and cron route; breeding/market/lifecycle imports; contract persistence/history/legacy regression scripts.

### Confidence

HIGH.

### Follow-up for later stages

Establish current versus legacy PLAYER_STUD linkage authority and contract snapshot mutation policy.

## 13. Grooming and Kennel Service Records

### Owning domain

Grooming & Kennel Services.

### Purpose

Stores grooming marketplace/service availability, completed actions, kennel service claims, and dog condition events.

### Primary storage

`GroomingListing`, `GroomingServiceAction`, `KennelServiceClaim`, `KennelServiceProfile`, and `DogConditionEvent`.

### Canonical persisted fields

- **Current state:** listing status/price/groomer/completion; claim status/completion; service profile.
- **Event/history:** action dog/owner/groomer/listing/type/amount/coat gain/epoch and condition-event values.
- **Snapshot-like fields:** service claim show cluster/dog/weekend key and payout/claim timing.

### Identity / immutable fields

Action/event IDs and unique claim constraints define identity. Completed action/event values are history-sensitive; detailed immutability/deletion enforcement is **UNKNOWN**.

### Stored versus derived state

Grooming availability, weekly-action limits, condition display, and action eligibility are derived from records, current epoch, Dog fields, and rules. No persisted appointment/booking model was found; `GroomingServiceAction` is the observed completed-action record.

### Authoritative read and mutation paths

`grooming.service.ts` and `kennelService.service.ts` are primary paths; grooming/service APIs and scheduled grooming-decay job delegate to them. Dog/show-entry services consume their availability/results.

### Transaction / atomicity boundary

Grooming and kennel-service service paths visibly use transactions, including actions/condition effects; exact payment/ledger linkage requires later audit.

### Downstream consumers, deletion / retention, and reconstruction

Dogs, Showing, entry planning, Kennels, and UI consume these records. Action/event fields reconstruct completed activity; retention policy is **UNKNOWN**.

### Primary evidence

Schema grooming/service/condition models; grooming and kennel-service services; job route; grooming regression scripts.

### Confidence

HIGH.

### Follow-up for later stages

Audit condition event versus Dog current-condition cache synchronization and any economy linkage.

## 14. Support Subscription and Provider History

### Owning domain

Support.

### Purpose

Stores external subscription identity/current status and durable tier/change/provider-event history.

### Primary storage

`SupportSubscription`; `SupportSubscriptionTierPeriod`; `SupportSubscriptionChange`; `SupportProviderEvent`. Key fields include provider subscription/event IDs, tier/status, paid period dates, failure/cancellation/end milestones, tier-period dates, and change lifecycle fields.

### Canonical persisted fields

- **Integration/current state:** provider, unique provider subscription ID, current tier/status, paid period and lifecycle timestamps.
- **Historical:** tier-period rows, change records, provider event IDs/types/received/processed status.
- **Presentation only:** supporter badge preference/presentation is not subscription truth.

### Identity / immutable fields

Subscription/event IDs and provider identifiers are unique. Provider events and tier-period/change chronology are history-sensitive. A current subscription must not be inferred from arbitrary ACTIVE rows; current-resolution authority is deferred as required.

### Stored versus derived state

Badge/community presentation derives from subscription-resolution data and preferences. Current paid-through/status interpretation derives from subscription and event/history records; no single authoritative resolution rule is declared here.

### Authoritative read and mutation paths

`supportSubscription.service.ts`, `paypalSupport.service.ts`, and `paypalWebhook.service.ts` are main paths; support APIs and PayPal webhook route delegate to them. Community consumes supporter-badge presentation rather than subscription mutation.

### Transaction / atomicity boundary

Support subscription service uses transactions for lifecycle/change/event work. Webhook processing delegates into those services; idempotency/correctness is deferred.

### Downstream consumers, deletion / retention, and reconstruction

Support UI, account settings, badge/community presentation, webhook processing, and support regression scripts consume data. Provider IDs/events, periods, changes, and lifecycle timestamps support reconstruction. Deletion/retention behavior is **UNKNOWN**; tier-period relation has cascade from subscription in schema.

### Primary evidence

Schema support models; support/PayPal/webhook services and route; support lifecycle/reconciliation/history tests.

### Confidence

HIGH.

### Follow-up for later stages

Audit current-subscription resolution and history retention under cascading relations.

## 15. Community, Messaging, Notices, and Moderation History

### Owning domain

Community; Messaging & Notices; Administration & Operations for moderation/audit.

### Purpose

Persists player-authored public content, private conversation history, player notices, blocks/reports, and moderation/audit actions.

### Primary storage

`BulletinCategory`, `BulletinThread`, `BulletinPost`; `KennelConversation`, participants/messages/blocks/reports; `KennelNotice`; `ModerationAudit`, `UserAccessAudit`; moderation fields on User/Kennel/threads/posts.

### Canonical persisted fields

- **Historical content:** thread/post title/body/authorship/creation/edit epoch; message body/sender/time; notice title/body/type/source key/linked IDs; report/audit action/reason/metadata/time.
- **Mutable current state:** thread/post status/pin/hidden/moderation fields, participant read state, notice read/dismissed epochs, blocks and moderation status.

### Identity / immutable fields

Conversation pair uniqueness and durable content/message IDs identify records. Player-written text and original authorship/timestamps are history-sensitive; edit/moderation paths mean text/status immutability is **UNKNOWN**.

### Stored versus derived state

Unread counts, inbox badges, forum display, supporter badge/author presentation, and linked-entity display are derived at read. Notice source keys provide persisted deduplication identity.

### Authoritative read and mutation paths

`bulletin.service.ts`, `kennelMessaging.service.ts`, `kennelNotice.service.ts`, and communication moderation service are main paths; community/bulletin/inbox/notices/admin routes delegate to them.

### Transaction / atomicity boundary

Bulletin and messaging services visibly use transactions. Broad notice producer operations occur within their originating domain transactions where observable; no universal notice atomicity rule is established.

### Downstream consumers, deletion / retention, and reconstruction

Player pages/inbox/admin reports and event-producing domains consume these records. Authorship, timestamps, message body, notices, report/audit metadata reconstruct activity. Deletion/soft-delete policy varies or is **UNKNOWN**; posts have hidden/moderation state and notices have dismissed state.

### Primary evidence

Schema content/conversation/notice/audit models; bulletin/messaging/notice/moderation services; Community and Inbox APIs.

### Confidence

HIGH.

### Follow-up for later stages

Audit authored-content edit/history retention and moderation/audit correlation semantics.

## 16. Breed Art Funding and Payment State

### Owning domain

Breed Art & Funding.

### Purpose

Stores campaign funding configuration/current status, contributor attribution/recognition, PayPal payment workflow state/events, and completed artwork.

### Primary storage

`ArtCampaign`, `ArtContribution`, `ArtPaymentAttempt`, `ArtPaymentProviderEvent`, `ArtArtwork`; relations to Breed, User, and Kennel.

### Canonical persisted fields

- **Campaign/reference/current state:** breed/key, title, funding goal/unit/allocation fields, status/funded time.
- **Historical recognition:** contributor/user/kennel, requested/funded units, amount, recognition choice, provider payment ID, request/funding timestamps.
- **Integration state:** client/provider request/order/authorization/capture IDs, approval/reservation/expiry/terminal status/times, provider-event processing state.
- **Artwork history:** campaign link, artist credit, asset reference, completion time.

### Identity / immutable fields

Campaign is unique per breed/key; contribution-payment and provider IDs are unique; attempt user/client request is unique. Financial attribution/recognition/provider IDs are history-sensitive. Mutability of campaign targets/allocation after creation is **UNKNOWN**.

### Stored versus derived state

Funding progress/board filters and completed gallery presentation are derived from campaign/contribution/payment state. Campaign total funding is not separately stored in the inspected schema; progress is calculated in `artCampaign.service.ts`. Provider workflow statuses are stored integration state, not presentation-only.

### Authoritative read and mutation paths

Art campaign/payment-attempt/finalization/webhook/reconciliation/replay/artwork-completion services are the observed paths. Checkout/finalize/admin APIs, PayPal webhook, and configured cron routes delegate to them.

### Transaction / atomicity boundary

Art payment finalization and artwork completion visibly use transactions; reconciliation/replay call the corresponding runners. Transaction correctness is not assessed.

### Downstream consumers, deletion / retention, and reconstruction

Funding board, checkout, gallery, admin completion, webhook, and cron consumers read this state. Attempt/provider IDs, contribution attribution, status/timestamps, and artwork credit support reconstruction. General deletion/retention policy is **UNKNOWN**; several key relations are `onDelete: Restrict`.

### Primary evidence

Schema Art models; art campaign/payment/finalization/webhook/replay/completion services; APIs/webhook/cron and art persistence/concurrency tests.

### Confidence

HIGH.

### Follow-up for later stages

Audit campaign funding-progress calculation and payment-attempt terminal-state authority.

## 17. Persistent Relationship Landmarks

```text
User
  └─ Kennel
      ├─ Dog ── parentage → Dog
      │   ├─ BreedingAttempt → Litter → puppies (Dog)
      │   ├─ Health / emergency / disease records
      │   ├─ ShowEntry → ShowResult → ShowAward → title/prestige credits
      │   ├─ DogListing / StudOffer / StudContract
      │   └─ Grooming/service/condition records
      ├─ LedgerTransaction
      ├─ Bulletin/community and conversations/notices
      └─ art contributions/payment attempts

User → SupportSubscription → tier periods / changes
ShowCluster → ShowDay → judging blocks, entries, results, awards
Breed → Dogs, show records, profiles/background, annual schedules, art campaigns
```

## 18. Historical Truth Register

| Concept | Durable source | May current rules rewrite it? | Retention expectation | Confidence |
| --- | --- | --- | --- | --- |
| Dog identity | `Dog.id` | NO | preserve | HIGH |
| Registration number | unique `Dog.regNumber` | NO | preserve | HIGH |
| Sire/dam/pedigree | Dog parent links, Litter, breeder links | UNKNOWN | preserve as high-risk history | HIGH |
| Breeder identity | `Dog.breederKennelId`, `Litter.bredByKennelId` | UNKNOWN | preserve | HIGH |
| Health-test outcomes | Health/infectious test records | UNKNOWN | retain as history-sensitive | HIGH |
| Published ShowResults | `ShowResult` | UNKNOWN | retain as published history | HIGH |
| ShowAwards/points | `ShowAward`, credit records | UNKNOWN | retain as history-sensitive | HIGH |
| Title history | credits, awards, progress records | UNKNOWN | retain | HIGH |
| Ledger history | `LedgerTransaction` | UNKNOWN | retain as ledger history | MEDIUM |
| Accepted stud terms | `StudContract` copied terms/version | NO for historical interpretation | retain | HIGH |
| Support payment/tier history | provider events, changes, periods | UNKNOWN | retain subject to relationship policy | HIGH |
| Player messages/posts | message/post/thread records | UNKNOWN | retain/moderate according to existing paths | HIGH |

## 19. Major Derived State Register

| Derived concept | Source data | Where derived | Persisted too? | Authority note |
| --- | --- | --- | --- | --- |
| Dog age | `Dog.birthEpoch` + current epoch | game-clock/profile paths | no observed age field | derived at read |
| Lifecycle eligibility | Dog lifecycle/death + current epoch | lifecycle service/rules | lifecycle state is stored | rule result is derived |
| Visible conformation categories | persisted traits/health truth + rules | dog-visible-category/phenotype helpers | no dedicated category table found | boundary partly UNKNOWN |
| Pregnancy/breeding display | `BreedingAttempt` + current epoch | breeding/dog read paths | attempt state stored | display derived |
| Show eligibility/availability | show/entry/dog/service/current time state | show availability/entry services | status inputs stored | eligibility derived |
| Breeding eligibility | dog/health/contract/calendar data | breeding eligibility service/rules | no dedicated result table found | derived at mutation/read |
| Championship display | title progress, awards, credits | title/ribbon/dog mapper paths | summaries partly persisted | cache authority UNKNOWN |
| Supporter badge | subscription resolution + preference | support/community presentation helpers | preference stored; badge display not truth | presentation derived |
| Grooming availability | listing/action/condition/current time | grooming service | input state stored | derived |
| Annual schedule presentation | published schedule records | annual schedule/show/judging paths | yes | records are persisted inputs |
| Kennel dog counts | Dog ownership/run relations | pages/services | no count field observed | derived at read |
| Art funding progress | contributions/payment state | art campaign service | no aggregate schema field observed | derived at read |

## 20. Questions for Later Architecture Stages

- No single authoritative Dog or show read path was established; services and direct Prisma page reads coexist.
- Dog COI/title/producer and yearly prestige fields may be persisted caches; synchronization/rebuild authority needs Stage 4 inspection.
- Health-condition truth may be derived from genetics/rules but is persisted; cache source and invalidation are unresolved.
- The full balance/ledger reconciliation and append-only guarantees are not established.
- Published result/award update or correction policy is not established from static inspection.
- Legacy PLAYER_STUD listing/attempt linkage remains historically preserved; current read authority needs focused audit.
- Support current-subscription resolution cannot be inferred from a status row alone.
- Some contract, event, and payment retention semantics depend on relation policies and code paths not exhaustively traced.

No implementation, data, schema, or Master File reconciliation was performed in this stage.
