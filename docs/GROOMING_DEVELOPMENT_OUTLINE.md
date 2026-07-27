# Grooming & Presentation: Development Outline

**Purpose:** provide a complete, accurate starting brief for designing the next version of grooming in ShowRing Game. It separates the authoritative master design from the playable implementation and identifies the decisions that remain open.

**Source basis (reviewed July 27, 2026):** `docs/MasterFile4_3.md`, `docs/ECONOMY_IDEAS.md`, the grooming service and UI, the Prisma schema, the conditioning/judging/presentation rules, and grooming regression tests.

---

## 1. Executive summary

The game currently has a working **grooming-maintenance and player-service loop**. A kennel may groom its own eligible dog or accept another kennel's listing. Each successful action raises the dog's persistent `coatCondition`, consumes weekly capacity, and creates an auditable record. Outside work pays the groomer, and all activity creates simple grooming XP and a level.

The original vision is broader and more simulation-oriented: grooming should be a meaningful **presentation profession** alongside handling and conditioning, especially relevant to coated breeds. Progress should emerge from quality outcomes, difficult/breed-specific work, and client satisfaction--not merely a counter of actions. Grooming should help create specialist identities and social dependence between players.

The key design gap is that today's system is a uniform numerical maintenance mechanic. The vision calls for a differentiated, outcome-driven presentation system connected to breed, coat, show readiness, reputation, and player-to-player economics.

---

## 2. What the master design says

### Explicit master-file commitments

`MasterFile4_3.md` does not yet contain a standalone Grooming System section. Its relevant commitments are instead:

- **Coat is a hidden structural/genetic trait.** It is one of the stored hidden traits that participates in visible ring categories.
- **Coat & Presentation is a universal judging category.** Judges evaluate it alongside Type & Expression, Structure & Balance, Movement, Temperament & Ring Behavior, and Conditioning & Handling.
- **Conditioning & Handling is separate from the directional structural categories.** It is an optimized 0-10 score, with higher being better; it is not a genetic directional score.
- **Coat condition is a visible mutable conditioning stat.** The Dog Page is meant to display ring obedience, muscle tone, and coat condition as player-facing condition information.
- **Conditioning is a core strategic pillar.** The central loop says players raise dogs, maintain conditioning, campaign them, and reap titles/reputation/market value. The master file leaves "advanced/deeper conditioning systems" as future expansion.
- **Presentation is affected by life state and handling variation.** The judging design already allows conditioning, age, late pregnancy, post-whelp recovery, and handling variability to influence show presentation.
- **Community systems should include paid service roles.** The master file names handler gigs and future player service listings as part of community/district development, but does not specifically define grooming listings.

### What the accompanying design/economy notes add

`ECONOMY_IDEAS.md` gives the clearest original grooming vision:

- Grooming/presentation services include coat trimming and presentation prep; related services may include ring-handling lessons, stacking training, and gait training.
- Grooming matters most when coat and condition matter, while still making the world feel alive if mechanically simplified.
- Grooming is a possible revenue-producing player service and a legitimate career path: a player can become a **grooming specialist** rather than only succeeding through breeding elite dogs.
- Grooming should create social dependence: a strong breeder who is weak at conditioning/presentation can hire a specialist; another player can build a respected career through services.
- Grooming skill represents coat prep, presentation, trimming/scissoring, and maintenance quality. Its intended result is improved Coat & Presentation, particularly for coated breeds.
- The notes explicitly reject flat grind progression such as "groomed 100 dogs = +5 Grooming." Growth should emerge from successful work over time: preparing coated breeds, producing stronger presentation outcomes, and building client satisfaction.
- The preferred long-term model is **skill + reputation + specialization**, with soft/diminishing returns rather than an endlessly compounding XP ladder. Specialization should make someone excellent with one kind of dog/breed while remaining merely adequate elsewhere.

### Original vision in one sentence

Grooming should make presentation a strategically meaningful, socially tradable craft where breed-appropriate skill and reputation produce better show-ready outcomes--not a generic upkeep button.

---

## 3. What the game currently does

### A. Dog eligibility and action limits

- A dog must be alive, player-visible, not awaiting emergency care, and at least **12 game weeks old** (`84` game hours) to be groomed or listed.
- A dog can receive **at most one grooming action per game week**.
- Each kennel can perform **10 total grooming actions per game week**, shared between its own dogs and outside jobs.
- A game grooming week is **7 game hours**. This is the weekly reset window used by the current service.

### B. Self-grooming

From an owned dog's page, a player may groom an eligible dog themselves.

- It consumes one of the kennel's ten weekly actions.
- It costs the owner no money.
- It increases the dog's persistent `coatCondition` by a base `0.20`, capped at `20`.
- It records a `GroomingServiceAction` (`SELF_GROOM`) plus a `DogConditionEvent` (`GROOMING_GAIN`) for a full audit trail.
- It gives the acting kennel `+1` grooming XP, increments its action totals, and recalculates a simple level every 10 XP.

### C. Outside grooming jobs

An owner may offer an eligible, ungroomed dog for outside grooming.

- The listing is public to other kennels and can be cancelled by its owner while open.
- The listed dog cannot be self-groomed until the listing is cancelled.
- Another kennel cannot accept its own listing, must have remaining weekly capacity, and must satisfy the same dog eligibility rules.
- A successful acceptance marks the listing completed, applies the same coat-condition gain, consumes the groomer's capacity, gives the groomer the same XP, and creates a notification for the owner.
- The groomer receives a fixed **$500**, funded by the game. At this stage, the owner is explicitly not charged.
- The board displays up to 30 open jobs with dog/breed/owner identity, current coat condition, grooming history totals, and the fixed fee.

### D. Coat condition, decay, and health

- `coatCondition` is a persistent float from `0` to `20`, initially `0` for new dogs.
- Grooming gains are not permanent. If an eligible dog misses a completed grooming week, the maintenance job removes up to `0.05` from the **net amount previously gained through grooming**. It cannot decay below the accumulated grooming gain, and does not remove other sources of coat condition.
- The scheduled decay process is idempotent and catches up missed completed weeks. It writes zero-value audit events where nothing can decay, so a week is not repeatedly reconsidered.
- Thyroid health changes grooming efficacy:
  - green/no known adverse thyroid result: normal gain (`0.20`), normal decay, maximum coat `20`;
  - yellow: 60% gain, 1.25x decay, maximum coat `15`;
  - red: 15% gain, 1.75x decay, maximum coat `9`.
- The service uses server-side phenotype health truth where available; public thyroid test results are the fallback.

### E. Current show and presentation connection

- Coat condition is one-third of the `Conditioning & Handling` snapshot: `(coat condition + muscle tone + ring obedience) / 3`, then reduced by fatigue and clamped to `0-10`.
- That snapshot is captured when a dog enters a show, so later grooming does not revise an existing entry's condition score.
- Therefore, grooming can currently improve show performance **indirectly** by improving Conditioning & Handling before entry.
- The rules package also has a general-purpose `GROOMING` presentation modifier hook that could affect any judging category, including Coat & Presentation. No production grooming code currently supplies that hook, so this direct Grooming -> Coat & Presentation path is dormant.
- The underlying inherited coat trait continues to affect the Coat & Presentation judging category. The current grooming action does not alter that genetic trait.

### F. What players see

- Dog page: coat condition, net grooming effect, grooming status, weekly action allowance, self-groom action, outside-list action, and listing cancellation.
- Kennel Services: grooming capacity, own/outside action counts, remaining capacity, simple XP/level, open jobs, and the fixed payment.
- Service records, condition-event history, a money ledger entry for the groomer, owner notice, and listing lifecycle are persisted.

---

## 4. Current system versus the vision

| Area | Current implementation | Original intended direction |
| --- | --- | --- |
| Core fantasy | Maintain a scalar coat-condition value | Practice a presentation craft and become a known specialist |
| Outcome | Uniform +0.20 (modified only by thyroid) | Quality should vary by dog, coat, preparation, skill, and circumstance |
| Show impact | Indirect: one-third of Conditioning & Handling | Directly improve Coat & Presentation, especially for coated breeds; may also support ring readiness |
| Skill progression | +1 XP per action, level every 10 XP; currently no effect on results | Outcome-driven skill/reputation/specialization with diminishing returns |
| Breed/coats | Job cards show breed, but breed never changes the grooming result | Breed/coated-breed relevance and groomer specialisms should matter |
| Marketplace | Fixed $500 faucet; owner pays $0 | Client-funded service economy with value, demand, reputation, and satisfaction |
| Player decision | Which dog/job gets one of ten actions | Select appropriate service, timing, groomer, cost, risk, and target show objective |
| Social layer | Anonymous open job board and owner notice | Trusted client relationships, recognizable groomers, and social dependency |
| Presentation model | One generic maintenance action | Coat prep, trimming/scissoring, maintenance quality, and possibly ring prep as distinct concepts |

---

## 5. Design constraints worth preserving

- **Do not turn grooming into genetics.** It should improve expression/readiness, not permanently improve hidden inherited coat quality.
- **Preserve the master-file split between genetic directional categories and optimized condition.** The grooming system may influence visible performance/presentation, but should not erase directional breeding information.
- **Keep actions legible.** Players need to understand why a particular groomer, breed, service, or timing produced an outcome.
- **Avoid a mandatory daily chore.** The current weekly limit, decay, and pre-entry timing create a useful cadence, but a deeper system should not demand rote clicks on every dog.
- **Avoid runaway rich-get-richer effects.** Specialist services should create alternative careers and market choices, not make an early advantage irreversible.
- **Retain the audit trail.** The current action/event/ledger/listing model is a strong foundation for explainable outcomes and disputes.
- **Respect health.** Thyroid-linked coat limits are a compelling connection between health and presentation and should remain understandable.
- **Be careful with entry snapshots.** If grooming changes show outcomes, decide explicitly whether preparation locks at entry, locks at show close, or remains live until judging.

---

## 6. Decisions to make in a design session

1. What is the player-facing fantasy: full professional grooming, broad "presentation prep," or grooming plus separate handling/conditioning systems?
2. Which dogs need grooming most? Should coat type, breed profile, age, season, recent whelping, health, or show schedule change the need and the upside?
3. What should a grooming result affect: only coat condition, Coat & Presentation directly, Conditioning & Handling, show variance/reliability, a short-lived "show-ready" state, or a combination?
4. How should quality be calculated? Candidate inputs: groomer skill, relevant specialization, dog coat type/need, facility/equipment, owner instructions, timing before a show, health, and controlled variance.
5. How should a poor or mismatched result behave? No gain, reduced gain, short-lived penalty, client dissatisfaction, reputational consequence, or cosmetic-only flavor?
6. What information should owners see when choosing a groomer: price, level, specialty, recent outcomes, reviews, availability, expected quality range, or all of these?
7. Who sets the price, and who pays? Is $500 an early-game NPC subsidy, a permanent contract floor, or a placeholder to replace with owner-funded payments?
8. What does specialization mean: breed family, coat type, grooming style, service type, or a mix? How quickly can a specialist broaden their practice?
9. How does reputation grow without becoming a pure action counter? Candidate signals: client ratings, repeat business, show outcomes after prep, difficulty of coats, and consistency.
10. Is grooming a weekly maintenance action, a pre-show preparation choice, or both? If both, how are their benefits different?
11. Which components should be shipped first so the system becomes strategically interesting before adding a large profession simulation?

---

## 7. Suggested phased direction (for discussion, not a committed plan)

### Phase 1 - Make current grooming meaningful

- Define a clear, bounded conversion from coat condition into Coat & Presentation and/or Conditioning & Handling.
- Add a visible "prepared for show" explanation so players can see the benefit before entering.
- Replace or supplement the unused generic grooming presentation hook with the actual coat-condition relationship.
- Decide the show snapshot timing and communicate it in the UI.

### Phase 2 - Introduce differentiated work

- Add coat/breed presentation profiles (for example: low-maintenance, maintenance-heavy, trim-intensive) without implying every breed is equally grooming-dependent.
- Give jobs a service request and expected result rather than a uniform action.
- Make skill influence the quality range, with strong caps and diminishing returns.

### Phase 3 - Build the profession and market

- Let groomers set prices within sensible bounds; move from the game-funded $500 placeholder to a deliberate economy model.
- Add visible grooming profiles: specialties, recent work, reliability, client satisfaction, and repeat-client indicators.
- Award progression from meaningful outcomes, appropriate difficulty, and satisfaction--not raw volume alone.

### Phase 4 - Add social and show texture

- Add optional contracts/appointments tied to a show date, trusted-groomer relationships, and local/district discovery.
- Consider show-result feedback that makes preparation quality observable but never fully deterministic.
- Expand carefully into facilities, equipment, grooming clinics, mentorship, or breed-specific techniques only if they create choices rather than chores.

---

## 8. ChatGPT-ready continuation prompt

Copy the block below into a new ChatGPT conversation:

```text
I am designing the grooming/presentation portion of a multiplayer dog-conformation simulation game, ShowRing Game. I want you to help turn an existing functional scaffold into a deeper, coherent system. Please act as a game-systems designer: identify ambiguities, propose alternatives with tradeoffs, protect against tedious chores and runaway advantages, and finish with a recommended MVP and a later-expansion roadmap. Do not write code yet.

GAME CONTEXT
- The game is about breeding, raising, conditioning, entering, and campaigning dogs in conformation shows. Hidden genetic/structural traits are separate from mutable condition and presentation.
- Coat is a hidden inherited trait. Coat & Presentation is a judging category. Grooming should improve the expression/readiness of a dog, never permanently improve its genetics or erase breeding-relevant information.
- Conditioning & Handling is a separate optimized 0-10 show score. Current coat condition, muscle tone, and ring obedience contribute equally; fatigue subtracts from that score.
- The game values authentic but understandable simulation, meaningful player identities, social interdependence, and non-deterministic judging. It should not become a spreadsheet or a daily-click chore.

ORIGINAL VISION
- Grooming/presentation services include coat trimming, presentation prep, and maintenance; adjacent services may include stacking, gait, and handling lessons.
- Grooming is particularly important for coated breeds.
- Players should be able to build a career as a grooming specialist, not only succeed by breeding elite dogs.
- A good groomer should be known for coat prep, presentation, trimming/scissoring, and maintenance quality.
- Progress should emerge from successful work: preparing coated breeds, producing better presentation outcomes, and satisfying clients.
- The intended long-term model is skill + reputation + specialization with diminishing returns. I explicitly want to avoid "groomed 100 dogs, therefore +5 skill."
- The service layer should create social dependency: breeders can hire respected specialists when they lack the relevant ability.

CURRENT IMPLEMENTATION
- A living, visible dog unlocks grooming at 12 game weeks old. Dogs awaiting emergency care cannot be groomed.
- A dog may be groomed once per game week. Each kennel has 10 shared grooming actions per game week, usable on its own dogs or outside jobs.
- Self-grooming is free and gives +0.20 persistent coat condition, capped at 20.
- An owner may list a dog; another kennel can accept it. The groomer receives a fixed $500 paid by the game. The owner is not charged; this is explicitly a temporary development-stage placeholder.
- Every grooming action currently has the same result except thyroid health: yellow thyroid gives 60% of normal gain and caps coat condition at 15; red gives 15% and caps at 9. Both also make missed maintenance decay faster.
- An eligible dog that misses a completed grooming week loses up to 0.05 of its net condition gained from grooming. This is intended as maintenance decay, not a penalty below baseline.
- Grooming gives +1 XP per action. A level increases every 10 XP, but XP/level currently have no effect.
- The game records actions, listings, condition events, payments, notifications, and a money ledger.
- Grooming currently improves show performance only indirectly: coat condition is one-third of the Conditioning & Handling snapshot captured at show entry. There is also a dormant rule hook for a direct grooming-based presentation modifier, but the live grooming system does not use it.
- The current UI shows coat condition, grooming status, a services job board, action capacity, XP/level, and the fixed fee.

KEY GAPS
- No breed, coat-type, coat-style, or service differentiation.
- No skill effect, reputation, client satisfaction, price setting, or repeated-client relationship.
- No direct Coat & Presentation outcome from grooming.
- No quality range, timing decision, risk, specialization, or meaningful choice beyond allocating weekly actions.
- Current outside grooming is a game-funded currency faucet, not a client-funded service economy.

DESIGN QUESTIONS I WANT TO ANSWER
1. What should the grooming loop look like for owners and professional groomers?
2. How should coat condition, short-term preparation, Coat & Presentation, and Conditioning & Handling relate without double-counting or making grooming mandatory?
3. What is a simple, explainable quality formula for a service result?
4. What kind of specialization is most legible and fun: coat type, breed family, style, service type, or hybrid?
5. How can skill and reputation be outcome-driven rather than action-count-driven?
6. How should payment, pricing, demand, and client satisfaction work without a rich-get-richer spiral?
7. What should be an MVP that builds naturally from the existing data model, and what should wait for later?

Please first restate the system model you infer, then offer 2-3 distinct design directions. Compare their benefits, risks, player behavior, and implementation complexity. Recommend one direction and provide a phased MVP/backlog with concrete player-facing rules and example scenarios.
```

---

## 9. Evidence / implementation map

- Master design: `docs/MasterFile4_3.md` (visible condition stats, Coat & Presentation judging category, Conditioning & Handling, presentation modifiers, community services).
- Original economy/profession thinking: `docs/ECONOMY_IDEAS.md` (Grooming / Presentation Services; Professional Reputation + Skill Development; Grooming Skill; specialization).
- Live rules and workflow: `apps/web/server/services/grooming.service.ts`.
- Data model: `apps/web/prisma/schema.prisma` (`GroomingListing`, `GroomingServiceAction`, `DogConditionEvent`, `KennelServiceProfile`, and `Dog.coatCondition`).
- Player UI: `apps/web/app/kennel/services/grooming/page.tsx` and `apps/web/app/dogs/[dogId]/page.tsx`.
- Show connection: `packages/rules/engines/conditioning.engine.ts`, `packages/rules/engines/presentation.engine.ts`, `packages/rules/engines/judging.engine.ts`, and `apps/web/server/services/showEntry.service.ts`.
- Health interaction: `packages/rules/engines/healthExpression.engine.ts`.
