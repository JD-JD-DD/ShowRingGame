# ShowRing Canonical Rule Registry

## 1. Purpose

This registry records current production authority for major business and simulation rules. **CANONICAL** means current implementation authority, not permanent design approval. The Master File remains design authority; relevant production/design differences are recorded, not fixed. This registry excludes generic helpers unless they participate in a business-rule chain.

## 2. Canonical Rule Standard

Authority was established in this order: production mutation/finalization behavior; service call paths; rules/helpers consumed by those paths; focused regression coverage; persistent effects; presentation consumers; then consistent comments/docs. A local service validation is recorded as current authority when a mutation relies on it rather than on a shared helper.

## 3. Rule Summary Table

| Concept | Owning domain | Canonical rule/helper | Authoritative server gate | Secondary rechecks | Presentation consumers | Classification notes | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Game clock/calendar | Calendar | `lib/gameClock.getCurrentEpoch` | time-sensitive services/jobs | none established | time/countdown formatters | rules `src/time.getCurrentEpoch(nowMs)` is related; production imports lib path | HIGH |
| Dog age/lifecycle | Lifecycle | lifecycle service + rules constants | `markDogDeceased`, mortality cron | show/judging age checks | dog profile | age is locally computed from epoch in several contexts | MEDIUM |
| Show entry eligibility | Showing | `getShowEntryEligibilityReason` / `canEnterShowBlock` | `createShowEntry`, bulk cluster entry | judging disposition at event time | planner/dog/show availability | later judging recheck is intentional variant | HIGH |
| Breeding eligibility | Breeding | `getIndividualBreedingEligibility` | `createBreedingAttemptForKennel` / stud breeding paths | contract request/offer checks | dog/planner messages | rules breeding engine is a related lower-level variant | HIGH |
| Post-whelp recovery | Breeding | breeding eligibility helper with cooldown constants | breeding creation | judging post-whelp check | dog/planner/show UI | show and breed recovery have context-specific durations | HIGH |
| Pregnancy progression | Breeding | `resolveDueBreedingProgressBatch` | breeding cron | owned-dam/read-path resolution | dog/litter display | stored attempt status, display derived | HIGH |
| Health-test eligibility | Health & Care | health/infectious service mutation validations | single/bulk test services | none established | previews/disabled reasons | phenotype and brucellosis are intentional variants | HIGH |
| Health-result presentation | Health & Care | persisted tests/truth + rules label helpers | no mutation gate | n/a | dog/market/stud/pedigree | presentation only | HIGH |
| Grooming eligibility | Grooming | grooming service local checks | self-groom/list/accept services | decay/job and judging inputs | grooming summary/UI | listing, booking, completion differ by lifecycle stage | HIGH |
| Market/sale eligibility | Market | `getDogSaleEligibility` | list/bulk-list/purchase services | purchase recheck | market/dog/litter UI | foundation and player market are intentional variants | HIGH |
| Ownership/transfer | Market & Rehoming | purchase/rehome transactional services | buy/rehome mutations | contract/lifecycle protections | dog profile | owner field is durable truth; breeder retained | HIGH |
| Economy/balance mutation | Economy & Ledger | no single helper established | feature transaction writers | balance checks at mutation | ledger/balance UI | `economy.service.ts` has no exported authority found | MEDIUM |
| Ledger recording | Economy & Ledger | feature-local ledger writes | feature transaction writers | n/a | ledger UI | no universal append/write gate established | MEDIUM |
| Championship points | Championships/Judging | annual schedule + judging engine thresholds | judging/finalization | title application from persisted awards | results/title UI | stored award context is historical snapshot | HIGH |
| CH/GCH progression | Championships | title/grand-champion services | judging finalization | recalculation/promotion | dog/ribbon display | title display fields may be caches | HIGH |
| Kennel prestige | Championships/Kennels | `refreshPrestigeStatsForShowDay` | judging finalization | batch/read summaries | community/public kennel | presentation badge is separate | MEDIUM |
| Supporter state | Support | `getCanonicalSupportSubscription` | subscription/webhook lifecycle services | verified reconciliation | support/account pages | canonical resolver explicitly used by pages/services | HIGH |
| Supporter badge | Support | `getSupporterBadgePresentation` | no gameplay mutation | n/a | community/public/account views | PRESENTATION; preference is stored | HIGH |
| Stud/contract eligibility | Stud Services | offer/request/contract eligibility services | publish/request/approve/breeding paths | lifecycle deadlines/selections | offer/contract pages | biological and commercial validation intentionally differ | HIGH |
| Show entry cost/routing | Showing | show-entry service + rules economy constants | single/bulk entry transactions | block reconciliation | entry planner | route/cost details distributed; no one quote helper proven | MEDIUM |
| Finalization/judging routing | Judging | `runPublishShowResultsJob` → judging functions | cron/jobs and authorized routes | block/day/finalizer stages | results UI | staged processing is intentional variant | HIGH |
| Visible categories | Genetics/Dogs | `deriveVisibleCategoriesFromTraits` via dog-visible service | no irreversible mutation gate | judging derives show characteristics separately | dog/market/planner/pedigree | display and judging are intentional variants | HIGH |
| Kennel management eligibility | Kennels/Dogs | action-specific service validation | bulk naming/run/sale/rehome services | action-time ownership checks | kennel/dog UI | no common “can manage” authority established | MEDIUM |
| Active breed/release | Breeds | Breed service/released code reads | foundation inventory and feature mutations | service-specific active checks | catalog/market | no universal active-breed gate established | MEDIUM |
| Unread notices/messages | Messaging & Notices | messaging/notice read-count services | read/hide/block mutations | n/a | header/inbox badges | notices and conversations are intentional separate sources | HIGH |

## 4. Game Clock, Age, Lifecycle, and Recovery

### Owning domain

Calendar & Game Time; Lifecycle; Breeding.

### Rule meaning

Converts wall-clock time into integer game epochs, derives age, and gates time-dependent death, breeding recovery, and show participation.

### Canonical implementation

`apps/web/lib/gameClock.ts:getCurrentEpoch` is the production current-epoch source imported by services and cron/job paths. Lifecycle mutation authority is `lifecycle.service.ts:markDogDeceased` / `resolveDogDeaths`; breeding recovery authority is `breedingEligibility.service.ts:getIndividualBreedingEligibility` using rules constants.

### Authoritative server validation

Mortality cron calls `resolveDogDeaths`; breeding creation calls breeding eligibility; show entry calls its own show eligibility helper. No universal age service is used by every context.

### Secondary rechecks

Judging’s `getBlockJudgingEntryDisposition` recalculates age, pregnancy, and post-whelp rest at the show time. This is an **INTENTIONAL VARIANT**: conditions can change between entry and judging.

### Presentation consumers

`dog.service.ts`, show availability/planner paths, countdown/time formatters, and breeding eligibility messages explain derived state.

### Related implementations

| Location | Classification | Evidence / difference | Confidence |
| --- | --- | --- | --- |
| `packages/rules/src/time.ts:getCurrentEpoch(nowMs)` | DERIVED / UNKNOWN | mathematically related clock utility; production services import `lib/gameClock` | MEDIUM |
| local age arithmetic in dog, breeding, judging services | INTENTIONAL VARIANT | each evaluates age at a different domain event time | HIGH |
| Master File lifecycle statement that state is never stored directly | DIVERGENT | production `Dog.lifecycleState` is persisted and mutated | HIGH |

### Inputs / outputs / persistence interaction

Inputs are `Date.now()`, epoch constants, dog birth/death/lifecycle state, attempt/event epochs. Outputs are epoch, age, eligibility/reason, and lifecycle mutation. Lifecycle writes Dog state; age itself is derived.

### Design-authority comparison

**PARTIAL MATCH:** Master File specifies integer gameplay epochs and real `DateTime` audit timestamps, matching production. It also says lifecycle state is never stored directly, while production stores `Dog.lifecycleState`; **CONFLICT** is recorded below.

### Drift risk / confidence / follow-up

Risk **HIGH** because multiple event-time calculations are necessary but easy to confuse. Confidence **HIGH** for clock/mortality and **MEDIUM** for a single age authority. Later audit: consolidate only after preserving intentional event-time variants.

## 5. Show Entry, Eligibility, Cost, and Judging Rechecks

### Owning domain

Showing; Judging; Grooming & Kennel Services.

### Rule meaning

Determines whether a dog can enter a show block/day and records fees/routing; later determines whether an entered dog is actually judged.

### Canonical implementation

Entry-time authority is `showEntry.service.ts:getShowEntryEligibilityReason` / `canEnterShowBlock`, enforced by `createShowEntry` and `createShowEntriesForCluster`. Judging-time authority is `judging.service.ts:getBlockJudgingEntryDisposition`, called by judging block/day paths.

### Authoritative server validation

Show-entry mutation services gate single and bulk entry in transactions. Judging functions persist absence/disposition/results only after their event-time disposition path.

### Secondary rechecks

Judging rechecks lifecycle, pregnancy, post-whelp, and age at scheduled show time; this is **INTENTIONAL VARIANT**, not duplicate entry validation. Ownership/entry existence is also rechecked in mutation paths.

### Presentation consumers

`showAvailability.service.ts`, dog show-entry planner, dog page, show pages, and entry option builders provide display/selection data; they do not become the mutation authority.

### Related implementations

| Location | Classification | Evidence / difference | Confidence |
| --- | --- | --- | --- |
| `showAvailability.service.ts` | PRESENTATION / DERIVED | builds availability/display status from stored schedule and entry inputs | HIGH |
| `dogShowEntryPlanner.service.ts` | PRESENTATION / DERIVED | planner data and fee/routing display | HIGH |
| judging disposition | INTENTIONAL VARIANT | evaluates at show time and emits absence reason | HIGH |
| entry cost constants in `@showring/rules` | CANONICAL INPUTS | used by entry-related services; one quote function not established | MEDIUM |

### Inputs / outputs / persistence interaction

Inputs include Dog state/age, attempts, show day/block epochs/status, kennel/service context and economy constants. Outputs are eligibility/reason/availability and persisted `ShowEntry` snapshots, fee, handler/routing data. Entry and judging services visibly use transactions.

### Design-authority comparison

**NOT SPECIFIED** for the exact current routing chain.

### Drift risk / confidence / follow-up

Risk **CRITICAL**: invalid entries or historical outcome effects. Confidence **HIGH** for gates, **MEDIUM** for a single cost-quote authority. Later inspect all cost writers and grooming/handler treatment.

## 6. Breeding, Pregnancy, Post-Whelp, and Stud Eligibility

### Owning domain

Breeding; Stud Services & Contracts; Health & Care.

### Rule meaning

Gates biological pair eligibility, advances attempt state, imposes post-whelp/reproductive recovery, and separately validates commercial stud/contract requirements.

### Canonical implementation

`getIndividualBreedingEligibility` is the current reusable biological eligibility authority consumed by breeding and presentation flows. `createBreedingAttemptForKennel`, automatic/manual contract breeding, and `resolveDueBreedingProgressBatch` are authoritative mutation/progression paths. Contract offer/request/lifecycle services own commercial terms, deadlines, selections, and return services.

### Authoritative server validation

Breeding creation and contract execution check ownership, dog/lifecycle/breed/age/attempt/recovery and health/contract preconditions. Progression is run through the breeding cron route. Contract request/publish paths perform their own offer/health/approval validation.

### Secondary rechecks

Contract checks at request/approval/execution and lifecycle checks at deadline/whelp are **INTENTIONAL VARIANTS**: commercial agreement, changed health/care, and post-whelp state are not the same biological question.

### Presentation consumers

Dog status, breeding planner, public stud/contract pages, and `getBreedingEligibilityMessage` display decisions.

### Related implementations

| Location | Classification | Evidence / difference | Confidence |
| --- | --- | --- | --- |
| rules `canBreedSire`, `canBreedDam`, `validateBreedingPair` | DERIVED / INTENTIONAL VARIANT | pure engine operates on simplified rule inputs; production gate adds durable health/contract/lifecycle checks | HIGH |
| `breedGeneticBackground.service` age check | INTENTIONAL VARIANT | filters population/background context, not mutation eligibility | MEDIUM |
| dog/planner status logic | PRESENTATION | exposes eligibility/reasons | HIGH |

### Inputs / outputs / persistence interaction

Inputs: current epoch, Dog/attempt/reproductive event/health state, breed/sex, ownership, contract/offer state. Outputs: eligibility/reason, attempt state, litter/puppy outcomes and contract lifecycle changes. Breeding, contracts, and progression have visible transactions.

### Design-authority comparison

**NOT SPECIFIED** for exact current contract architecture.

### Drift risk / confidence / follow-up

Risk **CRITICAL** due to irreversible attempts/litters/contracts. Confidence **HIGH**. Later establish the exact relationship between pure engine and service-level canonical gate.

## 7. Health Testing, Health Presentation, and Care

### Owning domain

Health & Care.

### Rule meaning

Determines who can run phenotype or brucellosis testing, records results/truth, and controls emergency-care restrictions.

### Canonical implementation

`runPhenotypeHealthTestForKennel` / bulk variants are authoritative phenotype mutation paths; `executeBrucellosisScreeningForKennelTx` / bulk variants are authoritative disease-test paths. `ensurePhenotypeHealthTruthsForDogs` supplies stored truth as needed. Rules health functions provide result generation/labels.

### Authoritative server validation

Dog health APIs delegate to these services; service checks cover ownership and current dog/care context. Bulk paths prepare then persist within transactions.

### Secondary rechecks

Single versus bulk and phenotype versus brucellosis are **INTENTIONAL VARIANTS** because test category, validity, and workflow differ. Later eligibility checks in breeding/market/contract services consume the resulting records.

### Presentation consumers

Dog, market, stud, pedigree and kennel displays use health summaries/labels/color states; those are **PRESENTATION** relative to persisted test/truth state.

### Related implementations

| Location | Classification | Evidence / difference | Confidence |
| --- | --- | --- | --- |
| `health.engine:getPhenotypeHealthResultLabel` | PRESENTATION | label conversion from stored result | HIGH |
| health-test preview functions | PRESENTATION / DERIVED | disabled/price/result preview without mutation | HIGH |
| brucellosis screening service | INTENTIONAL VARIANT | disease-specific validity/transmission model | HIGH |

### Inputs / outputs / persistence interaction

Inputs: Dog, test definition/rules, age, ownership, care status and current epoch. Outputs: eligibility/errors, test records, health truth/disease records. Health/care services visibly transact linked writes.

### Design-authority comparison

**NOT SPECIFIED**.

### Drift risk / confidence / follow-up

Risk **HIGH**. Confidence **HIGH**. Later audit source/invalidation authority for persisted health truth.

## 8. Grooming, Market, Ownership, Economy, and Ledger

### Owning domain

Grooming & Kennel Services; Market & Rehoming; Economy & Ledger.

### Rule meaning

Gates grooming actions/listings and market listings/purchases, then performs ownership/current-state and money/ledger changes.

### Canonical implementation

Grooming authority resides in `selfGroomDog`, `listDogForOutsideGrooming`, and `acceptGroomingJob`. Player-market authority is `getDogSaleEligibility`, `listDogForSale`, `bulkListDogsForSale`, `buyPlayerDogListing`, and cancellation; foundation-market authority is `foundationDog.service:buyFoundationDog`. Rehome has `rehome.service` transaction paths. No standalone canonical Economy or Ledger helper was established.

### Authoritative server validation

These services enforce mutation-time ownership, lifecycle/care/age/listing status, provider/owner, weekly/action constraints, and balance checks as applicable. Routes delegate to them.

### Secondary rechecks

Listing acceptance versus completion, listing versus purchase, and listing versus transfer/contract protection are **INTENTIONAL VARIANTS** because state can change. Foundation purchase and player purchase are **INTENTIONAL VARIANTS** with distinct inventory/seller flows.

### Presentation consumers

Grooming summaries, market pages, dog/litter controls, and disabled reasons are **PRESENTATION/DERIVED**. They may approximate availability but do not authorize mutation.

### Related implementations

| Location | Classification | Evidence / difference | Confidence |
| --- | --- | --- | --- |
| foundation purchase/inventory | INTENTIONAL VARIANT | dedicated inventory generation and NPC purchase flow | HIGH |
| player listing/purchase | CANONICAL for player sales | seller/buyer listing lifecycle | HIGH |
| `reproductiveEmergencyTreatment.service` direct balance update | UNKNOWN | explicit `Kennel.balance` update; ledger relationship must be audited before classifying bypass | MEDIUM |
| `economy.service.ts` | UNKNOWN | no exported authority found in inspected file | HIGH |

### Inputs / outputs / persistence interaction

Inputs include Dog/Kennel ownership, state, health/care, service/listing records, current epoch and price. Outputs include listings, owner changes, grooming actions/condition events, balance/ledger effects. Market, foundation, rehome, grooming, and care writers visibly use transactions.

### Design-authority comparison

**PARTIAL MATCH:** Master File describes market/conditioning concepts, while production’s current grooming/service and contract-protection paths are more specific; exact rule comparison was not completed.

### Drift risk / confidence / follow-up

Risk **CRITICAL** for transfer/balance corruption. Confidence **HIGH** for feature mutation paths, **MEDIUM** for universal money/ledger authority. Later trace every balance writer and ledger-row expectation.

## 9. Judging, Points, Titles, Prestige, and Visible Categories

### Owning domain

Judging; Championships, Titles & Prestige; Genetics/Dogs for player-visible categories.

### Rule meaning

Routes eligible entries through breed/group/BIS judging, persists results/awards, applies points/title/prestige credits, and derives separate player-visible phenotype categories.

### Canonical implementation

`runPublishShowResultsJob` orchestrates batch processing; `judgeShowBlock`, `judgeShowDay`, `publishReadyShowDayResults`, and `finalizeReadyShowDayResults` are current finalization authorities. Shared judging engine functions calculate competition/judging/threshold behavior. Annual schedule service/engine provides point schedules; title/grand-champion/prestige services apply durable progression. `deriveVisibleCategoriesFromTraits` is current player-visible category computation through `dogVisibleCategories.service`.

### Authoritative server validation

Cron/job routes authorize and invoke `runPublishShowResultsJob`; judging validates entry disposition before persisted results/awards. Title/prestige/grand-champion writes occur during this downstream finalization orchestration.

### Secondary rechecks

Block, day, result-publication, and finalizer phases are **INTENTIONAL VARIANTS** in an ordered batch lifecycle. Points/title application consumes persisted award/result context rather than being a UI recalculation. Player-visible categories and `deriveShowCharacteristicsFromTraits` are **INTENTIONAL VARIANTS**: display directionality and judging interpretation have different consumers.

### Presentation consumers

Results pages, dog show records, ribbon room, public/kennel summaries, market/planner/pedigree visible categories, and prestige/badge components display derived/snapshotted outcomes.

### Related implementations

| Location | Classification | Evidence / difference | Confidence |
| --- | --- | --- | --- |
| `ShowAward` / `ShowResult` fields | CANONICAL HISTORICAL SNAPSHOT | points, competition counts, scoring/profile versions persisted at judging | HIGH |
| current annual schedule calculation | DERIVED for future/current schedule | historical award context must not be reconstructed from current dog state | HIGH |
| Dog title prefix/suffix fields | UNKNOWN cache authority | progress/credits and visible fields coexist | MEDIUM |
| visible category derivation vs judging characteristics | INTENTIONAL VARIANT | separate engine/service call paths and explicit focused tests | HIGH |

### Inputs / outputs / persistence interaction

Inputs: entries, scheduled epoch, Dog traits/health, breed profiles, annual point schedule, judges and stored history. Outputs: dispositions, results, awards, credits, title/prestige updates and notices. High-risk writes occur within judging transactions.

### Design-authority comparison

**PARTIAL MATCH:** Master File specifies directional 0–20 visible categories and separate optimized conditioning; focused rules tests and current visible-category engine support that split. Exact judging implementation parity is **UNKNOWN**.

### Drift risk / confidence / follow-up

Risk **CRITICAL** for historical results/points. Confidence **HIGH** for finalization chain and category split; **MEDIUM** for title-display cache authority. Later audit finalization idempotency and title-summary writers.

## 10. Support, Supporter Badge, and Art Funding

### Owning domain

Support; Breed Art & Funding.

### Rule meaning

Selects current support subscription and derives voluntary supporter badge visibility; independently processes art payment/campaign contribution lifecycle.

### Canonical implementation

`supportSubscription.service:getCanonicalSupportSubscription` is current subscription-selection authority, called by support/account/public-kennel pages and lifecycle operations. Subscription create/change/cancel/reconcile and verified webhook paths are authoritative mutations. `getSupporterBadgePresentation` is the canonical badge display derivation. Art contribution/payment authority is art campaign/payment attempt/finalization/webhook services.

### Authoritative server validation

Support API/webhook routes delegate to support/PayPal services; art checkout/finalize/webhook/cron delegate to art payment services. Badge preference route only writes `Kennel.showSupporterBadge` and does not mutate subscription truth.

### Secondary rechecks

Verified PayPal synchronization/reconciliation and elapsed cancellation processing are **INTENTIONAL VARIANTS** for provider versus local lifecycle timing. Art payment finalization/replay/reconciliation are **INTENTIONAL VARIANTS** for external payment progression.

### Presentation consumers

Community batch badge loader, account/support/public kennel views and `SupporterBadge` are **PRESENTATION**. Badge state does not gate inspected gameplay services.

### Related implementations

| Location | Classification | Evidence / difference | Confidence |
| --- | --- | --- | --- |
| `getCommunitySupporterBadgePresentations` | DERIVED | batch loads canonical subscription plus kennel preference | HIGH |
| `getSupporterBadgePresentation` | PRESENTATION | tier/status/paid-through/preference → visible tier | HIGH |
| arbitrary `SupportSubscription` status query | UNKNOWN | no competing production selector found; do not infer authority | HIGH |
| Art payment vs Support payment | INTENTIONAL VARIANT | separate models/services/webhook dispatch | HIGH |

### Inputs / outputs / persistence interaction

Inputs: provider IDs/events, status/period/change records, current time and badge preference. Outputs: current subscription/tier lifecycle or a presentation DTO; art writes attempts/contributions/events. Support and art services visibly use transactions.

### Design-authority comparison

**NOT SPECIFIED**.

### Drift risk / confidence / follow-up

Risk **HIGH** for externally funded state; supporter badge risk is **LOW**/cosmetic. Confidence **HIGH**. Later inspect all bulk/current subscription resolvers and provider-event idempotency.

## 11. Notices, Messaging, Breed Release, and Kennel Management

### Owning domain

Messaging & Notices; Breeds & Catalog; Kennels/Dogs.

### Rule meaning

Computes unread state, controls message conversation access/read state, filters released breed use, and gates action-specific kennel bulk management.

### Canonical implementation

`getUnreadKennelConversationCount`, `getUnreadKennelNoticeCount`, and their corresponding mark/read/hide/block service mutations are authoritative for their separate sources. Breed release reads are centered on `breed.service:getReleasedBreedCodes`; action-specific bulk services are mutation authorities for naming, run assignment, sale, and rehome.

### Authoritative server validation

Inbox/notices routes delegate to messaging/notice services; breed consumers and foundation inventory call breed services; bulk APIs delegate to their action services.

### Secondary rechecks

Conversation block/hide/read states are **INTENTIONAL VARIANTS** of messaging lifecycle. Bulk action eligibility differs by action (naming/moving/selling/rehome), so no generic canonical “can manage dog” rule is established.

### Presentation consumers

Header badges and inbox components are **PRESENTATION/DERIVED** from separate notice and conversation counts; catalog and kennel UI are presentation consumers.

### Related implementations

| Location | Classification | Evidence / difference | Confidence |
| --- | --- | --- | --- |
| notice unread count | INTENTIONAL VARIANT | `KennelNotice` read/dismiss state | HIGH |
| message unread count | INTENTIONAL VARIANT | participant/read-message conversation state | HIGH |
| dog profile action flags | PRESENTATION | derived UI controls, service still validates | HIGH |

### Inputs / outputs / persistence interaction

Inputs include kennel identity, message/notice read state, Dog lifecycle/ownership/run state, and Breed active/release state. Outputs are count/action availability or durable read/block/bulk-action changes.

### Design-authority comparison

**NOT SPECIFIED**.

### Drift risk / confidence / follow-up

Risk **MEDIUM** for player experience; **HIGH** for incorrect bulk mutations. Confidence **HIGH** for unread sources, **MEDIUM** for a universal breed/management gate. Later audit every active-breed check.

## 12. Canonical Rule Chains

```text
SHOW ENTRY
UI/planner → /api/shows/[showId]/enter → createShowEntry/createShowEntriesForCluster
→ canEnterShowBlock/getShowEntryEligibilityReason → fee/ledger effects in transaction → ShowEntry

BREEDING
UI → /api/breedings → createBreedingAttemptForKennel
→ getIndividualBreedingEligibility → contract/health checks where applicable
→ feature money effects → BreedingAttempt → due cron → litter persistence

SHOW FINALIZATION
Vercel cron /api/cron/finalize-show-results → runPublishShowResultsJob
→ judging disposition → judgeShowBlock/day → ShowResult / ShowAward
→ title, grand-champion, prestige progression

HEALTH TESTING
UI → dog health API → runPhenotypeHealthTestForKennel or brucellosis service
→ service eligibility → transactional test/truth write → HealthTestRecord

GROOMING
UI → grooming API → selfGroomDog/listDogForOutsideGrooming/acceptGroomingJob
→ lifecycle/availability checks → transaction → action/condition/listing records → later judging inputs

SUPPORT
UI or PayPal webhook → subscription service → provider/event state
→ getCanonicalSupportSubscription → getSupporterBadgePresentation → badge UI

MARKET PURCHASE
UI → market API → buyPlayerDogListing or buyFoundationDog
→ mutation-time eligibility → transaction / balance-ledger effects → owner/listing state
```

## 13. Rule Drift Register

| Concept | Canonical authority | Other implementation | Classification | Behavioral difference | Player/data risk | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| Lifecycle state | lifecycle service + persisted `Dog.lifecycleState` | Master File says state is never stored directly | DIVERGENT | design/current implementation differ | high | later design decision |
| Current epoch | `lib/gameClock` production imports | rules `src/time` helper | UNKNOWN | both compute game time; production call authority differs | high | trace deployment/test callers |
| Economy mutations | feature transaction writers | direct care balance update; no exported economy authority | UNKNOWN | universal ledger/balance pattern not proven | critical | full writer inventory |
| Dog title display | title/credit services | Dog visible title fields | UNKNOWN | cache versus primary truth unresolved | high | title cache audit |
| Legacy PLAYER_STUD linkage | current StudOffer/StudContract services | preserved historical listing/attempt linkage | LEGACY | historical compatibility retained | high | current read authority |

## 14. Presentation-Only Rule Register

| Presentation concept | Source truth | Presentation implementation | Independently recalculates business rule? | Classification | Confidence |
| --- | --- | --- | --- | --- | --- |
| Dog breeding status | attempts/eligibility | dog service/planner/messages | explains status; mutation service still gates | PRESENTATION | HIGH |
| Show availability | show/dog/current epoch | show availability/planner | yes, for display/selection only | DERIVED | HIGH |
| Health colors/labels | tests/truth | health engine and UI helpers | label conversion only | PRESENTATION | HIGH |
| Supporter badge | canonical subscription + preference | badge/community batch helpers | no gameplay gate | PRESENTATION | HIGH |
| Visible categories | hidden traits/health rules | dog-visible service, market/planner | display derivation; judging has separate path | DERIVED | HIGH |
| Unread header badge | notices + conversations | inbox/header components | no mutation | PRESENTATION | HIGH |

## 15. Legitimate Secondary Rechecks

| Concept | Initial validation | Secondary validation | Why recheck exists | Classification | Confidence |
| --- | --- | --- | --- | --- | --- |
| Show eligibility | entry service | judging disposition | dog state/age/pregnancy can differ at show time | INTENTIONAL VARIANT | HIGH |
| Breeding/contract | offer/request | approval/execution/lifecycle | agreement and health/state can change | INTENTIONAL VARIANT | HIGH |
| Listing/transfer | listing creation | purchase/rehome/contract protection | ownership/lifecycle/care can change | INTENTIONAL VARIANT | HIGH |
| Grooming | listing/self action | acceptance/completion/decay | provider/action/week state differs by phase | INTENTIONAL VARIANT | HIGH |
| Support | provider operation | verified sync/reconcile/expiration | external and local lifecycle timing differ | INTENTIONAL VARIANT | HIGH |

## 16. Design / Implementation Conflicts

| Concept | Master File design | Current production implementation | Classification | Resolution status |
| --- | --- | --- | --- | --- |
| Lifecycle state | “lifecycle state itself is never stored directly” | `Dog.lifecycleState` is persisted and lifecycle services mutate it | CONFLICT | UNRESOLVED — LATER DESIGN DECISION |
| Game time epochs | integer gameplay epochs; real audit timestamps | integer `*Epoch` fields plus `createdAt`/`updatedAt` and `lib/gameClock` | MATCHES | UNRESOLVED — LATER DESIGN DECISION |
| Conditioning/handling | separate optimized 0–10 category | current grooming/service and judging/visible-category paths exist; exact parity not fully traced | PARTIAL MATCH | UNRESOLVED — LATER DESIGN DECISION |

## 17. Follow-up Boundary

This registry records current authority only. It does not authorize consolidation, rule changes, Master File edits, or refactors.
