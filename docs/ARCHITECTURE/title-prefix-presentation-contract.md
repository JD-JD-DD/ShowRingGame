# Current Title-Prefix Presentation Contract

## Purpose

This Stage 10E investigation establishes the current CH/GCH prefix read contract for ARCH-DEBT-004. It does not alter title progression, Dog writers, suffix/producer presentation, historical result facts, or player behavior.

## Reader Inventory

| Location / surface | Classification | Current source | Fallback order | Player-visible behavior | Confidence |
| --- | --- | --- | --- | --- | --- |
| `lib/dogNames.ts` / `formatDogDisplayName` | CURRENT DOG IDENTITY | `Dog.visibleTitlePrefix` | none | Prefix is rendered before the base registered/call name | High |
| Dog profile header, public dog, kennel roster/cards, market, stud discovery, pedigree/litter, planner | CURRENT DOG SUMMARY / CURRENT MARKET/STUD PRESENTATION / HISTORICAL PEDIGREE/ANCESTOR DISPLAY | `Dog.visibleTitlePrefix` through direct fields or `formatDogDisplayName` | none | Uses the synchronized display mirror, including in historical-name joins | High |
| Dog profile title/progress panel and Ribbon Room progress | CURRENT DOG SUMMARY | `DogTitleProgress.currentTitleCode` | no prefix fallback | Shows semantic current title/progress, separately from name rendering | High |
| `lib/dogTitles.ts` / `isChampionOfRecordDog` | OTHER: title eligibility/competition | `titleProgress.currentTitleCode` or inline `currentTitleCode` | semantic code first; then prefix; then suffix compatibility | Treats either current projection or legacy display title as Champion-of-record | High |
| `lib/dogTitles.ts` / `getChampionOfRecordTitleLevel` | OTHER: eligibility | semantic code, prefix, suffix | examines all candidate sources | Preserves qualification for incomplete/legacy representations | High |
| `titleProgress.service.ts` / GCH promotion decision | CURRENT TITLE state reconciliation | `DogTitleProgress.currentTitleCode` | `currentTitleCode ?? valid visibleTitlePrefix` | Uses prefix only to retain existing Champion status when the projection is absent/incomplete | High |
| GCH credit/Prestige processing | OTHER: judging classification | `isChampionOfRecordDog` | helper compatibility behavior | Does not infer from awards; accepts current projection/mirror compatibility | High |
| notices | NOTICE/ACHIEVEMENT | newly computed title code passed to `formatDogDisplayName` | explicit transition code replaces prefix for the notice text | Completion notice displays the newly earned CH/GCH code | High |
| show results/history/My Results/Ribbon Room history | HISTORICAL SHOW EVENT | historical award/result facts plus joined Dog prefix for names | none for title name | Preserves historical placement/points while displaying current Dog identity; no event-time title string is stored | High |

## Writer Relationship

- `recalculateDogTitleProgress` calculates CH progress from published positive-point `ShowAward` rows, upserts `DogTitleProgress.currentTitleCode`, then writes the same value to `Dog.visibleTitlePrefix` in the judging transaction.
- `promoteGrandChampionTitleForDog` computes the next GCH code from durable credit qualification, then writes the same code to `DogTitleProgress.currentTitleCode` and `Dog.visibleTitlePrefix` in one transaction.
- `producerMerit.service` writes `visibleTitleSuffix`, not the prefix; it is out of scope for this contract.
- GCH credit processing precedes a later per-dog promotion transaction, so its bounded reconciliation interval is retained and is not a presentation-reader concern to change here.

For normal CH/GCH production transitions, `currentTitleCode` and `visibleTitlePrefix` are intended to be identical when populated.

## Legacy Compatibility Evidence

`testDogTitles.ts` deliberately covers all of the following:

- a prefix-only Champion-of-record dog where `titleProgress.currentTitleCode` is null;
- a progress-only Champion-of-record dog where the prefix is null;
- a suffix-only compatibility case where both preferred sources are absent.

The initial Dog schema includes visible title fields, and migrations/backfills preserve or populate display fields. Repository evidence does not prove every existing Dog has a title-progress row or that legacy/imported data cannot rely on the display mirror. No repair path establishes a safe universal replacement of prefix reads with title-progress reads.

Therefore, the mirror fallback must remain wherever the existing helper or production workflow already relies on it.

## Current versus Historical Presentation

ADR-0002 protects existing event-time facts and ADR-0004 protects dog/title history. `ShowResult` and `ShowAward` do not persist an event-time title prefix/code. Historical show/result surfaces therefore retain their current behavior: award/result facts are historical, while joined Dog names may render the dog’s current prefix. This contract creates no historical title inference or snapshot.

## Canonical Read Contract

| Proposed contract statement | Finding | Evidence |
| --- | --- | --- |
| `DogTitleProgress.currentTitleCode` is semantic current-title authority. | SUPPORTED | Current profile/progress readers and title/GCH services use it as the maintained projection. |
| `Dog.visibleTitlePrefix` is a synchronized presentation mirror. | SUPPORTED | CH and GCH transition writers assign the same computed code in their transactions. |
| The mirror remains a compatibility fallback where progress is absent/incomplete. | SUPPORTED | `isChampionOfRecordDog`, GCH promotion fallback, and prefix-only test coverage. |
| Presentation code must not independently infer CH/GCH from awards/points. | SUPPORTED | Surveyed name surfaces read the mirror; semantic current-title surfaces read progress; no player presentation recomputes from history. |

The documented precedence is intentionally context-specific:

1. **Current semantic title/progress:** use `DogTitleProgress.currentTitleCode`.
2. **Current dog-name prefix presentation:** use `Dog.visibleTitlePrefix` through `formatDogDisplayName`.
3. **Champion-of-record compatibility decisions:** use the existing `isChampionOfRecordDog` helper, whose semantic projection is preferred and whose prefix/suffix checks preserve legacy representations.
4. **GCH reconciliation:** use `currentTitleCode ?? valid visibleTitlePrefix`, as currently implemented.

There is no evidence for replacing all name presentation with title-progress or for collapsing eligibility compatibility into display formatting.

## Minimal Canonicalization Gate

**NOT PASSED.**

- At least two materially different fallback orders exist, but they answer different questions: semantic status, legacy eligibility, reconciliation, and rendered dog identity.
- The desired semantic precedence is established, but direct Dog-prefix name rendering is an intentional presentation contract rather than a duplicate fallback implementation.
- Legacy compatibility is positively evidenced by tests and cannot be removed safely.
- A new helper would either alter wide existing Dog-name call shapes or conflate semantic status with presentation; neither is a minimal change.
- Prefix-only code changes would risk historical/current-name presentation and compatibility without eliminating a proven duplicate current-title question.

## Remaining Questions and Next Smallest Stage

- Decide, separately, whether legacy/imported prefix-only records require an explicit data-quality/reconciliation policy before any reader consolidation.
- Decide, separately, whether historical show pages should continue presenting current Dog names or later gain a deliberately scoped event-time title snapshot.
- Keep completion-metadata authority and producer suffix/merit outside this prefix contract.

The next smallest safe stage is a read-only inventory of actual legacy/import pathways or an explicit product decision on historical current-name presentation—not a broad prefix-reader rewrite.
