# ShowRing Game — Master File vNext

## Document Authority

This Master File is ShowRing's design authority: it defines what the game means, the player promises it makes, and the deliberately chosen rules that future work must preserve. The documents in `docs/ARCHITECTURE/` are implementation authority and reference: they locate the present code, persistence, services, and known architecture risks.

- **LOCKED DESIGN** is binding game-design intent. It changes only through an explicit Master File revision.
- **CURRENT IMPLEMENTATION REFERENCE** is informational evidence and may move as code moves. Production behavior must not silently redefine design.
- **CALIBRATION** locks a system's role while allowing explicit simulation/testing to tune its values.
- **TBD / DESIGN DECISION REQUIRED**, **FUTURE / OUT OF SCOPE**, **LEGACY / SUPERSEDED**, and **DESIGN / IMPLEMENTATION DISCREPANCY** are deliberate states, not omissions.
- Future implementation preserves current production behavior unless a scoped change deliberately changes it. Architecture changes update architecture documentation; gameplay/design changes update this Master File.

Sources reconstructed here are `docs/MasterFile4_3.md`; the controlling `docs/post-invitational-master-file.md` for Genetics, Foundation, Judging, Breed, annual points, and deferred Classes; current focused design notes; and the completed architecture sweep. This is a design specification, not a record of conversations or an implementation checklist.

## How to Read This With Architecture Documentation

For design questions, read this file. For implementation location and ownership, read `docs/ARCHITECTURE/`. Recommended implementation sequence is: (1) the relevant Master File system, (2) `domains.md`, (3) `canonical-rules.md`, (4) `canonical-services.md`, (5) `data-ownership.md` where persistence is involved, (6) `cross-cutting-patterns.md`, and (7) `architecture-debt-register.md` before changing a known debt surface.

## Master Design Principles

**LOCKED DESIGN**

- Build a realistic dog-show simulation ecosystem around breeding programs, campaigning, economics, services, reputation, and community.
- Avoid single-score dominance. Traits are inputs, not final outcomes.
- Category evaluation, breed emphasis, judge preference, and small appropriate variance combine to produce competition outcomes.
- Prefer natural constraints—time, money, handlers, geography, fatigue, capacity, and biological limits—over arbitrary hard caps.
- Competitive success cannot be purchased. Showing is principally a cost/prestige activity.
- Preserve player trust through auditable history and server-authoritative irreversible actions.
- Preserve meaningful uncertainty without making breeding or showing opaque. Hidden simulation truth and player-visible evaluation are separate layers.

## Time and Game Calendar

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED; DESIGN / IMPLEMENTATION DISCREPANCY.**

### Description

ShowRing is a continuously advancing simulated world with a deterministic calendar used for age, biology, schedule, and eligibility. Real timestamps remain audit metadata, not game-time substitutes.

### Psychology

The clock makes timing, planning, recovery, and long-term kennel decisions meaningful without requiring constant player presence.

### Gameplay Role

All time-sensitive systems consume the same game-time meaning: lifecycle, breeding, care, shows, contracts, and recurring progression.

### Locked Design

Simulation time is a game epoch; real-world time records operational/audit events. Game-time rules must be reproducible at a stated epoch.

### Rules

**LOCKED:** time conversion, game-week/year semantics, and annual boundaries belong to Time / Calendar, not to each consuming system. **TBD:** no later design authority conclusively resolves whether the historical time-design wording or all current integer-epoch details are intended as a permanent design contract.

### States

Current game epoch; game week; game year; annual/Invitational boundary.

### Objects

Game calendar, scheduled progression, historical event epoch.

### Dependencies

Lifecycle, Breeding, Shows, Economy, Operations.

### Constants

**LOCKED:** time constants must be shared design rules. **CALIBRATION:** none established here.

### Algorithms

Derive calendar positions and ages from a single current game epoch; record the relevant epoch on historical game events.

### Randomness

None in time conversion. Scheduled work must be idempotent and auditable.

### Economics

NA.

### Abuse Prevention

The server, not browser time, decides time-gated actions.

### Edge Cases

Time-zone and daylight-saving changes must not alter simulation outcomes. Boundary actions use the authoritative game epoch.

### UI Visibility

**Players see:** game-age/time information and clear distinction from real dates where relevant. **Players do not see:** operational scheduler details.

### Future Expansion

None implied by calendar mechanics alone.

### Auditability

Historical action epochs and published schedules must support reconstruction.

### Current Implementation Reference

Rules: `packages/rules/src/time.ts` and `apps/web/lib/gameClock.ts`.

Service: scheduled progression services.

Persistence: integer game-epoch fields plus real audit timestamps.

Architecture: `canonical-rules.md`, `canonical-services.md`, `data-ownership.md`.

### Known Design / Implementation Discrepancies

Design: older design material contains conflicting persisted-timestamp and simulation-epoch language. Current production: integer game epochs are used for simulation and real timestamps for audits. Status: **UNRESOLVED**.

## Dogs: Identity, Lifecycle, and Historical Home

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED; DESIGN / IMPLEMENTATION DISCREPANCY.**

### Description

A dog is a durable individual with registration, pedigree, breeder and ownership history, phenotype, health, reproduction, and show record. Death and Forever Home preserve history; they do not erase the dog.

### Psychology

Players build a kennel story over generations. Consequences and attachment matter because important records survive transfers, retirement, and death.

### Gameplay Role

Age-derived eligibility controls puppy sale, showing, breeding, veterans, mortality risk, and reproductive limits. ALIVE/deceased is a durable truth; pregnancy and recovery alter permissible actions.

### Locked Design

- Dog identity, registration number, pedigree, breeder identity, names, and historical participation are preserved.
- Age is calculated from game time; systems consume lifecycle rules rather than redefining thresholds.
- A dog is either alive or deceased as durable state; Forever Home is a preservation/ownership-history outcome, not deletion.
- Lifecycle eligibility must be legible and server-authoritative.

### Rules

**LOCKED:** show age, breeding age, dam cutoff, mortality, pregnancy, post-whelp rest, and reproductive recovery are distinct gameplay constraints. **TBD:** the authoritative conceptual relationship between durable `lifecycleState` and derived life-stage presentation needs an explicit design clarification.

### States

Alive/deceased; age-derived puppy, junior, adult, veteran, and show/breeding eligibility; pregnancy/recovery; market/Forever Home are separate concepts.

### Objects

Dog, registration, kennel run, pedigree relation, ownership/breeder relation, lifecycle and mortality history.

### Dependencies

Kennels, Genetics, Health, Breeding, Shows, Market, Titles, History.

### Constants

**LOCKED:** life-stage thresholds are shared lifecycle rules. **CALIBRATION:** mortality probabilities and distributional details. **TBD:** any future new lifecycle category.

### Algorithms

Age equals current game epoch minus birth epoch. Eligibility combines age with durable health, ownership, reproductive, and event constraints.

### Randomness

Mortality may be probabilistic, but recorded outcomes are historical facts. Eligibility is deterministic at an epoch.

### Economics

Dogs are the primary economic asset, never disposable records.

### Abuse Prevention

No client assertion of ownership, age, or health can authorize an action; historical dogs remain non-editable where appropriate.

### Edge Cases

Death during pregnancy or an event, ownership transfer, and Forever Home retain correct history; no historical result is removed.

### UI Visibility

**Players see:** identity, age/life status, ownership presentation, known phenotype, and action availability. **Players do not see:** private/internal technical state or hidden genotype.

### Future Expansion

None required to retain historical dogs.

### Auditability

Registration, parentage, identity, ownership/breeder history, and lifecycle-changing events remain reconstructable.

### Current Implementation Reference

Rules: lifecycle/eligibility helpers in `packages/rules`.

Service: `apps/web/server/services/dog.service.ts` and lifecycle consumers.

Persistence: `Dog`, kennel-run and pedigree relationships.

Player presentation: dog and kennel read models.

Architecture: `data-ownership.md`, `canonical-rules.md`.

### Known Design / Implementation Discrepancies

Design: life-stage status was historically described as derived rather than stored. Current production: `Dog.lifecycleState` is persisted while age-derived eligibility is also used. Status: **UNRESOLVED**.

## Breed Reference, Genetics, Phenotype, and Visible Ring Categories

### Status

**LOCKED DESIGN; CALIBRATION; PARTIALLY IMPLEMENTED; FUTURE / OUT OF SCOPE where the Post-Invitational release has not reached production.**

### Description

Breed standards state what judges seek; a breed population and its genetic background describe what dogs currently are. Genetics creates hidden inheritable potential, phenotype is its dog-level expression, and player-visible ring categories provide useful but deliberately incomplete evaluation.

### Psychology

Breeding rewards observation, complementary pairings, producer discovery, patience, and diversity stewardship—not spreadsheet certainty or a single "higher is better" trait.

### Gameplay Role

The locked Post-Invitational architecture is:

`40 hidden loci / 80 inherited allele values → 10 hidden Decimal directional traits centered on 10 → 5 player-evaluable conformation categories + independent Conditioning & Handling → breed emphasis → judge preference → small ring/day variance → placements`.

### Locked Design

- Fixed ideal is `10.000` on directional `0.000–20.000` conformation traits; under and over can complement.
- Hidden genotype does not directly enter judging; judging consumes phenotype.
- Ten transmissible traits and raw genotype stay hidden. Five derived conformation categories may be shown without exposing the inheritance or scoring formula.
- Four diploid loci per trait, Mendelian segregation, independent loci in v1, rare small symmetric allele-level mutation, and versioned compact genotype persistence are locked.
- Breed genetic background is slow-moving, population-based, versioned, auditable, separate from the breed standard, and snapshots annually after the annual/Invitational cycle.
- COI supports diversity, fixation, health/fertility and available variance; it must not apply a generic conformation penalty.
- Color/genotype/phenotype and future fault/DQ concepts remain separate; ordinary weights are not faults or DQs.

### Rules

**LOCKED:** players receive directional categories that aid decisions but are not raw trait truth; category presentation must not collapse into a judge-score display. **CALIBRATION:** allele distributions, mutation rate/effect, background coefficient, population targets, and exact visible formatting. **FUTURE:** Breed Essential and fault/DQ layers are not ordinary current judging rules.

### States

Breed standard; breed population; versioned genetic background; hidden genotype version; persisted phenotype; player-facing derived categories.

### Objects

Breed, breed judging profile, genetic-background snapshot, dog genotype/version, conformation phenotype, COI/pedigree.

### Dependencies

Dogs, Pedigree, Foundation Population, Breeding, Health, Judging, Breed Releases.

### Constants

**LOCKED:** 40 loci/80 alleles, ten traits, fixed ideal 10, four diploid loci per trait, six internal decimal places and normally three player-facing derived decimals. **CALIBRATION:** rare mutation probability/effect and founder/background distribution values.

### Algorithms

Each puppy receives one allele per locus from each parent; recombination/segregation, rare mutation, and genetic background produce phenotype without prematurely rounding. Derived visible categories summarize phenotype directionally. A phenotype is not a unique genotype and an excellent individual is not necessarily an excellent producer.

### Randomness

Segregation, recombination, and mutation belong in inheritance; hidden realization is stored/versioned. Player-visible values are derived, not random cosmetic noise.

### Economics

Genetic and breed data create breeding value but cannot be purchased as competitive advantage.

### Abuse Prevention

No raw genotype or exact scoring formula is exposed. Breed data validation prevents missing/invalid profile weights from silently changing judging.

### Edge Cases

An exact 10 is allowed; all-trait near perfection must be naturally rare, not prohibited. Legacy dogs retain known phenotype exactly when moved to Decimal precision.

### UI Visibility

**Players see:** breed identity/reference, five derived conformation categories, known phenotype presentation, pedigree/COI information as designed. **Players do not see:** ten raw transmissible traits, allele values, hidden genotype, or judge calculation internals.

### Future Expansion

Fault/DQ and Breed Essential systems are separate future work. Current production may not yet carry the complete post-Invitational model.

### Auditability

Genetics version, phenotype precision, background snapshots, judging-profile versions, and result inputs must support later explanation without recalculating history under newer rules.

### Current Implementation Reference

Rules: genetics, phenotype, COI, and judging helpers in `packages/rules`.

Service: breeding puppy generation and foundation services.

Persistence: `Breed`, `Dog`, pedigree relations, genetics/background and judging-profile records where released.

Architecture: `domains.md`, `canonical-rules.md`, `data-ownership.md`.

### Known Design / Implementation Discrepancies

Design: Post-Invitational Decimal polygenic architecture controls its scope. Current production: implementation state must be read from the release branch/current rules; the staged package must not be assumed live merely because the design is locked. Status: **UNRESOLVED RELEASE STATE**.

## Foundation Population and Dogs

### Status

**LOCKED DESIGN; CALIBRATION; CURRENTLY IMPLEMENTED / PARTIALLY IMPLEMENTED.**

### Description

Foundation dogs are a continuing controlled outcross and population-diversity tool, not simply starter stock or an elite shortcut.

### Psychology

They create a meaningful choice between immediate show strength and long-term diversity, distinctiveness, or directional complementarity.

### Gameplay Role

Foundation inventory helps a population recover options under concentration and bottleneck pressure without replacing sustained player breeding.

### Locked Design

Foundation generation preserves useful directional diversity around 10, hidden distinctiveness, relatedness options, and controlled scarcity. It must avoid both elite all-around repair dogs and useless junk. It follows contemporary population quality while lagging elite player stock.

### Rules

**LOCKED:** weak probabilistic shortage bias only; no deterministic breed repair; approximately 15% may offer one conspicuous opportunity and 2% two, with multi-trait repair effectively excluded. **CALIBRATION:** inventory counts, generation distributions, exact prices, and bottleneck weights.

### States

System inventory, released/player-owned descendant, sold/retired historical stock.

### Objects

Foundation dog, breed population/background, inventory listing.

### Dependencies

Breeds, Genetics, Pedigree, Market, Economy, Breeding.

### Constants

**LOCKED:** opportunity rarity targets are generation targets, not player-facing tiers. **CALIBRATION:** counts, price, and distribution values.

### Algorithms

Consider distribution center/spread, scarce directional values, diversity, relatedness, and bottlenecks. Foundation stock affects background only via player-bred descendants, not unsold inventory.

### Randomness

Generation is controlled stochastic population design; individual availability is not a guaranteed answer to a player's problem.

### Economics

Pricing is a future economy-calibration issue; foundation access cannot become purchasable dominance.

### Abuse Prevention

No stock should deterministically solve a breed shortage or become a perpetual elite source.

### Edge Cases

Below a viable live population, retain the prior/versioned genetic baseline rather than letting a tiny cohort redefine a breed.

### UI Visibility

**Players see:** purchasable dogs and useful normal dog information. **Players do not see:** hidden genetic opportunity scoring or bottleneck targeting.

### Future Expansion

Continued population-aware generation and pricing calibration.

### Auditability

Inventory origin, resulting dog identity, and population versioning remain traceable.

### Current Implementation Reference

Service: `apps/web/server/services/foundationDog.service.ts`.

Persistence: foundation-origin `Dog` records and listings.

Background progression: foundation inventory maintenance.

Architecture: `canonical-services.md`, `data-ownership.md`.

## Breeding, Pregnancy, Litters, and Puppy Management

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED; CALIBRATION.**

### Description

Breeding is biological simulation plus long-term kennel strategy. Commercial stud agreements are separate from biological eligibility. Litters preserve parentage and breeder identity even as puppies transfer.

### Psychology

Players weigh pedigree, phenotype direction, genetic diversity, health, timing, risk, and future puppy decisions rather than repeatedly clicking an unconstrained pairing action.

### Gameplay Role

Breeding creates future dogs under biological constraints. Pregnancy, whelping, post-whelp rest, sire recovery, dam cooldown, and emergency outcomes make timing matter.

### Locked Design

- Biological breeding eligibility is distinct from offer/contract eligibility.
- Pregnancy timing, breeding ages, dam cutoff, stud recovery, post-whelp show rest, reproductive recovery, health, mortality, and litter history are meaningful constraints.
- Litter serial identity and breeder attribution are immutable. Custom litter names are presentation metadata and breeder notes are private, non-gameplay information.

### Rules

**LOCKED:** breeding consumes Lifecycle and Health rules; a commercial contract cannot bypass them. **CALIBRATION:** litter distributions and biological probability values. **TBD:** no unambiguous new design rule is established for all cancellation/compensation variants beyond currently implemented contracts.

### States

Eligible/ineligible; breeding attempt; pregnant; whelped; recovery; litter/pup manageable versus historical.

### Objects

Breeding attempt, litter, puppy, parentage, breeder note/name, reproductive history.

### Dependencies

Dogs, Lifecycle, Genetics, Health, Stud Contracts, Kennels, Economy, Market.

### Constants

**LOCKED:** biological timing and recovery constraints belong here by reference from Lifecycle. **CALIBRATION:** probabilities and litter-size behavior.

### Algorithms

Server validation establishes both parents and current biological facts before creating an attempt. Whelping records parentage and creates pups through the canonical inheritance path. Management actions revalidate eligibility.

### Randomness

Inheritance and biological outcomes may vary; stored attempts, outcome, and puppy identities make each outcome historical.

### Economics

Breeding and contracts can create costs/revenue, but biology is not a purchasable override.

### Abuse Prevention

Server ownership/eligibility checks, recovery, health, and contract lifecycle prevent duplicate or bypassed breeding. Litter name cannot alter serial, registration, parentage, or relations.

### Edge Cases

Breeder rights over litter metadata survive puppy transfers, death, and Forever Home. Pregnancy/death/transfer history stays coherent.

### UI Visibility

**Players see:** eligible actions, pregnancy/litter information, public litter name, and their permitted private note. **Players do not see:** another breeder's note or hidden genotype.

### Future Expansion

Advanced contract terms, stored semen, negotiation, and additional selection-right variants remain outside current scope unless explicitly activated.

### Auditability

Attempts, parentage, litter identity, health/reproductive events, and resulting pups must be reconstructable.

### Current Implementation Reference

Rules: breeding eligibility in `packages/rules`.

Service: `apps/web/server/services/breeding.service.ts` and litter-management services.

Persistence: `BreedingAttempt`, `Litter`, `Dog`.

Background progression: breeding-progress resolution.

Architecture: `canonical-services.md`, `data-ownership.md`.

## Health, Veterinary Care, and Reproductive Emergencies

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED; FUTURE / OUT OF SCOPE for unapproved health programs.**

### Description

Health is a meaningful durable record and a biological/gameplay constraint. It includes paid phenotype tests where applicable, distinct brucellosis screening, infectious disease, ordinary/emergency care, and reproductive emergencies.

### Psychology

Players make informed care and breeding decisions while respecting uncertainty and lasting consequences.

### Gameplay Role

Health can gate or shape breeding, grooming efficacy, market/stud/pedigree presentation, care costs, and emergencies; it does not simply auto-reveal every fact at maturity.

### Locked Design

Immutable test outcomes are earned through applicable paid testing; breed applicability and maturity matter. Brucellosis is a distinct screening flow. Emergency/reproductive care is consequential and historical.

### Rules

**LOCKED:** health results are not inferred merely from age. **CALIBRATION:** prices, probabilities, effect magnitude, and test catalogue details. **FUTURE:** CHIC-style programs are not current design unless separately confirmed.

### States

Applicable/not applicable; eligible/not mature; tested outcome; screening/care/emergency treatment/recovery.

### Objects

Health test, screening, disease/care event, veterinary/reproductive emergency history.

### Dependencies

Dogs, Lifecycle, Breeding, Grooming, Market, Stud Services, Economy.

### Constants

**LOCKED:** maturity/applicability are rule categories. **CALIBRATION:** fees and medical probability/effect values.

### Algorithms

Authoritative service verifies dog, maturity, breed/test applicability, payment, and current condition; writes an immutable result/event.

### Randomness

Test/medical outcomes may include controlled simulation uncertainty; once recorded they are durable facts.

### Economics

Testing and care are meaningful money sinks, not paywalls for success.

### Abuse Prevention

No browser-provided outcome; no retroactive rewrite of health history.

### Edge Cases

Care during breeding/pregnancy and emergency recovery change available actions without erasing records.

### UI Visibility

**Players see:** allowed health results and relevant care/action status. **Players do not see:** provider/internal workflow state or private diagnostic detail not designed for disclosure.

### Future Expansion

Additional health program design requires explicit scope.

### Auditability

Outcome, cost, time, dog, and effect history remain attributable.

### Current Implementation Reference

Service: `healthTest.service.ts`, `infectiousDisease.service.ts`, `emergencyVetCare.service.ts`, and `reproductiveEmergencyTreatment.service.ts`.

Persistence: health, disease, care, and reproductive-event models.

Architecture: `canonical-services.md`, `data-ownership.md`.

## Grooming, Conditioning, and Handling

### Status

**GROOMING: CURRENTLY IMPLEMENTED / PARTIALLY IMPLEMENTED. CONDITIONING: CURRENTLY IMPLEMENTED. HANDLING: FUTURE / OUT OF SCOPE beyond current logistics.**

### Description

Conditioning and Handling is an independent, optimized sixth judging category. Current grooming is a weekly maintenance/service loop that improves persistent coat condition and indirectly affects its snapshot. The intended grooming profession is broader but not yet locked in all details.

### Psychology

Preparation should reward timing and care without becoming a mandatory daily chore. A future grooming career should permit social specialization rather than genetic dominance.

### Gameplay Role

Current grooming improves readiness, not inherited coat. Conditioning/handling remains separate from directional conformation. Current handler mechanics are logistics/cost, not a performance-buying mechanism.

### Locked Design

- Grooming must never become genetics or erase directional breeding information.
- Conditioning & Handling remains independent from the five directional conformation categories.
- Presentation preparation must remain legible and historically auditable.
- Competitive performance cannot be purchased through handler/groomer tiers.

### Rules

**CURRENT IMPLEMENTATION:** grooming has eligibility, weekly capacity, self/outside actions, coat-condition gains/decay, health interaction, records and notices; the show-entry snapshot is not revised by later grooming. **TBD:** profession progression, specialization, reputation, pricing, direct Coat & Presentation effects, and the exact long-term handling system. **FUTURE:** named handler schedules, tiers, availability, and professions.

### States

Grooming eligible/listed/completed; coat condition; conditioning snapshot; handler/logistics requirement.

### Objects

Dog condition, grooming service action, grooming listing, condition event, grooming XP/level.

### Dependencies

Dogs, Health, Shows, Economy, Community Services.

### Constants

**CURRENT IMPLEMENTATION:** weekly grooming cadence/capacity and current gains are implementation tuning. **CALIBRATION/TBD:** future effects, specialization and prices.

### Algorithms

Current condition snapshot combines coat condition, muscle tone, and ring obedience, then applies fatigue/clamping for the entry. A future grooming algorithm is not locked.

### Randomness

Current maintenance effects are deterministic except health modifiers. Future service-quality variance is TBD and must be explainable if added.

### Economics

Current outside work has a fixed game-funded payment; whether it becomes client-funded service economy is TBD.

### Abuse Prevention

Weekly capacity and server eligibility prevent rote unlimited gains. Later specialism cannot become runaway rich-get-richer advantage.

### Edge Cases

Listed dogs cannot be self-groomed; decay only addresses prior grooming gain; health can reduce efficacy and cap coat condition.

### UI Visibility

**Players see:** coat condition, service availability/status and known preparation state. **Players do not see:** private provider/implementation calculations.

### Future Expansion

Outcome-driven skill, reputation, coat/breed relevance, client satisfaction, and presentation professions require explicit design decisions.

### Auditability

Actions, condition events, listing lifecycle, money and entry snapshots are retained.

### Current Implementation Reference

Rules: conditioning/presentation helpers in `packages/rules`.

Service: `apps/web/server/services/grooming.service.ts`.

Persistence: dog condition, grooming action/listing/event records.

Architecture: `canonical-services.md`, `data-ownership.md`.

## Show Calendar, Entry, Geography, and Campaign Planning

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED; PARTIALLY IMPLEMENTED for expanded weekend/handler planning.**

### Description

Shows are a deterministic recurring calendar of clusters and days, not the older proposed Template/Instance model. Campaigning is planning under entry closing, money, travel, dog eligibility, capacity, and one-event constraints.

### Psychology

Players choose campaigns deliberately: where, when, and which dog to expose to cost and opportunity, while accepting that entries are not a guaranteed result.

### Gameplay Role

Show clusters/days establish event context; entry validates eligibility and captures a point-in-time competition/presentation context; schedule and travel create natural scale limits.

### Locked Design

- Calendar is deterministic and schedule history is preserved.
- Entries close; pre-judging entries are hidden; published results are permanent.
- Travel, handler logistics, fees, capacity, fatigue, age, health, and biology should be natural constraints.
- A dog may be entered only once per weekend across shows in that weekend where the planned weekend model is activated.

### Rules

**CURRENT IMPLEMENTATION:** cluster/day architecture, entry validation and financial effects are active. **PARTIALLY IMPLEMENTED:** primary/secondary multi-show weekend planning and its exact handler model are a staged plan, not an assumed universal live rule. **FUTURE:** named handler schedules and professional capacity.

### States

Generated/scheduled, open/closed entry, judged/published; cluster attendance/entry disposition.

### Objects

ShowCluster, ShowDay, ShowEntry, district/geography context, entry quote/attendance.

### Dependencies

Time, Dogs, Lifecycle, Conditioning, Economy, Judging, Titles.

### Constants

**LOCKED:** entry close and schedule boundaries are calendar rules. **CALIBRATION:** fee/travel/handler values and schedule distribution. **TBD:** exact future weekend UX/fee evolution.

### Algorithms

Generate deterministic clusters/days; validate dog/kennel/event eligibility; calculate quote; commit authoritative entry context. A planned weekend key groups same-year/week clusters but is not a license to assert unimplemented behavior.

### Randomness

Scheduling is deterministic; judging variance belongs to Judging, not entry.

### Economics

Entry, travel, and handler costs make campaigning a cost/prestige activity.

### Abuse Prevention

Server-side closing, ownership, balance, eligibility, duplicate/conflict checks, and hidden-entry policy protect competition integrity.

### Edge Cases

Dogs changing age/health/lifecycle during a cluster remain governed by the documented entry/judging timing variant; no later presentation action silently revises captured entry data.

### UI Visibility

**Players see:** available shows, quotes, allowed actions, their own entries, and published results. **Players do not see:** other entries before judging or internal validation/scoring details.

### Future Expansion

Expanded weekend planning and named handlers are future/staged work.

### Auditability

Cluster identity, dates, entries, quote/economic events, and publication status are historical.

### Current Implementation Reference

Rules: show eligibility in `packages/rules/eligibility/showEligibility.ts`.

Service: `showSchedule.service.ts` and `showEntry.service.ts`.

Persistence: `ShowCluster`, `ShowDay`, `ShowEntry`.

Background progression: show-schedule maintenance.

Architecture: `canonical-rules.md`, `canonical-services.md`, `data-ownership.md`.

## Judging, Results, and Historical Transparency

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED / PARTIALLY IMPLEMENTED across the Post-Invitational release boundary.**

### Description

Judging converts prepared, eligible competition entries into permanent results through conformation categories, Conditioning & Handling, breed emphasis, individual judge preference, and small ring/day variance.

### Psychology

Players study dogs, breeders, events, and judges without being able to reduce the ring to a single deterministic spreadsheet ranking.

### Gameplay Role

Judging determines placements and feeds awards/titles while preserving enough evidence to explain the result after the event.

### Locked Design

- No single score dominates.
- Breed baseline emphasis combines with judge preference and is normalized within a fixed conformation budget; Conditioning & Handling remains separate.
- Small ring/day variance is appropriate; it must not erase informed strategy.
- Hidden genotype, hidden raw traits, exact preference internals, and unjudged competitor entries stay private.
- Published results are permanent and never silently rerated under later rules.

### Rules

**LOCKED:** fixed ideal/breed standard and breed population remain distinct; judging does not inspect loci. **CALIBRATION:** preference strength and variance magnitude. **FUTURE:** Breed Essential, faults, and DQs. **CURRENT IMPLEMENTATION:** results/awards are finalized by the judging path; class routing changes must wait for its deferred release.

### States

Entered/hidden, eligible/dispositioned, judged, published historical result/award.

### Objects

Judge, breed judging profile, show entry/result/award, audit version/context.

### Dependencies

Genetics/Phenotype, Breeds, Conditioning, Shows, Championship Points, Titles.

### Constants

**LOCKED:** six-category layer structure. **CALIBRATION:** weighting/preference/variance parameters. **FUTURE:** Essential/DQ semantics.

### Algorithms

Evaluate categories, apply breed emphasis and individual judge preference, retain Conditioning & Handling independently, apply appropriate small variance, rank placements, then persist audit context and awards.

### Randomness

Ring/day variance is controlled, bounded design randomness. Published outcome plus applicable inputs/version information must remain auditable.

### Economics

Judging has prestige consequences, not a purchasable performance modifier.

### Abuse Prevention

Server-authoritative finalization; hidden entries; no client score submission; permanent publication.

### Edge Cases

Tie and unusual eligibility outcomes need deterministic documented resolution in the rule layer. No results are recalculated after breed/group/rule changes.

### UI Visibility

**Players see:** published placements, appropriate result/history explanations, visible categories. **Players do not see:** raw genotype, exact judge formulas/preferences, and hidden entries before judging.

### Future Expansion

Future Essential/fault/DQ system and deferred class routing are separate scopes.

### Auditability

Persist enough input, version, result, award, and time context to explain an outcome without changing it.

### Current Implementation Reference

Rules: judging helpers in `packages/rules`.

Service: `apps/web/server/services/judging.service.ts`.

Persistence: `ShowResult`, `ShowAward`, judging/audit records.

Architecture: `canonical-rules.md`, `canonical-services.md`, `data-ownership.md`.

## Show Classes, Championship Points, Titles, and Invitational

### Status

**POINTS/TITLES: LOCKED DESIGN; CURRENTLY IMPLEMENTED on the Post-Invitational release scope. CLASSES: LOCKED DESIGN; FUTURE / DEFERRED. INVITATIONAL: LOCKED DESIGN where current annual boundary behavior is specified.**

### Description

Championship recognizes sustained competitive success through permanent awards and historically appropriate rules. The later annual schedule supersedes the old universal point table. Class taxonomy is locked but is not current production merely because it is fully specified.

### Psychology

Titles reward campaigning and meaningful competition context rather than purchases, bulk entry inflation, or recalculated historical luck.

### Gameplay Role

Annual schedules translate actual regular-class competition into 1–5 point awards, majors, CH and GCH credits. The Invitational is an annual publication/data boundary with its own preserved history.

### Locked Design

- Year 16 and earlier is legacy scoring; Year 17+ uses a published Annual Championship Point Schedule keyed by effective year, district, breed, and sex.
- Schedules are built from prior-year immutable WD/WB competition observations and must be complete/published before authoritative Year N+1 judging.
- Awards are inclusive maxima, never stacked; 3–5 points are majors.
- CH is 15 points and two majors. Initial GCH has CH plus 25 GCH points and the locked major/judge/show/champion-defeated requirements; higher GCH tiers are cumulative milestones.
- Published awards, credits, results and history remain permanent.
- Deferred regular classes: 6–9, 9–12, 12–18, Bred-by-Exhibitor, and Open, divided by sex; non-champions use one eligible regular class, champions bypass it to BOB, veteran does not override maximum show age.

### Rules

**LOCKED:** annual schedule lifecycle/fallback order, BOW/BOB/BOS semantics, Invitationals suppressing ordinary CH points while retaining GCH and triggering next publication, and current deferred class taxonomy. **CALIBRATION:** statistical targets/threshold outcomes based on observed population. **FUTURE:** classes, specialty/non-regular routing, and any unapproved title ladder changes.

### States

Schedule draft/published; legacy/dynamic year; award/major/title credit; class eligibility/routing (future).

### Objects

Annual point publication/schedule, ShowAward, title progress, GCH credit, Invitational results.

### Dependencies

Shows, Judging, Breeds, Lifecycle, Historical Preservation.

### Constants

**LOCKED:** 1–5 awards, 3–5 major definition, CH 15/two majors, initial GCH milestones. **CALIBRATION:** annual observed thresholds/rates. **FUTURE:** class UX and specialty values.

### Algorithms

Build a complete exact schedule set after Invitational from immutable observations with no unrelated-breed/opposite-sex/latest fallback. At judging, resolve the exact published sex schedule, take the inclusive best qualified award, and persist it; never rerate older days from a new schedule.

### Randomness

No randomness in schedule publication or title calculation; population observations are historical judging facts.

### Economics

Titles create recognition/prestige, not paid competitive power.

### Abuse Prevention

Fail closed on absent unpublished/invalid schedule data; no entry inflation shortcut; no retrospective award rewriting.

### Edge Cases

Completed Invitational is isolated from an annual-build failure. A draft may retry, while completed Invitational history remains intact.

### UI Visibility

**Players see:** published current/historical point schedules, awards, titles and results. **Players do not see:** unpublished drafts or implementation internals.

### Future Expansion

Class workstream, specialty/non-regular behavior, and any further title tiers require scoped release work.

### Auditability

Preserve schedule publication/provenance, competition context, awards, GCH credits, judge identity where applicable, and finalized times.

### Current Implementation Reference

Rules: title/points helpers in `packages/rules`.

Service: `judging.service.ts` and title/point services.

Persistence: `ShowAward`, title-progress and GCH-credit records, annual schedule/publication records.

Architecture: `canonical-rules.md`, `data-ownership.md`.

## Kennel Identity, Runs, Economy, Market, Rehoming, and Stud Contracts

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED; DESIGN / IMPLEMENTATION DISCREPANCY for cross-cutting ledger authority.**

### Description

The kennel is the player's durable program and operational home. The dog economy is the primary gameplay economy: dogs, breeding, sales, services, care, showing and management generate meaningful choices while prestige remains earned.

### Psychology

Players balance current cash, capacity, reputation, dogs, service opportunities, and long-term program quality. Natural limits should make scale a decision, not an arbitrary punishment.

### Gameplay Role

Kennel runs organize dogs; market/foundation/rehome flows change ownership/history; contracts enable controlled stud transactions; balance/ledger history records the economic consequences.

### Locked Design

- Competitive advantage cannot be purchased; money buys operations and choices, not judging, genetics, placement, ranking, or eligibility advantage.
- Economy uses natural constraints: money, capacity, care, travel, biological timing, and real dog supply.
- Player market and foundation inventory are intentionally different market variants.
- Biological breeding is separate from commercial stud contracts.
- Legacy `PLAYER_STUD` listing linkage is historical compatibility only, not a new dependency.

### Rules

**CURRENT IMPLEMENTATION:** market, foundation sales, adult/puppy sales, rehoming, stud offer/contract lifecycle, balances and ledger records exist. **TBD:** global economic tuning, mature rehome floor/price policy, and further service-economy design. **LEGACY:** capacity/paywall subscription economics and `PLAYER_STUD` as a live model are not current design.

### States

Kennel/run; market listing/ownership transfer/Forever Home; foundation inventory; offer/contract and selection-right lifecycle; ledger history.

### Objects

Kennel, KennelRun, balance/ledger transaction, dog/listing, StudOffer, stud contract, selection/return-service history.

### Dependencies

Dogs, Lifecycle, Breeding, Health, Shows, Grooming, Support, Community.

### Constants

**CALIBRATION:** prices, fees, upkeep, rewards and capacity values. **LOCKED:** their role as natural constraints and not competitive-purchase levers.

### Algorithms

Authoritative mutations validate eligibility/ownership/balance, apply ownership/state changes and economic records together where the domain requires it. Contract status/action is derived presentation from its component lifecycle.

### Randomness

No randomness belongs in balance posting or ownership transfer. Market demand/price policy beyond current rules is TBD.

### Economics

This is the economy-owning design section. Dog sales and stud fees are primary income; showing, travel, handlers, care, testing, breeding, and management are meaningful costs.

### Abuse Prevention

No client price/payment/ownership assertion; no duplicate transfer; no contract bypass; no cash-for-placements path.

### Edge Cases

Cancelled historical player-stud listings, links, contracts, breeding attempts and ledger data remain intact. Ownership changes preserve breeder/pedigree/show history.

### UI Visibility

**Players see:** their balances, available market/contracts, applicable prices/status, and intended public dog/kennel information. **Players do not see:** private financial/provider/internal transaction fields.

### Future Expansion

Advanced stud terms, client-funded grooming market and additional service careers require design scope.

### Auditability

Ownership, listing, contract, balance and ledger history must explain how a dog and money changed hands.

### Current Implementation Reference

Service: `market.service.ts`, `foundationDog.service.ts`, `rehome.service.ts`, `studContract.service.ts`, and distributed balance writers.

Persistence: kennel balance/ledger, dog/listing, market, contract, and ownership-history models.

Architecture: `canonical-services.md`, `data-ownership.md`, `architecture-debt-register.md`.

### Known Design / Implementation Discrepancies

Design: ledger/history is a locked player-trust principle. Current production: there is no universal economy/ledger mutation authority; balance writes are distributed across services. Status: **UNRESOLVED**.

## Community, Messaging, Notices, Moderation, and Recognition

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED / PARTIALLY IMPLEMENTED.**

### Description

Community enables player interaction around the simulation. Messaging and player-written content are distinct from system notices. Blocking, reporting, moderation and read state protect a durable social space.

### Psychology

The community should make kennels, specialty knowledge, services, and accomplishments socially meaningful without making private account/moderation mechanics public gameplay.

### Gameplay Role

Community supports identity, communication, services and recognition; it does not become a mechanical substitute for breeding or judging.

### Locked Design

Player-written content history is preserved appropriately. System-generated notices are not player messages. Blocking/reporting/moderation are design-level safety boundaries, and unread/read semantics are purpose-specific.

### Rules

**LOCKED:** private account/moderation information remains private; actions are authorized server-side. **TBD:** broader clubs, district assistance, and player service-role governance. **FUTURE:** additional community institutions require explicit design.

### States

Post/message/notice; read/unread; blocked; reported; moderation outcome.

### Objects

Community content, conversation/message, notice, block, report, moderation record, recognition/prestige.

### Dependencies

Accounts, Kennels, Services, Support, Art Funding, History.

### Constants

**TBD:** community-specific policy thresholds beyond established moderation behavior.

### Algorithms

Authorization and visibility are evaluated by actor/relationship; message unread and notice unread remain intentionally different semantics.

### Randomness

NA.

### Economics

Community may expose legitimate service roles but must not sell competitive success.

### Abuse Prevention

Blocking, reporting, moderation, access checks, and separate notice/message paths prevent unwanted contact and authority leaks.

### Edge Cases

Historical player content is preserved according to moderation/privacy policy; system notice visibility does not imply conversation access.

### UI Visibility

**Players see:** authorized public/community content, their conversations/notices, and intended recognition. **Players do not see:** other players' private conversations, account state, reports, or moderation internals.

### Future Expansion

District/club/cooperative service designs are not implicitly active.

### Auditability

Content, notices, read-state, reports, and moderation actions must be attributable at appropriate privacy levels.

### Current Implementation Reference

Service: community, messaging, notice, and moderation services.

Persistence: community/message/notice/block/report/moderation models.

Architecture: `canonical-services.md`, `data-ownership.md`, `cross-cutting-patterns.md`.

## Supporter Recognition and Breed Art Funding

### Status

**SUPPORT: LOCKED DESIGN; CURRENTLY IMPLEMENTED. BREED ART FUNDING: PARTIALLY IMPLEMENTED / FUTURE by staged plan.**

### Description

Support is voluntary recognition, separate from gameplay economy. Breed art funding is a distinct contribution/artwork program that may reuse payment infrastructure but never its gameplay authority.

### Psychology

Players can support the project or public breed-art collection without pressure, pay-to-win perception, or loss of competitive dignity.

### Gameplay Role

Supporter and contribution recognition are cosmetic/community acknowledgement only.

### Locked Design

- Voluntary monthly support uses Bronze, Silver and Gold recognition; public badge is optional and may be hidden.
- Support has no effect on judging, economy advantage, ranking, eligibility, genetics, titles, or kennel scale.
- Provider/payment state is separate from gameplay.
- Breed-art contributions support artwork/artist workflow and recognition, not gameplay advantage.

### Rules

**CURRENT IMPLEMENTATION:** canonical individual support-subscription selection and badge presentation exist. **FUTURE/PARTIAL:** art campaigns, finite contribution units, artist workflow and one-time-payments are staged; a contribution must be server-derived, idempotent, and never oversubscribe a campaign. **LEGACY:** Basic/Standard/Premium capacity/paywall tiers are superseded.

### States

Support subscription/history/badge visibility; art campaign needs funding/funded-awaiting-artwork/drawing-complete; contribution and recognition state.

### Objects

Support subscription/provider event, supporter badge, art campaign/contribution/artwork.

### Dependencies

Accounts, Kennels, Payments, Community, Breed Catalog.

### Constants

**CALIBRATION/FUTURE:** art unit/goal/artist allocation values may change only under an explicit art-program decision. **LOCKED:** no gameplay effect.

### Algorithms

Determine an individual's current support subscription canonically; presentation may aggregate it. For art funding, the server derives allowed contribution amount from units remaining and records each successful payment once.

### Randomness

NA.

### Economics

Payment/provider history is not gameplay Economy. Contributions are not a route to game wealth or advantage.

### Abuse Prevention

Optional badge; hidden provider state; server-side amount/availability verification; webhook idempotency; no duplicate final unit.

### Edge Cases

An opt-out badge still preserves supporter history. Funded campaigns close; recognition can aggregate repeated public contributors without exposing amounts.

### UI Visibility

**Players see:** opted-in badge/support recognition and public art campaign/recognition as designed. **Players do not see:** provider payment details, hidden badge preference, or other private subscription state.

### Future Expansion

Artist assignments, gallery and completed-work flow are staged art-funding work, not present gameplay features.

### Auditability

Keep support/provider history and art contribution/workflow records distinct, idempotent and historically attributable.

### Current Implementation Reference

Service: `supportSubscription.service.ts`, supporter badge services, payment integration.

Persistence: support subscription/provider records; art-funding models only as stages are activated.

Architecture: `canonical-services.md`, `data-ownership.md`.

## Administration, Operations, Localization, Accessibility, and Release Boundaries

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED where operationally necessary; FUTURE / OUT OF SCOPE for unscoped release work.**

### Description

Operations preserve a fair world through scheduled progression, controlled releases, moderation, data integrity and audits. Localization/accessibility is a design standard that never changes simulation semantics.

### Psychology

Reliable operations and understandable, accessible UI let players trust a long-lived simulation.

### Gameplay Role

Administration supports the game rather than becoming an ordinary player power system. Releases must protect historic truth.

### Locked Design

- English is currently supported. New UI remains localization-ready through clear English, stable internal values, presentation-layer labels, and locale-aware dates/times/numbers/money.
- Use semantic controls, keyboard navigation, visible focus, connected labels/errors, adequate contrast, and non-color-only status communication.
- Player-written content is not automatically translated. Localization/accessibility never changes rules.
- Post-Invitational coordinated Genetics/Foundation/Judging/Breed work releases at a safe post-Invitational/pre-Week-1 boundary after required migration/data verification; deferred Classes do not ride that release.

### Rules

**LOCKED:** scheduled irreversible work is authoritative/idempotent; releases and migrations preserve historical results. **FUTURE:** unscoped admin/operations features. **CALIBRATION:** Alpha/Beta genetics validation targets inform tuning, not a rewrite of core architecture.

### States

Operational job state; release readiness; active/inactive/released breed visibility; audit/moderation state.

### Objects

Scheduled jobs, administrative records, release/version metadata, localization-ready presentation.

### Dependencies

Every domain, especially Time, Shows, Breeds, Judging, History and Accounts.

### Constants

**LOCKED:** release boundaries and data-preservation rules where specified. **CALIBRATION:** Alpha/Beta population validation targets.

### Algorithms

Run due progression idempotently; deploy coordinated changes only at a safe boundary after migrations/data checks; never rebuild completed results as a shortcut.

### Randomness

Operational jobs do not introduce unrecorded random outcomes.

### Economics

NA, except operations must preserve economic history.

### Abuse Prevention

Access-controlled admin actions, operational audit trails, idempotency, and release gates protect player trust.

### Edge Cases

Known accepted Alpha Group-transition inconsistencies in already generated future shows do not justify rewriting completed history.

### UI Visibility

**Players see:** accessible localized-ready presentation and intended public release/game information. **Players do not see:** private admin, provider, security, and operational details.

### Future Expansion

Translation framework, expanded admin tools, and future release packages need explicit scope.

### Auditability

Jobs, release versions, publication/migration context and admin mutations require traceability.

### Current Implementation Reference

Background progression: application cron/jobs and service resolvers.

Architecture: `system-map.md`, `cross-cutting-patterns.md`, `architecture-debt-register.md`.

## Historical Preservation Rules

### Status

**LOCKED DESIGN; CURRENTLY IMPLEMENTED IN DISTRIBUTED DOMAINS.**

### Description

ShowRing is a historical simulation. A later rule, release, ownership change, or presentation improvement must not silently rewrite what happened.

### Locked Design

Preserve unless an explicitly scoped migration states otherwise: dog identity/registration/pedigree; breeder and ownership history; kennel runs; names; known phenotype and genotype/version data; breeding/litter/health/reproductive history; show schedule/entries/published results/awards; title and championship history; ledger/economy history; market/ownership; stud contracts; supporter history; and player-written content.

### Rules

**LOCKED:** published results are not recalculated under later rules. **LOCKED:** legacy migrations preserve known phenotype numeric value and historical awards/credits. **TBD:** any exceptional correction process must be explicitly designed before it changes historical records.

### Current Implementation Reference

Persistence: distributed historical models documented in `data-ownership.md`.

Architecture: `data-ownership.md`, `cross-cutting-patterns.md`.

# Unresolved Design Decisions

| ID | System | Question | Current production behavior | Existing design evidence | Status |
| --- | --- | --- | --- | --- | --- |
| DESIGN-TBD-001 | Lifecycle | Is persisted `Dog.lifecycleState` the intended durable conceptual state alongside age-derived eligibility, or should its design role be narrowed? | Production persists it and also derives age-based eligibility. | MasterFile4_3 and the architecture audit conflict on derived versus stored lifecycle meaning. | Design decision required |
| DESIGN-TBD-002 | Grooming | What long-term professional system, quality inputs, pricing, specialism, and direct show effects should replace or extend the current maintenance loop? | Uniform maintenance/service loop with indirect Conditioning & Handling effect. | `GROOMING_DEVELOPMENT_OUTLINE.md` deliberately identifies the gap and questions. | Design decision required |
| DESIGN-TBD-003 | Handling | What player-facing handling profession, availability, capacity, and performance role—if any—should be introduced? | Current handler behavior is logistics/cost; named handlers are not established. | Older handler design and weekend plan reserve future named schedules/professions. | Design decision required |
| DESIGN-TBD-004 | Economy | What mature price policy governs adult rehoming, service pricing, and economy calibration while retaining the no-purchase-of-success principle? | Domain-specific current prices/flows exist. | Economy philosophy is locked; exact values and several future service models are not. | Design decision required |
| DESIGN-TBD-005 | Time | Which exact time-model wording should become the permanent design contract after resolving historic timestamp/epoch language? | Integer epoch simulation with real audit timestamps. | Architecture audit documents the historical design conflict. | Design decision required |

# Superseded / Historical Design Concepts

| Concept | Older design | Current design | Superseded by | Notes |
| --- | --- | --- | --- | --- |
| Simulation time storage | Real `timestamptz` language treated as simulation authority in parts of older material. | Integer game epochs for simulation; real timestamps are audits. | Current implementation evidence and architecture audit; final design wording remains TBD. | Retained as discrepancy, not a revived requirement. |
| Lifecycle-only derivation | Older language implied lifecycle was never directly stored. | Durable ALIVE/deceased and persisted lifecycle state coexist with derived eligibility. | Current production; design clarification still needed. | See DESIGN-TBD-001. |
| Simple parent-average genetics | Simple/visible trait approximation. | Locked hidden polygenic 40-locus/80-allele architecture, Decimal phenotype, segregation/recombination/mutation/background. | Post-Invitational Master File. | Do not use older model for new genetics work. |
| Universal static point table | Generic static tables and fixed bonus ideas. | Annual published schedule driven by prior-year observed competition; inclusive upgrades. | Post-Invitational §27A. | Year 16 and earlier retain legacy history. |
| Subscription tiers affecting scale | Basic/Standard/Premium capacity/paywall philosophy. | Voluntary Bronze/Silver/Gold recognition with no gameplay effect. | Current Support design. | Historical concept is not current monetization. |
| Training-session system | Older training/presentation proposal. | No independently established Training domain; Conditioning exists and Handling is future. | Architecture sweep/current production. | Do not represent it as live. |
| ShowTemplate/ShowInstance proposal | Earlier show infrastructure proposal. | Current `ShowCluster` / `ShowDay` architecture. | Current production and architecture sweep. | Older names are not new authority. |
| Live `PLAYER_STUD` listing model | Player stud listings as active authority. | Stud offers/contracts; historical `PLAYER_STUD` linkage retained only for compatibility. | Current stud-contract design/production. | Do not add dependencies on legacy linkage. |

# Known Design / Implementation Discrepancies

| ID | System | Locked/current design | Production behavior | Impact | Resolution |
| --- | --- | --- | --- | --- | --- |
| DESIGN-IMPL-001 | Lifecycle | Life-stage eligibility is age-derived; durable conceptual state must be clear. | `Dog.lifecycleState` is persisted as well as age-derived status being consumed. | A future change could misstate source of truth or corrupt historical semantics. | UNRESOLVED |
| DESIGN-IMPL-002 | Time | Simulation time needs one unambiguous design description. | Integer game epochs drive simulation; real timestamps remain audits. | Older design language is contradictory. | UNRESOLVED |
| DESIGN-IMPL-003 | Economy/Ledger | Ledger/history is required for trust. | Balance/ledger mutation authority is distributed; no universal economy service exists. | Implementation drift surface; not itself a new gameplay rule. | UNRESOLVED |
| DESIGN-IMPL-004 | Post-Invitational package | Locked genetics/foundation/judging/breed design is release-scoped. | Production/release state must be verified at implementation time. | A developer could mistake locked future package design for live main behavior. | PLANNED FUTURE CHANGE |
