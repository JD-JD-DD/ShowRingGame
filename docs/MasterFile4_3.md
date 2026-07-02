# Visible Trait / Ring Category Display System

## description

The Visible Trait / Ring Category Display System converts a dog’s hidden raw structural traits into player-facing visible category scores.

Each dog has hidden raw traits on a 0–20 scale where:

- 10 = ideal
- values below 10 = under ideal
- values above 10 = over ideal

Players do not see raw traits directly.

Instead, players see visible ring categories derived from groups of hidden traits.

These visible categories must also remain on a 0–20 scale with 10 as the ideal midpoint.

This is required because players need to be able to reason directionally about breeding stock:

- this dog appears under in front
- this dog appears over in front
- these two dogs may complement one another

The visible category system therefore exists to preserve:

- directional information
- approximate magnitude
- uncertainty

while still hiding the exact breeding math.

---

## psychology

Players must feel they are evaluating dogs, not reading spreadsheet cells.

If visible categories preserve “side of ideal,” then players can make informed pairings:

- pair an over dog with an under dog
- moderate an excessive trait
- strengthen a weak area without overshooting

If visible categories collapse both sides of ideal into a generic “quality” score, then breeding stops feeling strategic and starts feeling blind.

This system is intended to create:

- informed judgment
- uncertainty without opacity
- evaluation skill
- breed-specific interpretation over time

---

## gameplay role

This system is the player-facing translation layer between:

- hidden genetic truth
- visible evaluation data

It supports:

- foundation dog shopping
- sire/dam pairing decisions
- long-term breeding plans
- phenotype comparison
- later breed-specific display nuance

It must allow a player to identify whether a visible category appears:

- under ideal
- near ideal
- over ideal

without revealing the exact hidden trait values or inheritance formula.

---

## rules

### hidden raw traits

Each hidden raw trait is stored on a 0–20 scale with 10 ideal.

These hidden traits remain private.

### visible ring categories

Visible ring categories are derived from mapped groups of hidden traits using `CATEGORY_TRAIT_MAP`.

Visible ring categories must also be expressed on a 0–20 scale with 10 ideal.

### mandatory display rule

Visible category scores must preserve side of ideal.

That means:

- visible score < 10 = appears under ideal
- visible score = 10 = appears ideal
- visible score > 10 = appears over ideal

### approximation rule

Visible category scores are approximations of hidden traits, not direct raw trait readouts.

The approximation may include:

- category weighting
- breed-specific weighting
- small display variance
- rounding

### forbidden transformation

Visible category scores must not be transformed into a pure “closeness to ideal” score.

The following class of transformation is forbidden for player-visible category display:

```ts
10 - abs(value - 10)
```

or any equivalent transformation that makes:

- 8 and 12 appear the same
- 7 and 13 appear the same

because this destroys directional breeding information.

### breed-specific future rule

Later, visible category calculations may vary by breed so that some breeds emphasize some component traits more heavily than others.

This weighting may alter how a category is displayed, but it must still preserve side-of-ideal semantics.

---

## states

NA

This system is a derived display model, not a stateful object lifecycle.

---

## objects

### hidden traits

Underlying structural / genetic values:

- head
- forequarters
- hindquarters
- gait
- coat
- size
- temperament
- showShine
- feet
- topline

### visible categories

Player-facing ring summaries:

- Type & Expression
- Structure & Balance
- Movement
- Coat & Presentation
- Temperament & Ring Behavior
- Conditioning & Handling

### category mapping

`CATEGORY_TRAIT_MAP`

Defines which hidden traits contribute to which visible category.

### optional breed display weights

A future breed-level weighting layer that can alter how strongly each mapped hidden trait contributes to a visible category.

---

## dependencies

This system depends on:

- hidden trait generation
- hidden trait inheritance
- category-to-trait mapping
- breed data for future breed-specific weighting
- UI components that render player-visible bars or scores

---

## constants

### visible scale lock

```ts
VISIBLE_CATEGORY_MIN = 0
VISIBLE_CATEGORY_IDEAL = 10
VISIBLE_CATEGORY_MAX = 20
```

### display meaning lock

```txt
< 10 = under ideal
10 = ideal
> 10 = over ideal
```

### optional display variance

If used, display variance must remain small enough that it does not destroy the score’s directional meaning.

Recommended first-pass range:

```ts
DISPLAY_VARIANCE = ±0.2 to ±0.5
```

### rounding

Recommended display rounding:

```txt
round to 1 decimal place
```

---

## algorithms

### base algorithm

For each visible category:

1. get the hidden traits mapped to that category
2. average those hidden traits
3. round to one decimal
4. clamp to 0–20

Base formula:

```ts
visibleCategory = clamp(
  0,
  20,
  round1(average(mappedHiddenTraits))
)
```

### weighted algorithm

If category trait weights are used:

```ts
visibleCategory = clamp(
  0,
  20,
  round1(weightedAverage(mappedHiddenTraits))
)
```

### weighted + variance algorithm

If small display variance is used:

```ts
visibleCategory = clamp(
  0,
  20,
  round1(
    weightedAverage(mappedHiddenTraits) + displayVariance
  )
)
```

### breed-specific algorithm

If a breed-specific display model is later introduced:

```ts
visibleCategory = clamp(
  0,
  20,
  round1(
    weightedAverage(
      mappedHiddenTraitsUsingBreedDisplayWeights
    ) + smallDisplayVariance
  )
)
```

---

## randomness

Small display variance may be used to prevent direct reverse-engineering of exact hidden trait values.

If used, that variance must be:

- small
- symmetrical
- non-destructive to side-of-ideal meaning

The variance exists to preserve ambiguity, not to change a dog’s visible “direction.”

A score that is truly over ideal should not randomly appear under ideal because of display noise.

---

## economics

Visible category display affects market behavior and pricing psychology.

Players buy dogs based on visible category appeal, not hidden exact numbers.

This system therefore shapes:

- market desirability
- perceived value
- breeding demand
- “shopping” behavior

Because players only see approximated visible category scores, hidden raw traits remain economically meaningful without becoming directly solvable.

---

## abuse prevention

### anti-spreadsheet rule

Do not expose hidden raw traits to the client.

### anti-direct-formula rule

Do not expose exact category weighting formulas to players.

### anti-collapse rule

Do not convert visible display into a directionless closeness score.

That makes breeding overly opaque while still allowing third-party tools to approximate too much from simplified data.

### controlled uncertainty rule

If display variance is used, keep it small enough to obscure exact reverse-engineering while preserving useful breeding information.

---

## edge cases

### near-ideal scores

A category value very close to 10 should remain visually understandable as near ideal, not forcefully pushed to one side.

### mixed category inputs

A category may average hidden traits that lie on different sides of ideal. In that case, the visible category should truthfully reflect the resulting average.

### breed emphasis

A breed-specific weighting model may make one hidden trait matter more or less inside a visible category, but the final visible score must still remain in the same 0–20, 10-ideal semantic space.

---

## UI visibility

Players should see:

- visible ring category scores
- bars or markers on a 0–20 scale
- 10 clearly marked as ideal
- whether a category appears under or over ideal

Players should not see:

- hidden raw traits
- exact inheritance math
- exact category weighting formulas
- exact display-variance values
- internal simulation scoring formulas

---

## future expansion

This system is designed to support:

- breed-specific visible category weighting
- judge-style interactions with displayed phenotype
- more nuanced player evaluation
- richer market behavior

Possible future additions:

- breed-specific display emphasis profiles
- category-specific masking strength
- age / conditioning influence layers on visible category display
- judge-facing internal interpretation separate from player-facing display

---

## auditability

For any dog, the visible category display should be reproducible from:

- hidden raw trait values
- category mapping
- breed display weights, if any
- display variance rule, if any
- rounding rule

This ensures that visible category display remains explainable and stable even when the exact hidden raw traits remain private.


# Canonical Short Rule Lock

Use this as the locked summary line:

```txt
Visible ring categories are displayed on the same 0–20 scale as hidden raw traits, with 10 as ideal. They must preserve whether a dog appears under or over ideal. They are derived approximations, not direct raw traits, and may include weighting and small display variance, but they must never collapse into a directionless closeness-to-ideal score.
```

---

# Canonical Formula Lock

```ts
visibleCategory = clamp(
  0,
  20,
  round1(
    weightedAverage(mappedHiddenTraits) + smallDisplayVariance
  )
)
```

---

# Explicit Forbidden Formula Lock

Forbidden for player-visible categories:

```ts
10 - abs(value - 10)
```

Because it destroys side-of-ideal information.

---

# Foundation Dog Market Rules

For each active breed in beta:

- target ~10 unsold foundation dogs available at all times
- when inventory drops below target, seed more automatically
- seed in small batches, not huge dumps

A good first rule:

- target inventory per breed: 10
- refill trigger: below 6
- refill batch: +6

That avoids constant churn while keeping the market stocked.

---

# Competitive Level

Foundation dogs should be:

- below the current player-bred top tier
- not so weak they feel like a trap
- variable enough that buyers still hunt for a “nice one”

So the baseline should be:

- slightly below current breed mean
- with modest spread
- occasional strong category combinations
- very rare “quiet bargains”
- no across-the-board elite dogs

---

# Hidden Trait Generation Rule

Your idea is exactly right:

foundation dogs should be slightly lower than the average dog of that breed in existing kennels

I would formalize that as:

If breed has enough live market/player data, use the breed’s current active-dog trait distribution as the reference.

For each hidden trait:

- calculate breed mean
- foundation target mean = breed mean - offset
- sample from a narrow-moderate distribution around that lowered mean

---

# Good Default Offset

For a 1–20 trait scale:

- foundation mean target = breed current mean - 0.75 to 1.25

That is enough to make them generally second-tier without making them hopeless.

---

# Preventing Flat Mediocre Dogs

You specifically do not want:

- 9 / 9 / 9 / 9 / 9 / 9 / 9 / 9 / 9 / 9

That means generation should not be “global rating first.”

Instead, generate per-trait variance, then apply a cap on total excellence.

---

# Better Generation Shape

For each dog:

- start from breed-specific foundation baseline
- roll each trait independently with small correlation structure
- allow a few strengths and a few weaknesses
- reject dogs that are too uniformly good
- reject dogs that are too uniformly bad

---

# Good Constraints

A foundation dog should usually have:

- 2–4 above-baseline traits
- 2–4 below-baseline traits
- the rest near baseline

That creates “shopping psychology”:

- nice mover, weaker coat
- lovely outline, average temperament
- strong head and front, less rear drive

That feels like real dog evaluation.

---

# Hard Anti-Elite Rule

To stop accidental foundation superdogs:

Reject and reroll any dog where:

- too many traits exceed breed mean
- total trait sum exceeds threshold
- visible categories are all strong at once

Example rules:

- no more than 3 traits above breed mean + 1
- no more than 2 visible categories above strong threshold
- total hidden trait sum must stay below breed mean total minus a small margin

---

# Hard Anti-Junk Rule

Also reject dogs where:

- too many traits are severely low
- visible categories all collapse
- they are noncompetitive across the board

Example:

- no more than 3 traits below breed mean - 2
- at least 1 visible category must be plausibly appealing
- total trait sum must stay above breed mean total minus a bigger lower bound

So foundation dogs become:

- serviceable
- occasionally attractive
- rarely exciting
- never truly elite

---

# Best Practical Model

## Tiered Foundation Quality Bands

Instead of one uniform generator, use weighted bands.

For example:

- 60% Standard Foundation
  - clearly usable
  - slightly below breed mean

- 30% Nice Foundation
  - one or two appealing strengths
  - still below top player stock

- 10% Rough Foundation
  - cheaper and weaker
  - still viable for rebuilding lines

You can even later expose this only indirectly through price and visible categories, not with labels.

---

# Price Relationship

If foundation dogs vary, price should vary too.

Suggested first-pass:

- lower-end foundation dogs: cheaper
- nicer category-expression dogs: somewhat more expensive

But price should be based on visible categories only, never raw traits directly in UI.

That preserves the hidden-trait challenge.

---

# Dog Page

Yes — foundation dogs should absolutely have a dog page before purchase.

That page should show:

- name
- reg number
- breed
- sex
- age
- visible ring categories
- basic status
- price
- “available for purchase”

And it should not show:

- raw 10 traits
- exact breeding math
- internal score
- rarity labels

That matches the trust rules in the plan: visible categories only, hidden raw traits remain hidden.

---

# Age

Foundation dogs should not all be identical age.

Recommended:

- mostly young adults
- show-eligible
- breed-eligible soon or already
- some variation for realism

Example:

- age range centered around early adulthood
- enough maturity to show now
- not all old, not all just-born

---

# Fallback When Breed Has Little or No Existing Population

At launch, some breeds may have no established kennel population yet.

Then use:

- breed template baseline from your breed constants
- or national/default breed archetype baseline
- then apply the same “slightly below mean” logic against that template

So the generator can do:

1. use live breed averages if enough data exists
2. otherwise use breed template baseline
3. otherwise use global fallback baseline

---

# Recommended Engine/Service Split

## foundationDog.engine.ts

Pure logic:

- generate hidden traits from breed baseline
- enforce anti-elite and anti-junk constraints
- derive visible categories
- assign age/sex/basic identity inputs

## foundationDog.service.ts

App/data logic:

- count current unsold foundation inventory by breed
- top up inventory if below threshold
- create database rows
- expose market DTOs
- handle purchases

---

# Concrete Starter Rule Set

I would use this exact first-pass policy:

- maintain 10 unsold foundation dogs per breed
- refill when unsold drops below 6
- refill by 6
- foundation hidden trait mean centered around breed mean - 1
- moderate per-trait variance
- require mixed profiles, not flat profiles
- reject elite all-around dogs
- reject hopeless all-around dogs
- visible categories shown on dog page
- raw traits never exposed

That gives you the psychology you want:

- buyers can browse
- some dogs look appealing
- no foundation dog feels like a scam
- serious competitive breeding still matters

The next best step is for me to draft the actual generation rules for `foundationDog.engine.ts` around these constraints.

# ShowRing Game Variable Naming Glossary

## Purpose

This glossary defines the canonical naming conventions for database schema, engine/domain models, API payloads, and UI-facing data.

Its purpose is to keep naming stable across the project and prevent mismatches between Prisma, TypeScript, and gameplay systems.

---

# 1. General Naming Rules

## 1.1 Casing

- Use camelCase for variables and field names in Prisma and TypeScript.
- Use PascalCase for model, type, interface, enum, and class names.
- Use UPPER_SNAKE_CASE for constants.

## 1.2 Identifier Philosophy

- Public/gameplay objects may have both an internal ID and a player-facing identifier.
- Internal IDs are used for relations and database integrity.
- Player-facing identifiers are used for display, registration, or immersion.

## 1.3 Time Philosophy

- Simulation/game time uses integer epoch fields.
- Database/audit timestamps use DateTime.

---

# 2. Primary Identifier Conventions

## 2.1 Generic Primary Key

### id

- Internal primary key for a model.
- Usually Prisma `String @id @default(cuid())`.

## 2.2 User

### id

- Internal primary key for `User`.

### email

- Unique login identity.

### passwordHash

- Stored hashed password, never plain text.

## 2.3 Kennel

### id

- Internal primary key for `Kennel`.

### slug

- URL-safe kennel identifier.

### name

- Public kennel name.

## 2.3.1 Kennel Runs Terminology Lock

- Player-facing name: Kennel Runs.
- Future database model name: `KennelRun`.
- Future dog placement field: `Dog.kennelRunId`.
- A dog may belong to exactly one Kennel Run at a time.
- Moving a dog means changing `Dog.kennelRunId`; moving is not tagging.
- Filters only narrow the currently selected run and never change placement.
- `All Dogs` is a roster view, not a Kennel Run.
- `Uncategorized` is a real system run and cannot be deleted.
- Existing `KennelArea` / `KennelAreaDog` code is legacy many-to-many saved-group behavior and must not be extended for Kennel Runs.

## 2.4 Dog

### id

- Internal primary key if using Prisma model IDs.

### dogId

- Engine/domain identifier if separate from Prisma `id`.

### regNumber

- Public registration number shown to players.

## 2.5 Breed

### code2

- Canonical primary key of `Breed`.
- This is the field all breed relations must reference.

### breedCode2

- Foreign key field used everywhere outside the `Breed` model.

Rule:

```txt
Use code2 only on the Breed model itself.
Use breedCode2 everywhere else.
```

---

# 3. Breed Naming Standard

## 3.1 Canonical Breed Key

### code2

- Primary key on `Breed`.

Example:

```prisma
model Breed {
  code2 String @id
}
```

## 3.2 Breed Foreign Key

### breedCode2

- Used in related models such as `Dog`, `Litter`, `BreedingAttempt`, `ShowEntry`, `ShowResult`, and engine/domain objects.

Example:

```prisma
breedCode2 String
breed Breed @relation(fields: [breedCode2], references: [code2])
```

## 3.3 Forbidden Alternatives

Do not use:

- breedId unless you later create a true breed ID system
- breed_id
- breedCode
- breedKey

For this project, the standard is:

- `Breed.code2`
- related models use `breedCode2`

---

# 4. Time and Epoch Naming Standard

## 4.1 Core Rule

All simulation/gameplay time fields use integer epoch values.

These fields represent the game clock, not real-world wall-clock timestamps.

## 4.2 Canonical Simulation Time Fields

### currentEpoch

- Current simulation time.

### birthEpoch

- Dog birth time in simulation epoch.

### createdEpoch

- Simulation time when a game action/object was created.

### pregCheckEpoch

- Scheduled pregnancy check time.

### dueEpoch

- Scheduled due/whelping time.

### checkedEpoch

- Time pregnancy check was actually performed.

### whelpedEpoch

- Time litter was actually whelped.

### bornEpoch

- Time litter was born.

### enteredAtEpoch

- Time a show entry was submitted.

### scheduledEpoch

- Scheduled time for a show day, judging event, or system action.

### publishedAtEpoch

- Time results were published.

## 4.3 Real Database Timestamps

These are not simulation time. These are audit/record timestamps.

- createdAt
- updatedAt

## 4.4 Rule

- Use `Int` for simulation epochs.
- Use `DateTime` only for database timestamps.

## 4.5 Invalid Pattern

Do not do this:

```prisma
createdEpoch Int @default(now())
```

Because `now()` is a real datetime, not a simulation epoch.

## 4.6 Valid Pattern

```prisma
createdEpoch Int
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

---

# 5. Ownership and Relationship Naming

## 5.1 User-to-Kennel

### userId

- Foreign key from `Kennel` to `User`.

If one user = one kennel:

```prisma
userId String? @unique
```

If later multiple kennels per user:

```prisma
userId String?
```

## 5.2 Dog Ownership

### ownerKennelId

- Current owning kennel.

### breederKennelId

- Kennel that bred the dog.

## 5.3 Litter Parentage

### sireId

- Father dog reference.

### damId

- Mother dog reference.

### litterId

- Litter reference.

### litterOrder

- Puppy birth/order number within litter.

## 5.4 Breeding Events

### createdByKennelId

- Kennel initiating the breeding attempt.

### sireId

### damId

---

# 6. Dog Data Naming

## 6.1 Core Dog Identity

- dogId
- regNumber
- breedCode2
- sex
- birthEpoch

## 6.2 Lifecycle and Status

### lifecycleState

- Alive, deceased, retired, sold, etc.

### marketState

- Not for sale, listed, sold pending, etc.

### originType

- Foundation, player bred, NPC bred, imported, etc.

If enums already exist, keep enum names aligned with schema.

## 6.3 Traits vs Visible Judging Categories

### Hidden Internal Trait Fields

Use for true genetic/structural simulation:

- traits.head
- traits.forequarters
- traits.hindquarters
- traits.gait
- traits.coat
- traits.size
- traits.temperament
- traits.showShine
- traits.feet
- traits.topline

Important note:

If TypeScript currently uses `show_shine`, standardize toward one convention and do not mix both forms long-term.

Preferred camelCase form:

- showShine

If legacy files currently use:

- show_shine

then treat that as technical debt to normalize later.

---

# 7. Show System Naming

## 7.1 Show Structure

- showClusterId
- showDayId
- showEntryId
- showResultId

## 7.2 Show Timing

- scheduledEpoch
- enteredAtEpoch
- publishedAtEpoch

## 7.3 Breed and Dog References in Shows

- breedCode2
- dogId
- judgeId

## 7.4 Status Fields

### status

- Use only when the model context is clear.

Prefer more explicit names if ambiguity grows:

- showDayStatus
- showEntryStatus
- showClusterStatus

---

# 8. Economy Naming

## 8.1 Kennel Economy

### balance

- Current kennel funds.

### reputationScore

- Public or internal reputation metric.

## 8.2 Ledger

- ledgerTransactionId
- primaryKennelId
- counterpartyKennelId
- amount
- transactionType
- createdEpoch for simulation timing
- createdAt for DB audit timing

## 8.3 Marketplace

- listingId
- sellerKennelId
- buyerKennelId
- dogId
- listingStatus
- price

---

# 9. API and Session Naming

## 9.1 Auth/Account

- userId
- email
- password
- passwordHash

## 9.2 Session

- sessionToken
- userId

## 9.3 Current Player Context

- currentUser
- currentKennel
- currentEpoch

---

# 10. Recommended Prisma Relation Standard

Whenever a model references `Breed`, use this pattern:

```prisma
breedCode2 String
breed Breed @relation(fields: [breedCode2], references: [code2])
```

Whenever a model stores simulation time, use this pattern:

```prisma
createdEpoch Int
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

---

# 11. Canonical Field List by Category

## Identity

- id
- dogId
- regNumber
- slug
- code2
- breedCode2

## Ownership

- userId
- ownerKennelId
- breederKennelId
- createdByKennelId
- sellerKennelId
- buyerKennelId

## Time

- currentEpoch
- birthEpoch
- createdEpoch
- pregCheckEpoch
- dueEpoch
- checkedEpoch
- whelpedEpoch
- bornEpoch
- enteredAtEpoch
- scheduledEpoch
- publishedAtEpoch
- createdAt
- updatedAt

## Breeding

- sireId
- damId
- litterId
- litterOrder

## Economy

- balance
- amount
- price
- reputationScore

## Auth

- email
- passwordHash
- sessionToken

---

# 12. Project Rules to Enforce

1. Breed primary key is `code2`.
2. All references to a breed outside `Breed` use `breedCode2`.
3. Simulation/game time uses integer epoch fields only.
4. Database record timestamps use `createdAt` and `updatedAt`.
5. Do not mix `breedId` with `breedCode2`.
6. Do not use `now()` as a default for integer epoch fields.
7. Keep `User` and `Kennel` as separate concepts.
8. Use player-facing IDs like `regNumber` separately from internal relational IDs.

---

# 13. Future-Proofing Notes

## If premium users later own multiple kennels

Change:

```prisma
Kennel.userId String? @unique
```

to:

```prisma
Kennel.userId String?
```

No other naming needs to change.

## If breed IDs are ever redesigned

Only introduce `breedId` if you truly add a separate internal breed primary key.

Until then, `code2` and `breedCode2` remain the standard.

---

# 14. Short Version Reference

## Breed

- `Breed.code2`
- related models: `breedCode2`

## Time

- simulation: `...Epoch` as `Int`
- database audit: `createdAt`, `updatedAt` as `DateTime`

## Core Split

- `User` = login/account
- `Kennel` = playable entity
- `Dog` = simulated dog record


------------------------------------------------------------

# ShowDog Simulation — Master File v4

---

# 1. Design Philosophy

- Build a realistic dog show simulation ecosystem: breeding programs, campaigning, economics, and reputation.
- Avoid single-score dominance: categories + judge preference + small variance; traits are inputs, not outcomes.
- Use natural constraints (time, money, handlers, geography, fatigue) instead of heavy-handed caps.

## 1.1 Design Principles

- Natural constraints preferred over hard caps.
- Economic cost is the primary balancing mechanism.
- Systems should mirror real-world dog show dynamics where possible.
- Player strategy should emerge from logistics, geography, and resource management rather than arbitrary limits.

---

# 2. Core Simulation Systems

---

# 2.1 Time System

## description

Global conversion:

```txt
1 ShowDog hour = 1 real-life day
```

Week structure:

```txt
1 ShowDog week = 7 hours
0–6 = Mon–Sun
```

Year structure:

```txt
1 ShowDog year = 365 hours
52 weeks = 364 hours + 1 special hour
```

Annual special event hour:

```txt
hour index 364
```

No regular shows occur during the annual event hour.

The Time System is deterministic and server-authoritative.

All gameplay timing derives from whole-hour calculations.

---

## psychology

The time system is designed to feel predictable and “AKC-like”:

- weekly rhythm
- annual cadence
- special yearly event timing

Players should feel able to plan campaigns long-term.

Time should feel calendar-driven, not RNG-driven.

---

## gameplay role

Time controls:

- dog aging
- lifecycle gates
- breeding timing
- pregnancy timing
- show scheduling
- annual event scheduling

The entire simulation depends on shared deterministic timing.

---

## rules

### Canonical Time

All gameplay timing derives from whole-hour calculations.

### Discrete Hour Math

```txt
ageHours = floor((now - birthAt) / 1 hour)
```

### Week Structure

```txt
hourInWeek ∈ {0..6}
```

Maps directly to:

```txt
0 = Monday
6 = Sunday
```

### Year Structure

```txt
hourInYear ∈ {0..364}
```

### Annual Event Hour

```txt
hourInYear == 364
```

Reserved for annual special event logic.

No regular shows occur during this hour.

### Show Scheduling

Regular shows occur only on:

- Monday (0) for 4-day clusters
- Friday (4)
- Saturday (5)
- Sunday (6)

No regular shows occur Tuesday–Thursday.

---

## states

NA

The Time System is deterministic and stateless.

---

## objects

### Clock

Authoritative server time source.

### GameCalendar

Pure functions deriving:

- week index
- hour in week
- hour in year
- year index

### RulesConstants

Immutable timing and lifecycle constants.

### SchedulerJob

Hourly jobs that:

- generate shows
- resolve pregnancy checks
- resolve whelping
- process scheduled events

---

## dependencies

The Time System depends on:

- consistent server time
- shared rules package
- deterministic hour math
- hourly scheduler/job system

---

## constants

```txt
SHOWDOG_WEEK_HOURS = 7
SHOWDOG_YEAR_HOURS = 365
ANNUAL_EVENT_HOUR_IN_YEAR = 364
```

---

## algorithms

### Hour In Week

```txt
hourInWeek = floor(epochHours) % 7
```

### Week Index

```txt
weekIndex = floor(epochHours / 7)
```

### Year Index

```txt
yearIndex = floor(epochHours / 365)
```

### Annual Event Check

```txt
isAnnualEventHour =
    hourInYear == 364
```

---

## randomness

None.

The Time System must remain deterministic.

---

## economics

NA

Time gates economic activity but does not directly generate costs.

---

## abuse prevention

- server-authoritative timing only
- no client clock trust
- deterministic hour calculations
- idempotent scheduled jobs
- no fractional-hour manipulation

---

## edge cases

### DST / timezone shifts

Whole-hour calculations prevent DST manipulation.

### Annual event boundary

Annual event hour must never generate regular shows.

### Rounding boundaries

Eligibility changes occur only on full-hour boundaries.

---

## UI visibility

Players should see:

- weekdays
- week numbers
- annual event timing
- deterministic scheduling

Players should not see:

- internal epoch math
- scheduling internals
- server timestamps

---

## future expansion

Supports future:

- invitationals
- specialties
- seasonal rankings
- holiday events
- additional annual structures

---

## auditability

Time-derived systems should store:

- canonical timestamp
- derived indices
- scheduling metadata

for debugging and replay purposes.

---

# 2.2 Dog Lifecycle

## description

The Dog Lifecycle System governs:

- maturation
- show eligibility
- breeding eligibility
- pregnancy
- aging
- retirement
- death

All lifecycle timing derives from ShowDog hour thresholds.

Core lifecycle gates include:

- puppy maturity
- show eligibility
- breeding eligibility
- pregnancy and gestation
- veteran eligibility
- retirement
- aging/death risk

The lifecycle intentionally mirrors real-world dog development timelines.

---

## psychology

Lifecycle exists to create:

- long-term attachment
- strategic timing
- realism
- emotional stakes

Dogs progress through meaningful stages:

```txt
puppy → campaign dog → breeding dog → veteran → retirement/death
```

Without lifecycle limits, the ecosystem would collapse into permanent super-dogs.

---

## gameplay role

Lifecycle gates:

- shows
- breeding
- puppy sales
- health testing
- veteran eligibility

Core gameplay loop:

```txt
breed dogs
↓
raise puppies
↓
campaign dogs
↓
breed dogs
↓
retire dogs
```

---

## rules

### Puppy Sale Eligibility

```txt
age ≥ 56 hours
```

### Minimum Show Age

```txt
age ≥ 182 hours
```

### Minimum Breeding Age

```txt
age ≥ 730 hours
```

### Dam Breeding Cutoff

```txt
age ≤ 2520 hours
```

### Pregnancy Check

Occurs:

```txt
30 hours after breeding
```

### Gestation

Pregnancy duration:

```txt
60 hours
```

### Aging Risk Begins

```txt
2880 hours
```

### Veteran Eligibility

```txt
3240 hours
```

### Maximum Show Age

```txt
3840 hours
```

---

## states

```txt
PUPPY
JUNIOR
ADULT
VETERAN
RETIRED
DECEASED
FOREVER_HOME
TRANSFERRED
```

### state meanings

#### PUPPY

- cannot show
- cannot breed
- may be sold

#### JUNIOR

- show eligible
- not breed eligible

#### ADULT

- show eligible
- breed eligible

#### VETERAN

- veteran classes
- limited female breeding

#### RETIRED

- no longer show eligible

#### DECEASED

- immutable historical record

#### FOREVER_HOME

- removed from active play
- preserved in pedigree

#### TRANSFERRED

- ownership changed

---

## objects

### Dog

Primary lifecycle entity.

Derived values:

- ageHours
- ageDays
- ageYearsEquivalent

### BreedingAttempt

Tracks:

- breeding timing
- pregnancy check
- gestation
- litter resolution

### Litter

Tracks:

- birth timing
- puppy count
- parentage

### HealthTest

Health results revealed at breeding age.

---

## dependencies

Lifecycle depends on:

- Time System
- Breeding System
- Health System
- Show System
- Death System

---

## constants

```txt
PUPPY_SALE_MIN_AGE_HOURS = 56
MIN_SHOW_AGE_HOURS = 182
MIN_BREED_AGE_HOURS = 730
PREG_CHECK_HOURS = 30
GESTATION_HOURS = 60
DAM_MAX_BREED_AGE_HOURS = 2520
AGE_DEATH_START_HOURS = 2880
VETERAN_START_HOURS = 3240
MAX_SHOW_AGE_HOURS = 3840
```

---

## algorithms

### Age Calculation

```txt
ageHours = floor((now - birthAt) / 1 hour)
```

### Lifecycle State

```txt
if ageHours < MIN_SHOW_AGE
    state = PUPPY

else if ageHours < MIN_BREED_AGE
    state = JUNIOR

else if ageHours < VETERAN_START
    state = ADULT

else if ageHours < MAX_SHOW_AGE
    state = VETERAN

else
    state = RETIRED
```

### Breeding Eligibility

```txt
female:
    age >= MIN_BREED_AGE
    AND age <= DAM_MAX_BREED_AGE

male:
    age >= MIN_BREED_AGE
```

### Show Eligibility

```txt
age >= MIN_SHOW_AGE
AND age <= MAX_SHOW_AGE
AND status != DECEASED
```

### Death Risk

```txt
if ageHours >= AGE_DEATH_START
    daily death probability increases gradually
```

Exact curve TBD.

---

## randomness

Randomness exists only in:

- death probability
- breeding outcomes

Lifecycle logic itself is deterministic.

---

## economics

Lifecycle indirectly affects:

- puppy market
- stud fees
- show participation
- kennel turnover

---

## abuse prevention

- immortality prevention
- female breeding cutoff
- immutable pedigree history
- lifecycle gates enforced server-side

---

## edge cases

### Dog dies during pregnancy

- litter fails
- breeding attempt closes

### Dog sold while pregnant

- pregnancy remains attached to dog

### Dog dies during show entry

- entry voided

### Dog ages during cluster

Eligibility determined at show start time.

---

## UI visibility

Players should see:

- age
- lifecycle stage
- show eligibility
- breeding eligibility
- pregnancy status
- due date

Players should not see:

- death probability
- internal mortality curves

---

## future expansion

Potential additions:

- longevity genetics
- fertility decline
- injury system
- reproductive complications

---

## auditability

Lifecycle transitions derive from stored timestamps.

Lifecycle state itself is never stored directly.

It is always computed from age.

# 3. Competition Systems

---

# 3.1 Judging System

## description

The Judging System determines placements in dog shows by evaluating dogs across standardized conformation categories, modified by:

- judge preferences
- breed emphasis
- conditioning
- small controlled randomness

The system is intentionally subjective-but-structured, reflecting real-world conformation judging rather than deterministic stat comparison.

All dogs are evaluated using six universal judging categories:

- Type & Expression
- Structure & Balance
- Movement
- Coat, Color & Presentation
- Temperament & Ring Behavior
- Conditioning & Handling

Some breeds additionally use a Breed Essential category.

Breed Essential may cause:

- bonuses
- penalties
- eliminations
- disqualifications

---

## psychology

The judging system is designed to replicate the psychology of real dog shows.

Key goals:

### Authenticity

Real dog shows are not fully objective.

Different judges prioritize different traits.

### Strategic Campaigning

Players learn:

- judge tendencies
- regional preferences
- show strategy

### Anti-Optimization

There is no permanent perfect build.

### Controlled Uncertainty

Top dogs can still lose occasionally.

---

## gameplay role

Judging sits at the center of the gameplay loop:

```txt
breed dogs
↓
raise puppies
↓
train conditioning
↓
enter shows
↓
judge dogs
↓
award placements
```

Judging produces:

- placements
- title progression
- rankings
- market reputation
- kennel prestige

---

## rules

### Universal Category Evaluation

Every dog is scored across six judging categories.

### Judge Preferences

Judges modify category weighting based on preference profiles.

### Controlled Randomness

Small variance simulates:

- ring dynamics
- handling variation
- day-to-day unpredictability

### Breed Essential

Breed Essential occurs after base scoring.

Possible outcomes:

- Pass → bonus
- Fault → penalty
- Elimination → cannot place
- Disqualification → removed entirely

---

## states

Show lifecycle states interacting with judging:

```txt
SCHEDULED
OPEN
LOCKED
JUDGING
PUBLISHED
```

The judging algorithm executes during:

```txt
JUDGING
```

---

## objects

### Judge

Represents a show judge.

Key concepts:

- preference profile
- experience level
- weighting bias

### JudgePreferenceProfile

Defines category weighting modifiers.

Typical modifier range:

```txt
0.9 – 1.1
```

### ShowEntry

Represents a dog entered in a show.

### JudgingScore

Temporary judging result structure:

- category scores
- base score
- breed essential result
- final score
- placement

---

## dependencies

Judging depends on:

- Genetics System
- Training / Conditioning System
- Breed System
- Judge System
- Show System

---

## constants

### Judging Categories

```txt
TYPE_EXPRESSION
STRUCTURE_BALANCE
MOVEMENT
COAT_PRESENTATION
TEMPERAMENT_BEHAVIOR
CONDITIONING_HANDLING
```

### Baseline Category Weights

```txt
TYPE_WEIGHT = 1.0
STRUCTURE_WEIGHT = 1.0
MOVEMENT_WEIGHT = 1.0
COAT_WEIGHT = 1.0
TEMPERAMENT_WEIGHT = 1.0
CONDITIONING_WEIGHT = 1.0
```

### Random Variance

Small percentage variance.

Exact tuning TBD.

---

## algorithms

### Base Scoring

```txt
score =
(Type × weight)
+ (Structure × weight)
+ (Movement × weight)
+ (Coat × weight)
+ (Temperament × weight)
+ (Conditioning × weight)
```

### Judge Preference Adjustment

```txt
weight = baseWeight × judgeModifier
```

Example:

```txt
structureWeight = 1.0 × 1.05
```

### Breed Essential Adjustment

```txt
score *= BreedEssentialModifier
```

### Random Variance

```txt
score += RandomVariance
```

### Final Placement

Dogs are sorted by:

```txt
finalScore
```

---

## randomness

Randomness is intentionally:

- small
- controlled
- non-destructive

Purpose:

- avoid deterministic outcomes
- preserve realism
- prevent solved optimization

Example:

```txt
RandomVariance = random(-0.5 to +0.5)
```

Exact tuning occurs during beta.

---

## economics

Judging outcomes influence:

- stud demand
- puppy pricing
- kennel prestige
- campaign strategy
- market value

---

## abuse prevention

### Hidden Entries

Players cannot see all entries before judging.

### Hidden Judge Preferences

Players infer tendencies over time.

### Variance Inclusion

Prevents deterministic dominance.

---

## edge cases

### Breed Essential DQ

Dog removed from placements entirely.

### Tie Scores

Tie-break priority:

```txt
1. higher structure score
2. higher movement score
3. random tie-break
```

### Dog Death During Show

Entry voided before judging.

---

## UI visibility

Players should see:

- placements
- judge names
- summarized category performance

Players should not see:

- exact judge weights
- exact RNG values

---

## future expansion

Planned additions:

- specialty shows
- judge reputation
- judge regional trends
- judge style history
- advanced breed emphasis systems

---

## auditability

Each judging result should preserve:

- judge
- category scores
- final score
- placement
- random seed

for replay/debugging purposes.

---

# 3.2 Campaign Fatigue System

## description

Campaign Fatigue models the physical and mental wear caused by frequent showing.

Fatigue is separate from Conditioning stats, but interacts with them.

---

## psychology

Fatigue encourages:

- realistic campaign pacing
- strategic rest scheduling
- rotating dogs
- long-term planning

It creates tension between:

- chasing wins
- preserving peak performance

---

## gameplay role

Fatigue primarily penalizes:

- Conditioning & Handling

Optional future effects:

- mild global score dampening
- slower recovery
- increased stress penalties

---

## rules

### Rolling Show Window

Track show participation within a rolling:

```txt
7-hour window
```

### Fatigue Thresholds

```txt
0–2 shows/week = no fatigue
3 shows/week = mild fatigue
4+ shows/week = significant fatigue
```

### Timing

Fatigue applies:

```txt
after show publication
```

### Recovery

Fatigue decays after:

```txt
1 full week without showing
```

---

## objects

### DogFatigue

Tracks:

- fatigue points
- recovery timing

### DogEvent

Tracks:

- show participation
- fatigue-relevant activity

---

## algorithms

### Fatigue Gain

```txt
showsThisWeek = count(shows within last 7 hours)

<=2 shows → +0 fatigue
3 shows → +1 fatigue
4+ shows → +2 fatigue
```

### Fatigue Penalty

```txt
fatiguePenalty =
    clamp(fatiguePoints × penaltyPerPoint)
```

### Judging Application

```txt
ConditioningHandlingScore *= (1 - fatiguePenalty)
```

---

## edge cases

- fatigue applies after results publish
- cancelled shows add no fatigue
- retired/deceased dogs cannot accrue fatigue

---

## tuning (TBD)

- decay rate
- penalty scaling
- conditioning recovery interaction

---

# 3.3 Titles & Championship System

## description

The Titles & Championship System tracks:

- CH progression
- GCH progression
- major wins
- title milestones
- championship history

It produces:

- title prefixes/suffixes
- prestige
- market signaling
- ranking progression

---

## psychology

Titles create:

- long-term prestige goals
- campaign motivation
- strategic scheduling decisions
- emotional investment

---

## gameplay role

Consumes:

- show placements
- points
- majors
- judge diversity

Produces:

- championship titles
- rankings
- reputation
- market value increases

---

## rules

### Title Ladder

```txt
CH
↓
GCH
↓
GCH Bronze
↓
GCH Silver
↓
GCH Gold
↓
GCH Platinum
```

### Championship Requirements

#### Champion (CH)

```txt
15 points
2 majors
3 different judges
```

### Major Definition

```txt
3–5 point win
```

### Anti-Self-Major Rule

Majors require:

```txt
minimum 3 unique kennels
```

---

## point schedule

### Universal Point Table

```txt
2 defeated → 1 point
3–4 defeated → 2 points
5–7 defeated → 3 points
8–11 defeated → 4 points
12+ defeated → 5 points
```

Maximum:

```txt
5 points per show
```

---

## Winners Dog / Winners Bitch

Points determined by same-sex class competition only.

---

## Best of Winners (BOW)

BOW receives the higher point value of the two sexes.

Points do not combine.

Example:

```txt
WD = 2
WB = 3
BOW = 3
```

not:

```txt
5
```

---

## Best of Breed (BOB)

If WD or WB wins BOB:

```txt
dogsCount =
    classDogs + champions
```

Recalculate points using total defeated.

---

## Best of Opposite Sex (BOS)

Only same-sex champions count.

---

## Single-Point BOW Rule

If neither sex individually earns points but combined entries qualify:

```txt
BOW earns 1 point
```

Maximum using this rule:

```txt
1 point
```

---

## Grand Champion System

### GCH

```txt
Champion required
25 GCH points
3 majors
3 judges
```

### Bronze

```txt
100 GCH points
```

### Silver

```txt
200 GCH points
```

### Gold

```txt
400 GCH points
```

### Platinum

```txt
800 GCH points
```

---

## Group & BIS Bonuses (Optional)

```txt
Group 4 → +1
Group 3 → +2
Group 2 → +3
Group 1 → +4
BIS → +5
```

These are not majors.

---

## algorithms

### Step 1 — Determine Winners

```txt
WD
WB
```

### Step 2 — Calculate Base Points

```txt
pointsWD = table(classDogs)
pointsWB = table(classBitches)
```

### Step 3 — Apply BOW

```txt
BOW receives higher point value
```

### Step 4 — Apply BOB Upgrade

```txt
dogsCount =
    classDogs + championDogs
```

### Step 5 — Apply BOS Upgrade

```txt
dogsCount =
    classDogs + sameSexChampions
```

### Step 6 — Award Points

```txt
dog.chPoints += points
```

---

## Major Hunting & Entry Inflation

### Design Intent

Major hunting is:

- intentional
- realistic
- strategically valid

The system intentionally allows players to increase entries to create majors.

Natural constraints prevent abuse:

- entry fees
- travel costs
- fatigue
- kennel limits
- maturity time
- campaign logistics

Only eligible/present dogs count toward points.

---

## edge cases

- points schedules vary by year
- retired dogs cannot earn points
- DQ/Elimination dogs receive no points

---

## future expansion

Potential additions:

- regional point schedules
- specialties
- advanced title ladders
- rankings integration
- invitationals

---

## auditability

Store:

- placements
- judges
- points
- majors
- entry counts
- kennel counts
- random seeds

for replay/debugging purposes.

---

# 3.4 Rankings / Leaderboards System

## description

Computes public rankings for:

- top dogs
- breed rankings
- kennels
- sires
- dams

---

## psychology

Creates:

- social proof
- prestige targets
- aspirational competition
- campaign incentives

---

## gameplay role

Transforms show history into:

- sortable rankings
- prestige systems
- market signaling
- seasonal competition

---

## rules

### Ranking Windows

Recommended:

- rolling 52-week rankings
- current-year rankings

### Dog Ranking Inputs

Potential weighted sources:

- breed points
- group wins
- BIS wins
- BOB wins

### Kennel Rankings

Use:

```txt
top N dogs only
```

to prevent mega-kennel dominance by sheer volume.

### Producer Rankings

Credit sires/dams from offspring performance.

---

## objects

### LeaderboardSnapshot

Cached ranking snapshot structure.

Potential leaderboard types:

- all-breed
- breed-specific
- kennel
- producer

---

## algorithms

### Dog Score

```txt
DogScore =
    a*breedPoints
  + b*groupWins
  + c*BISWins
  + d*BOBWins
```

Weights TBD.

### Kennel Score

```txt
sum(topN DogScores)
```

### Producer Score

```txt
sum(offspring DogScores)
```

---

## abuse prevention

- topN kennel aggregation
- exclude DQs
- exclude voided shows
- optional anti-farming dampening

---

## future expansion

Potential additions:

- regional rankings
- seasonal awards
- historical rankings
- lifetime rankings
- invitation-only rankings


# 4. Competition Infrastructure

---

# 4.1 Cluster / Show Calendar System

## description

The Cluster / Show Calendar System defines:

- the permanent annual show calendar
- repeating cluster circuits
- runtime show generation
- entry windows
- permanent historical results

The system separates:

```txt
ShowTemplate → permanent calendar structure
ShowInstance → runtime occurrence
```

Clusters are fixed and repeat every year.

Cluster types:

- 2-day clusters
- 4-day clusters

The system is deterministic and authoritative.

---

## psychology

The calendar exists to recreate real exhibitor behavior:

- long-term campaign planning
- recurring “known” clusters
- historical memory
- predictable scheduling

Players should learn:

- circuits
- timing
- regional competition patterns

---

## gameplay role

The show calendar is the strategic backbone of competition.

It creates:

- campaign planning
- recurring decisions
- permanent records
- historical prestige

---

## rules

### Weekly Structure

```txt
3 clusters per ShowDog week
```

### Cluster Distribution

```txt
75% → 2-day clusters
25% → 4-day clusters
```

### Permanent Cluster Identity

Cluster type and scheduling remain fixed year-to-year.

### Runtime Generation

ShowInstances generate approximately:

```txt
120 hours ahead
```

### Entry Closing

Entries close approximately:

```txt
14 hours before judging
```

---

## states

### ShowInstanceStatus

```txt
SCHEDULED
OPEN
LOCKED
JUDGING
PUBLISHED
```

---

## objects

### Cluster

Permanent circuit identity.

### ShowTemplate

Immutable annual schedule row.

### ShowInstance

Runtime occurrence with:

- entries
- judging
- results
- fees

### ShowEntry

Dog entered into a specific show.

### ShowResult

Permanent judging result record.

---

## dependencies

Depends on:

- Time System
- Geography System
- Travel System
- Entry Rules
- Judging System
- Queue/Scheduler jobs

---

## constants

```txt
SHOWDOG_WEEK_HOURS = 7
SHOWDOG_YEAR_HOURS = 365

CLUSTERS_PER_WEEK = 3

INSTANCE_GENERATION_HORIZON_HOURS = 120
ENTRY_CLOSE_OFFSET_HOURS = 14
```

---

## algorithms

### District Rotation

15 districts rotate predictably.

Example deterministic pattern:

```txt
3 host districts per week
all districts host every 5 weeks
```

### Template → Instance Generation

Scheduler generates ShowInstances ahead of time.

### Entry Lock

At:

```txt
occursAt - 14h
```

entries become locked.

---

## randomness

None.

Scheduling must remain deterministic.

---

## economics

ShowInstances expose:

- entry fees
- cluster IDs
- district IDs

for travel/economy calculations.

---

## abuse prevention

- immutable templates
- deterministic scheduling
- idempotent instance generation
- entry locking before judging

---

## edge cases

### Annual Event Hour

No regular shows generate during:

```txt
hour 364
```

### Template Retirement

Inactive templates stop future generation but preserve history.

---

## UI visibility

Players can view:

- annual calendar
- cluster schedules
- upcoming shows
- historical results

Players should not see:

- internal rotation formulas

---

## future expansion

Potential additions:

- invitationals
- specialties
- prestige circuits
- seasonal championships

---

## auditability

Store:

- show template identity
- runtime occurrence
- timestamps
- judging state
- published results

for replay/debugging/history.

---

# 4.2 Show System (Runtime)

## description

The Show System manages:

- runtime show occurrences
- entries
- judging triggers
- results publication

Shows exist inside clusters.

Clusters repeat yearly with consistent identity and structure.

---

## psychology

Designed to recreate:

- campaign planning
- regional strategy
- predictable circuits
- competitive suspense

---

## gameplay role

Core gameplay loop:

```txt
breed dogs
↓
raise puppies
↓
condition dogs
↓
select cluster
↓
enter shows
↓
judge dogs
↓
record placements
```

Shows generate:

- placements
- reputation
- title progression
- breeding value signals

---

## rules

### Cluster Rules

```txt
75% = 2-day clusters
25% = 4-day clusters
```

### Eligibility

Dogs must be:

- alive
- old enough
- not retired
- geographically eligible

### Multiple Shows

Dogs may enter multiple shows in a cluster.

### Entry Visibility

Entries remain hidden until judging.

### Results

Results become permanent after publication.

---

## states

### ShowInstance States

```txt
SCHEDULED
ENTRY_OPEN
ENTRY_LOCKED
JUDGING
RESULTS_PUBLISHED
```

---

## objects

### ClusterTemplate

Permanent annual cluster definition.

### ShowInstance

Specific runtime occurrence.

### ShowEntry

Dog entered into a show.

### ShowResult

Permanent judging outcome.

---

## dependencies

Depends on:

- Lifecycle System
- Travel System
- Judge System
- Judging System
- Economy System
- Time System

---

## constants

```txt
SHOW_YEAR_HOURS = 365

CLUSTERS_PER_WEEK = 3

CLUSTER_2DAY_RATIO = 0.75
CLUSTER_4DAY_RATIO = 0.25
```

---

## algorithms

### Cluster Generation

Generate ShowInstances from ClusterTemplates yearly.

### Entry Validation

Reject if:

- underage
- retired
- deceased
- entries locked

### Judging Trigger

```txt
ENTRY_LOCKED
↓
JUDGING
↓
RESULTS_PUBLISHED
```

---

## randomness

No scheduling randomness.

Randomness exists only in:

- judge assignment
- judging results

---

## economics

Shows generate costs:

- entry fees
- travel
- handlers
- upkeep

Shows indirectly affect:

- breeding value
- market reputation
- pricing psychology

---

## abuse prevention

- hidden entries
- fixed calendar
- geography restrictions

---

## edge cases

- dog death before judging
- ownership transfer
- show cancellation
- zero-entry shows

---

## UI visibility

Players can see:

- show calendar
- cluster names
- assigned judges
- entry deadlines
- published results

Players cannot see:

- entries before judging

---

## future expansion

Potential additions:

- specialties
- national events
- cluster prestige
- advanced conditioning systems

---

# 4.3 Geography / Travel System

## description

The Geography / Travel System governs:

- kennel districts
- cluster attendance
- travel restrictions
- travel costs

The world contains:

```txt
15 districts
```

Travel occurs at the kennel level during cluster attendance selection.

Travel cost structure:

```txt
baseTravelCost(distanceTier)
+
(dogsEntered × perDogTravelIncrement)
```

Travel-handled dogs bypass geography restrictions.

---

## psychology

Designed to create:

- campaign planning
- regional identity
- meaningful logistics
- cost-vs-reward decisions

---

## gameplay role

Connects:

```txt
kennel location
↓
cluster selection
↓
travel cost
↓
show eligibility
↓
competition
```

---

## rules

### District Structure

```txt
15 districts
```

### Kennel Home District

Each kennel has one home district.

### Cluster District

Each cluster belongs to one district.

### Travel Cost

Travel quote shown during cluster selection.

### Travel Handlers

Travel-handled dogs:

- ignore geography restrictions
- bundle travel into handler cost

---

## states

### Travel Context

```txt
AT_HOME
ATTENDING_CLUSTER
```

---

## objects

### District

Regional division.

### DistrictDistanceMatrix

15×15 distance lookup.

### KennelLocation

Stores kennel district.

### ClusterLocation

Stores cluster district.

### KennelClusterAttendance

Tracks attendance + travel pricing snapshot.

---

## dependencies

Depends on:

- Kennel System
- Show System
- Handler System
- Economy System
- District Matrix data

---

## constants

```txt
DISTRICT_COUNT = 15
```

Tunable:

- travel fee tiers
- per-dog increment

---

## algorithms

### Distance Tier

```txt
distanceTier =
    matrix[kennelDistrict][clusterDistrict]
```

### Travel Quote

```txt
total =
    baseTravelCost
    +
    (dogsEntered × perDogIncrement)
```

### Entry Updates

Adding dogs recalculates total travel estimate.

### Eligibility

Travel-handled dogs bypass geography restrictions.

---

## randomness

None.

Travel must remain predictable.

---

## economics

Travel is a major money sink.

Costs scale with:

- distance
- number of dogs
- handlers

---

## abuse prevention

- deterministic travel matrix
- scalable cost structure
- no teleporting
- bundled handler travel rules

---

## edge cases

- zero-dog attendance
- withdrawals
- handler assignment changes
- district moves
- canceled clusters

---

## UI visibility

Players should see:

- kennel district
- cluster district
- distance label
- travel estimate
- running total

Players should not see:

- raw matrix internals

---

## future expansion

Potential additions:

- travel time simulation
- prestige circuits
- transport upgrades
- player travel-handler profession

---

# 4.3.1 District Community / Club / Kennel Assistance System

## status

Long-term design goal.

This system should be implemented in stages after the core district, show,
economy, and permission foundations are stable.

---

## description

Districts should become more than travel origins. They should create local
communities where players can compete, cooperate, earn income, and help one
another remain active in the game.

The game currently assigns new kennels to districts to maintain an
approximately equal number of players in each district. That assignment
behavior will need refinement as districts accumulate vacant, inactive, or
abandoned kennels.

The broader goal is to add multiple layers of player community:

- breed clubs
- district all-breed clubs
- paid service roles
- permission-based kennel assistance

These systems should give players meaningful ways to participate even when
their own kennel is temporarily low on funds or when another player needs help
while away from the game.

---

## psychology

Designed to create:

- regional identity
- breed-specific communities
- friendly rivalry
- cooperative relationships
- reasons to return beyond personal kennel progression
- useful roles for players at different economy levels
- resilience when a player must be away from the game

Short absences should still matter because the game continues moving, but a
player should be able to ask for limited in-game help without sharing account
credentials.

---

## district assignment refinement

### current intent

New player kennels are assigned to districts in a way that keeps active player
populations approximately balanced.

### future requirement

District balancing must distinguish between:

- active player kennels
- temporarily inactive player kennels
- vacant or abandoned kennels
- NPC kennels

Vacant kennels should not permanently distort new-player assignment.

### future tuning questions

- When should an inactive kennel stop counting toward district balance?
- Should a returning player retain the original district assignment?
- Should district moves be allowed, and under what cost or cooldown?
- Should club membership survive a district move?
- How should district assignment react when a district club becomes crowded or
  under-populated?

---

## breed clubs

Breed clubs are communities centered on one breed.

Potential club features:

- membership dues
- officers
- club budget
- internal club decisions
- club-funded sweepstakes
- club-funded specialties
- national specialties
- annual Nationals events
- breed-specific discussion and planning

Club budgets should matter. A specialty, sweepstakes event, or Nationals event
should be created through the club's available funds and internal decisions,
not appear automatically without economic support.

---

## district all-breed clubs

Each district may have an all-breed club focused on the local player
community.

Potential club features:

- membership dues
- officers
- club budget
- local perks
- district event planning
- local service coordination
- regional identity and competition

District clubs should provide value even to players who are not currently able
to campaign heavily.

---

## player service roles

Community systems should create optional income activities between players.

Examples:

- handler gigs
- temporary kennel assistance
- club administration
- event support roles

These roles should provide ways for players to earn credits and participate
when their own kennel budget is limited.

---

## permission-based kennel assistance

Players should be able to designate another registered player as a temporary
kennel assistant without sharing login credentials or passwords.

The kennel owner must choose exactly what the assistant may do.

Potential permissions:

- enter shows
- enter shows only within a specified budget
- breed dogs
- manage stud listings
- manage sale listings
- manage handlers
- view private kennel planning information
- re-home dogs
- transfer or sell dogs
- spend credits

High-risk actions should default to denied.

Examples:

```txt
Breed dogs: allowed
Enter shows: allowed up to $2,000
Re-home dogs: denied
Sell or transfer dogs: denied
```

### security requirements

- Never require players to share passwords.
- All assistant actions must be attributed to the acting player.
- Permissions must be granular and revocable.
- Permissions may include start and end times.
- Spending permissions must support explicit caps.
- Destructive or irreversible actions should be denied by default.
- The kennel owner should be able to review an activity history.

### audit trail

Store:

- kennel owner
- assistant player
- granted permissions
- spending cap
- start and end time
- action taken
- acting player
- timestamp
- affected dog, litter, show, listing, or ledger entry where relevant

---

## implementation stages

Recommended order:

1. refine active-player district balancing
2. add club data models and membership dues
3. add district all-breed clubs
4. add breed clubs
5. add club budgets and officers
6. add club-funded sweepstakes, specialties, and Nationals
7. add player service listings such as handler gigs
8. add permission-based temporary kennel assistance with audit history

---

## dependencies

Depends on:

- Geography / Travel System
- Kennel System
- Economy System
- Ledger System
- Show System
- Handler System
- authentication
- granular authorization
- audit logging

---

# 4.4 Handler System

## description

The Handler System is the campaign-capacity limiter.

Handlers determine how many dogs a kennel can realistically campaign per show.

Launch scope:

- capacity gating
- economic scaling

Handlers are not performance modifiers at launch.

---

## psychology

Designed to create:

- natural campaign scaling
- economic pressure
- realistic large-kennel logistics

The goal is:

```txt
better breeding wins
not money advantage
```

---

## gameplay role

Handlers gate show entries.

### Capacity Rules

```txt
1–3 dogs → owner handled
4–6 dogs → 1 handler
7–9 dogs → 2 handlers
10–12 dogs → 3 handlers
```

---

## rules

### Launch Rules

Handler requirements are computed:

```txt
per kennel
per show
```

### No Launch Travel Override

Handlers do not bypass geography at launch.

---

## states

### HandlerAllocationState

```txt
NONE
REQUIRED
PAID
RELEASED
```

---

## objects

### HandlerRequirementPolicy

Defines owner-handled limits.

### HandlerQuote

Computed fee estimate.

### HandlerAllocation

Persisted purchased allocation.

---

## dependencies

Depends on:

- Show Entry
- Economy System
- Travel System

---

## constants

```txt
OWNER_HANDLED_LIMIT = 3
```

---

## algorithms

### Required Handlers

```txt
if dogs <= 3:
    handlers = 0
else:
    handlers = ceil((dogs - 3) / 3)
```

### Fee Calculation

```txt
handlerFee =
    pricingPolicy(handlersRequired)
```

### Entry Gating

Entries fail if:

- insufficient funds
- handler requirements unmet

---

## randomness

None.

Handlers are deterministic logistics.

---

## economics

Handlers are a major money sink.

They naturally limit:

- superkennels
- mass campaigning
- unrealistic entries

---

## abuse prevention

- economic scaling
- no scoring bonuses
- atomic fee + entry commits

---

## edge cases

- partial entry edits
- more than 12 dogs
- multi-day clusters
- insufficient funds

---

## UI visibility

Players should see:

- dogs entered
- handlers required
- handler fee total
- running entry cost

---

## future expansion

Potential additions:

- travel handlers
- handler professions
- handler availability
- handler tiers

---

## auditability

Store:

- handler allocations
- fee transactions
- linked show entries
- kennel references

---

# 4.5 Show Entry Rules

## description

Show Entry Rules govern:

- cluster attendance
- day-level entries
- affordability
- scheduling restrictions

Entries are framed as campaign planning decisions, not instant actions.

---

## psychology

Designed to create:

- commitment
- planning pressure
- realistic logistics
- anti-sniping behavior

---

## gameplay role

Connects:

```txt
calendar
↓
cluster selection
↓
travel quote
↓
dog entries
↓
judging
```

---

## rules

### Cluster Attendance

Kennels choose clusters at the kennel level.

### Entry Restrictions

- dogs may enter only attended clusters
- one show per dog per day
- dogs do not need every cluster day

### Financial Constraint

Kennels may enter as many dogs as they can afford.

### Entry Deadline

```txt
14 hours before judging
```

---

## states

### Entry Lifecycle

```txt
DRAFT
SUBMITTED
CLOSED
JUDGING_LOCKED
RESULT_POSTED
ARCHIVED
```

---

## objects

### ClusterAttendance

Tracks cluster commitment.

### ShowEntry

Day-level entry record.

### EntryQuote

Player-facing fee estimate.

---

## dependencies

Depends on:

- Calendar System
- Travel System
- Handler System
- Lifecycle Eligibility

---

## constants

```txt
ENTRY_CLOSE_OFFSET_HOURS = 14
SHOW_INSTANCE_HORIZON_HOURS = 120
```

---

## algorithms

### Attendance Commit

Create cluster attendance record and quote.

### Entry Validation

Reject if:

- already entered same day
- wrong cluster
- entries closed

---

## randomness

None.

---

## economics

Entry quotes include:

- entry fees
- travel
- handlers

---

## abuse prevention

- entry deadlines
- one cluster commitment
- one show per day

---

## edge cases

- eligibility changes
- cluster changes
- withdrawals
- no refunds

---

## UI visibility

Players should see:

- fee estimates
- deadlines
- live affordability calculations

---

## future expansion

Potential additions:

- advanced point systems
- specialties
- advanced handler systems

---

# 4.6 Show Transparency

## description

Show Transparency governs:

- what players can see
- when they can see it
- permanent result visibility

Core rule:

```txt
entries hidden until judging
```

---

## psychology

Designed to prevent:

- entry sniping
- avoidance behavior
- meta-gaming

Also preserves:

- suspense
- realism
- fairness

---

## gameplay role

Transparency supports:

```txt
Enter
↓
Wait
↓
Judge
↓
Reveal
```

---

## rules

- entries hidden before judging
- results public after judging
- results stored permanently

---

## states

```txt
PRE_JUDGING
JUDGING
POSTED
```

---

## objects

### EntryVisibilityPolicy

Controls visibility rules.

### ShowResultRecord

Permanent append-only result archive.

---

## dependencies

Depends on:

- Show System
- Show History

---

## constants

```txt
ENTRIES_HIDDEN_UNTIL_JUDGING = true
RESULTS_PERMANENT = true
```

---

## algorithms

### Judging Visibility Flip

When judging begins:

```txt
entries become visible
```

### Result Posting

After judging:

```txt
results become permanent
```

---

## randomness

None.

---

## abuse prevention

- anti-sniping
- permanent records
- anti-manipulation

---

## edge cases

- canceled judging
- zero-entry shows

---

## UI visibility

Pre-judging:

```txt
Entries hidden until judging begins
```

Post-judging:

- full results visible permanently

---

# 4.7 Show History

## description

Show History is the permanent archive of competition outcomes.

History supports:

- campaign planning
- prestige
- rankings
- title progression

---

## psychology

Creates:

- long-term mastery
- reputation economy
- social proof
- trust

---

## gameplay role

History supports:

- future campaign planning
- title tracking
- breeder reputation
- kennel prestige

---

## rules

- results permanent
- results append-only
- yearly calendar repeatability preserved

---

## states

Effectively immutable:

```txt
FINAL
```

---

## objects

### ShowResultRecord

Permanent append-only result storage.

### DogShowRecord

Historical results by dog.

### KennelShowRecord

Historical results by kennel.

---

## dependencies

Depends on:

- Transparency System
- Calendar Repeatability
- Judging System

---

## constants

```txt
RESULTS_RETENTION = PERMANENT
```

---

## algorithms

### Record Results

After judging:

```txt
append result record
never overwrite
```

### Historical Views

Query by:

- dog
- kennel
- cluster
- year

---

## randomness

None.

---

## economics

Indirectly affects:

- breeding value
- market reputation
- stud demand

---

## abuse prevention

- append-only history
- immutable records
- anti-revisionism

---

## edge cases

Results persist even if dogs are:

- transferred
- retired
- forever-homed
- deceased

---

## UI visibility

Players can view:

- historical winners
- placements
- title progression
- kennel records

---

# 5. Economy System

## description

The Economy System governs all kennel financial activity.

Core philosophy:

```txt
showing costs money
prestige creates value
breeding generates income
```

Primary income sources:

- puppy sales
- adult dog sales
- stud fees

Primary expenses:

- show entries
- travel
- handlers
- breeding
- kennel upkeep
- food quality

---

## psychology

Core target:

```txt
I lost because someone bred a better dog.
```

Never:

```txt
I lost because someone spent more money.
```

---

## gameplay role

The economy is the simulation constraint layer.

It gives meaning to:

- breeding
- campaigning
- scaling
- logistics
- reputation

---

## rules

### Income Sources

```txt
PUPPY_SALE
ADULT_SALE
STUD_FEE
```

### Prestige-First Structure

Shows generate prestige, not major direct cash payouts.

### Public Puppy Listings

Public litter listings require:

```txt
one-time advertisement fee
```

### Forever Home Market Signal

After one successful public puppy sale:

- additional puppies may sell higher
- remaining puppies may be forever-homed

### Age Limit

Puppy market-floor behavior ends at:

```txt
6 months
```

Afterward:

```txt
dog becomes adult market
```

---

## states

### LitterListingState

```txt
DRAFT
LISTED_PUBLIC
LISTED_PRIVATE
CLOSED
```

### DogSaleState

```txt
NOT_FOR_SALE
FOR_SALE_PRIVATE
FOR_SALE_PUBLIC
SOLD
FOREVER_HOME
```

---

## objects

### KennelWallet

Current kennel funds.

### LedgerTransaction

Append-only transaction record.

### PricePolicy

Centralized economy constants/policies.

### KennelUpkeepBill

Periodic upkeep billing.

### MarketListing

Puppy/adult sale listing.

---

## dependencies

Depends on:

- Show System
- Travel System
- Handler System
- Kennel System
- Breeding System
- Lifecycle System

---

## constants

### Structural

```txt
PUPPY_SALE
ADULT_SALE
STUD_FEE
```

### Tunable

- starter funds
- travel fees
- handler fees
- upkeep costs
- breeding expenses

---

## algorithms

### Cluster Quote

Display:

- entry fees
- travel
- handlers

### Kennel Upkeep

```txt
upkeep =
    runs × upkeepCost
```

### Public Puppy Signal

After one public sale:

```txt
market signal established
```

### Stud Fee

```txt
buyer pays seller
```

### Ledger Posting

All financial activity posts ledger transactions.

---

## randomness

None.

Economic variability comes from:

- player behavior
- market dynamics
- breeding outcomes

not RNG.

---

## economics

### Money Sources

- puppy sales
- adult sales
- stud fees

### Money Sinks

- entries
- travel
- handlers
- breeding
- upkeep

---

## abuse prevention

- no pay-to-win
- economic scaling
- listing fees
- natural kennel caps
- append-only ledger

---

## edge cases

- new kennel liquidity
- unsold puppies aging out
- private sale bypass
- insufficient funds

---

## UI visibility

Players should always see:

- live cost estimates
- balances
- projected balances
- fee breakdowns

---

## future expansion

Potential additions:

- handler profession income
- trainer profession
- advanced market analytics
- pedigree-driven buyer tools

---

## auditability

All money movement must:

- create ledger entries
- preserve metadata
- remain replayable/debuggable

# 6. Player Interface Pages

---

# 6.1 Dog Page

## description

The Dog Page is the central profile viewer for an individual dog.

It acts as:

- an information hub
- an action hub
- a status viewer
- a navigation point into related systems

The page is primarily read-only.

---

## displayed information

### Identity

Display:

- registered name
- call name
- registration number
- breed
- sex
- age
- owner kennel
- breeder kennel

### Status

Display:

- lifecycle status
- pregnancy state (if applicable)
- sale state

### Visible Judging Information

Display only visible phenotype categories.

Do not display hidden genetics.

### Visible Conditioning Stats

Display:

- ring obedience
- muscle tone
- coat condition

### Primary Actions

Available actions may include:

- enter show
- breed
- place for sale
- retire
- forever home
- transfer

---

## psychology

The page should create:

- trust
- clarity
- easy navigation
- meaningful decision-making

Players should feel:

```txt
I understand this dog,
but I do not know every hidden genetic detail.
```

---

## gameplay role

The Dog Page is the central object page of the simulation.

Players use it to verify:

- show eligibility
- breeding eligibility
- conditioning
- ownership
- pedigree
- market state
- pregnancy timeline

---

## rules

### Read-Only Structure

The page itself does not directly edit stats.

Actions route into other systems.

### Hidden Genetics Rule

Hidden traits remain private.

Only visible judging categories are shown.

### Action Validation

All actions must be server-authoritative.

The client UI is never authoritative.

---

## states

### Lifecycle Status

```txt
PUPPY
JUNIOR
ADULT
VETERAN
RETIRED
TRANSFERRED
DECEASED
```

### Reproductive Status

```txt
NOT_PREGNANT
PREGNANT
POST_WHELP
```

### Sale State

```txt
NOT_FOR_SALE
FOR_SALE_PRIVATE
FOR_SALE_PUBLIC
SOLD
FOREVER_HOME
```

---

## objects

### Dog

Core dog identity record.

### DogConditioning

Visible conditioning metrics.

### COI Record

Stores pedigree coefficient information.

### BreedingAttempt

Stores pregnancy timeline information.

---

## dependencies

Depends on:

- Lifecycle System
- Genetics System
- Conditioning System
- Breeding System
- Show Entry System
- Pedigree/COI System
- Market/Economy System

---

## constants

### Registration Format

```txt
<breedCode2><serial7><litterOrder2>
```

Example:

```txt
SS123456702
```

### Conditioning Session Limits

```txt
20 sessions per kennel per day
3 sessions per dog per day
1 session per category per day
```

### Visible Conditioning Stats

Fixed categories:

- ring obedience
- muscle tone
- coat condition

---

## algorithms

### Page Composition

Server assembles:

- identity
- ownership
- conditioning
- visible judging categories
- pedigree summary
- sale state
- pregnancy state
- allowed actions

### Allowed Actions

Server computes allowed actions based on:

- age
- lifecycle state
- ownership
- breeding status
- entry status

### Tick Consistency

Current displayed values must derive from authoritative server-side tick state.

---

## randomness

None.

The Dog Page only displays simulation outcomes from other systems.

---

## economics

The page links into:

- sale listing
- breeding
- show entry

but does not directly process economy transactions itself.

---

## abuse prevention

- hidden genetics
- server-authoritative actions
- unique registration numbers
- permission validation

---

## edge cases

### Missing Dog

```txt
404 — Dog not found
```

### Deceased / Retired

Suppress:

- breeding
- show entry
- sale actions

### Puppy

Suppress:

- show entry
- breeding

### Ownership Transfer

Historical records remain visible.

---

## UI visibility

### Players Must See

- visible judging categories
- visible conditioning stats
- ownership
- age
- status
- allowed actions

### Players Must Not See

- hidden raw traits
- inheritance formulas
- hidden scoring systems

---

## future expansion

Potential additions:

- offspring lists
- show history widgets
- advanced analytics
- handler permissions
- deeper conditioning systems

---

## auditability

The following must remain reproducible:

- registration number structure
- allowed-action derivation
- lifecycle state transitions
- pedigree calculations
- conditioning calculations

---

# 6.2 Kennel Page

## description

The Kennel Page is the primary management overview for a player kennel.

---

## displayed information

### Kennel Summary

Display:

- kennel balance
- kennel size
- run count
- reputation
- quick actions

### Dog Inventory

Filters may include:

- dogs
- bitches
- puppies
- pregnant
- retired
- show age

---

## tabs

Suggested structure:

```txt
Ledger
Dogs
Litters
Contracts
Sales
Awards / Ribbons
```

---

# 6.3 Ledger Page

## description

The Ledger Page is the append-only financial history viewer.

---

## displayed information

### Transactions

Display:

- show fees
- travel fees
- handler fees
- upkeep
- puppy sales
- adult sales
- stud income

### Recurring Expenses

Display recurring costs:

- kennel upkeep
- handler contracts
- food/staff costs

---

## future expansion

Potential additions:

- CSV export
- advanced filtering
- financial summaries

---

# 6.4 Show Entry Page

## description

The Show Entry Page is the cluster campaign planning interface.

---

## workflow

```txt
browse calendar
↓
select cluster
↓
select shows
↓
select eligible dogs
↓
review fees
↓
submit entries
```

---

## displayed information

### Fee Breakdown

Display:

- entry fees
- travel cost
- handler cost
- total estimate
- projected balance after entry

---

## enforcement

Must enforce:

- one show per dog per day
- hidden entries before judging
- affordability checks
- handler requirements
- geography restrictions

---

# 6.5 Whelping / Litter Page

## description

The Whelping / Litter Page manages:

- pregnancies
- litters
- puppies
- puppy sales

---

## displayed information

### Pregnancy

Display:

- dueAtEpoch
- breeding timeline
- litter status

### Puppies

Display:

- puppy list
- registration numbers
- visible early stats policy

### Market Actions

Support:

- puppy listings
- forever-home flow
- pricing management

---

## naming

Support:

- call names
- registered names

Registered-name lock policy remains TBD.

---

# 6.6 Show Results Page

## description

The Show Results Page displays published competition outcomes.

---

## views

### Cluster-Day Results

Display:

- WD
- WB
- BOW
- BOB
- BOS
- Group placements
- BIS placements

### Historical Views

Support:

- dog-centric history
- kennel-centric history

---

# 6.7 Leaderboards Page

## description

The Leaderboards Page displays rankings and prestige standings.

---

## leaderboard categories

### Top Dogs

All-breed and breed-specific rankings.

### Top Kennels

Campaign and production rankings.

### Top Producers

Top sires and dams.

---

## filters

Potential filters:

- rolling year
- current year
- breed
- district
- group

---

# 7. Core Gameplay Loop

## gameplay flow

```txt
breed strategically
↓
manage pedigree / COI
↓
raise puppies
↓
maintain conditioning
↓
campaign on fixed calendar
↓
earn wins and titles
↓
increase reputation and market value
↓
sell puppies / stud services
↓
repeat across generations
```

---

## strategic pillars

Core long-term systems:

- genetics
- pedigree management
- conditioning
- geography
- economics
- campaign planning
- reputation building

---

# 8. Technical Architecture (Proposed v1)

## stack

### Frontend

```txt
Next.js (App Router)
TypeScript
```

### Backend

```txt
NestJS API
```

### Database

```txt
PostgreSQL
Prisma
```

### Queue / Scheduling

```txt
Redis
BullMQ
```

### Shared Packages

```txt
shared DTOs/types
rules package
deterministic helpers
scoring helpers
```

---

## local development

Use Docker Compose for:

- postgres
- redis
- api
- web

---

# 8.1 Repo Layout

```txt
/apps/web        → Next.js frontend
/apps/api        → NestJS backend

/packages/shared → DTOs/types
/packages/rules  → constants/rules/scoring
/packages/ui     → shared UI components (future)
```

---

# Monetization & Economic Philosophy

## description

The monetization philosophy mirrors the real-world dog show ecosystem.

Competitive success should come from:

- breeding strategy
- campaign planning
- long-term kennel management

not direct cash spending.

---

## core philosophy

### Key Principle

```txt
monetization controls scale,
not competitive outcomes
```

All players can:

- enter shows
- earn titles
- breed dogs
- sell puppies
- offer stud service

regardless of subscription tier.

---

## simulation alignment

Several systems reinforce this structure:

- Dog Lifecycle System
- Show Calendar System
- Genetics System
- Economy System

Together these systems ensure:

```txt
prestige is earned,
not purchased
```

---

# Income Sources

## primary income

Launch economy income:

- puppy sales
- stud fees
- adult dog sales

---

## future expansion

Potential additions:

- training services
- handling profession
- advanced kennel services

---

# Expense Sources

## core expenses

Major money sinks:

- show entry fees
- travel
- handlers
- breeding
- kennel upkeep
- health testing (future)

---

# Subscription Tier Structure

## philosophy

Subscriptions affect:

- kennel scale
- operational capacity
- convenience tools

Subscriptions do NOT affect:

- judging
- genetics
- placements
- championship progression

---

# Basic Tier (Free)

## purpose

Supports:

- hobby kennels
- casual participation
- small-scale breeding programs

---

## limits

### Base Configuration

```txt
Kennel Runs: 5
Breeding: 1 litter/year
Stud Service: allowed
Show Entries: unlimited
```

---

## kennel expansions

Optional permanent expansions:

| Expansion | Runs Added | Cost |
|---|---|---|
| 1 | +10 | $5 |
| 2 | +10 | $10 |
| 3 | +10 | $15 |

Maximum possible:

```txt
35 runs
```

---

## upkeep scaling

Example structure:

```txt
Base upkeep: $2/day
Per-run upkeep: $0.50/day
```

---

# Standard Tier

## role

Represents:

```txt
small professional kennel
```

---

## example configuration

```txt
Kennel Runs: 30
Breeding: unlimited
Stud Service: unlimited
Show Entries: unlimited
```

---

## additional tools

Potential additions:

- pedigree tools
- campaign management
- advanced analytics

---

## estimated pricing

```txt
$7–10/month
```

---

# Premium Tier

## role

Represents:

```txt
large competitive kennel
```

---

## example configuration

```txt
Kennel Runs: 75
Breeding: unlimited
Advanced analytics
Campaign tracking
Stud advertising
Branding options
```

---

## estimated pricing

```txt
$15–18/month
```

---

## premium philosophy

Premium affects:

- convenience
- scale
- management tools

Premium does NOT affect:

- genetics
- placements
- judging outcomes
- championships

---

# Kennel Capacity Comparison

| Tier | Approximate Run Capacity |
|---|---|
| Basic | 5–35 |
| Standard | 30 |
| Premium | 75 |

---

# Puppy Market Importance

## core philosophy

The puppy market is the center of the player economy.

Example cycle:

```txt
campaign dogs
↓
earn titles
↓
increase reputation
↓
increase puppy demand
↓
increase stud demand
↓
fund kennel growth
```

---

# Additional Monetization

## philosophy

Additional monetization should focus on:

- identity
- aesthetics
- analytics
- convenience

not competitive advantage.

---

# Potential Cosmetic / Utility Features

## kennel branding

Potential additions:

- logos
- profile banners
- kennel colors

## advanced analytics

Potential additions:

- COI analysis
- breeding prediction tools
- campaign statistics

### Plan A Litter monetization route

The enhanced breed-first `Plan A Litter` worksheet is a separate page from the
free dog-specific `Breed Dog` flow so it can be placed behind a future
entitlement check without changing the core breeding mechanics.

- Premium-ready worksheet route: `/plan-a-litter`
- Free dog-specific route: `/breed?dogId=...`
- Free public-stud route: `/breed?studListingId=...`
- Only the My Kennel page advertises the `Plan A Litter` worksheet.
- Dog-page `Breed Dog` actions continue to use the free anchored flow.

When subscriptions are implemented, enforce access to `/plan-a-litter` on the
server and replace or redirect the My Kennel worksheet link for kennels without
the required entitlement. Typing the URL manually must not bypass the
entitlement check.

## kennel name registration

Potential permanent registration fee system.

---

# Appendix — Remaining TBD Variables

## competition

- district point schedules
- breed point schedules
- yearly recalculation tuning

## fatigue system

- accumulation
- decay
- penalty scaling

## economy tuning

- travel tiers
- handler pricing
- upkeep values
- breeding costs

## breed standards

- standards scope
- ingestion pipeline
- data normalization




