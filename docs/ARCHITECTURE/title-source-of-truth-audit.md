# Dog Title Source-of-Truth Audit

## 1. Purpose

This read-only investigation resolves the evidence needed for ARCH-DEBT-004 before any title cleanup. Current repository code is the implementation authority; no title, award, credit, Dog, schema, or test behavior was changed.

## 2. Title-State Concepts

| Concept | Meaning in the current implementation |
| --- | --- |
| CH current state | A maintained current projection in `DogTitleProgress.currentTitleCode`, calculated from Championship `ShowAward` history. |
| GCH current state | A maintained current projection in `DogTitleProgress.currentTitleCode`, calculated from `DogGrandChampionCredit` history and CH eligibility. |
| CH/GCH progress | `DogTitleProgress` totals and completion metadata. |
| Historical awards | `ShowAward` (and the related `ShowResult`) record published event facts. |
| Historical GCH credits | `DogGrandChampionCredit` persists qualifying GCH facts/provenance per award. |
| Producer merit | A separate parent-of-current-champion calculation, stored on `Dog` and maintained by `producerMerit.service`. |
| Prestige | Separate per-show credits and yearly rollups; it reads title state for competition treatment but does not determine a title. |
| Presentation fields | `Dog.visibleTitlePrefix` and `Dog.visibleTitleSuffix` are name-display fields; the suffix also carries producer-merit text. |

## 3. Persistence Inventory

| Field/model | Purpose | Current/historical | Classification | Writer | Significant reader | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| `DogTitleProgress.championshipPoints`, `majorCount`, `winsByTypeJson` | Current CH progress summary | Current | synchronized current-state projection, derivable from `ShowAward` | `recalculateDogTitleProgress` | dog profile, Ribbon Room, planners | High |
| `DogTitleProgress.currentTitleCode` | Current highest conformation title | Current | synchronized current-state projection, derivable from CH awards/GCH credits | title-progress recalculation and GCH promotion | dog profile, GCH/Prestige logic, producer merit | High |
| `DogTitleProgress.grandPoints`, `grandMajorCount`, `grandChampionDefeatShowCount` | Current GCH progress summary | Current | synchronized current-state projection, derivable from GCH credits | GCH credit processing | dog profile, Ribbon Room, Prestige | High |
| `DogTitleProgress.grandCompletedAtShowDayId`, `grandCompletedAtEpoch` | first recorded GCH completion | Current completion metadata | current-state completion record; derivation from credit history was not proven exhaustively | GCH promotion | dog profile | Medium |
| `Dog.visibleTitlePrefix` | Current title in dog-name presentation | Current | denormalized presentation mirror of `currentTitleCode` | CH recalculation; GCH promotion | most cards, roster, market/stud, pedigree, results | High |
| `Dog.visibleTitleSuffix` | Name suffix, including producer-merit suffix | Current | denormalized presentation field; not a title-progress authority | producer-merit recalculation; legacy migration | dog-name readers | High |
| `Dog.championOffspringCount`, `producerMeritLevel`, `producerMeritSuffix`, `producerMeritLabel` | Parent producer-merit summary | Current | synchronized derived summary | producer-merit recalculation | Dog profile/badges and suffix composition | High |
| `ShowResult` | Published result/scoring fact | Historical | historical snapshot | judging finalization | result/history/Ribbon Room | High |
| `ShowAward` | Published award, CH point and major fact | Historical | historical award truth | judging finalization | title recalculation; result/history/Ribbon Room | High |
| `DogGrandChampionCredit` | Persisted GCH qualification/provenance | Historical | historical credit truth | GCH credit processing | GCH recalculation; result/profile history | High |
| `DogShowPrestigeCredit` | Per-show prestige fact | Historical/derived per event | event credit | prestige refresh | yearly rollup | High |
| `DogYearlyPrestigeStat` | Per-year prestige rollup | Current yearly summary | synchronized rollup | prestige refresh | prestige/leaderboard consumers | High |
| annual Championship/GCH schedule publications | Versioned point thresholds for an effective year/district/breed/sex | Historical/versioned rule input | authoritative schedule publication, not title state | annual schedule services | judging/GCH calculations | High |

No event-time CH/GCH title string snapshot was found on `ShowResult` or `ShowAward`.

## 4. Writer Inventory

| Location/function | Field/model written | Trigger and source inputs | Transaction boundary / callers | Purpose/classification | Confidence |
| --- | --- | --- | --- | --- | --- |
| `judging.service.ts` / breed-block finalization | `ShowResult`, `ShowAward`, then CH progress | judged block outcomes and point schedule | one interactive breed-block transaction | production historical facts, then current CH reconciliation | High |
| `titleProgress.service.ts` / `recalculateDogTitleProgress` | CH fields and `currentTitleCode`; `Dog.visibleTitlePrefix` | all positive-point `ShowAward` rows, grouped by show day | caller passes judging transaction | canonical CH calculation plus display synchronization | High |
| `grandChampion.service.ts` / `processGrandChampionCreditsForShowDay` | `DogGrandChampionCredit`; GCH progress totals | finalized awards/results, eligibility, schedule and competition snapshot | called after day finalization; accepts transaction but normal caller uses service client | canonical GCH historical-credit calculation and progress synchronization | High |
| `titleProgress.service.ts` / `promoteGrandChampionTitleForDog` | `currentTitleCode`, completion metadata, `visibleTitlePrefix`, title notice | durable GCH credit qualification plus existing progress | one transaction per promotion in judging finalization | atomic current GCH/display reconciliation | High |
| `producerMerit.service.ts` / `recalculateProducerMeritForDog` | producer fields and merit segment of `visibleTitleSuffix` | count of offspring whose `DogTitleProgress.currentTitleCode` is Champion-of-record | receives the CH recalculation transaction; invoked when offspring newly becomes CH | separate producer-merit summary synchronization | High |
| `prestige.service.ts` / `refreshPrestigeStatsForShowDay` | prestige credits and yearly stats | finalized awards/entries; title state used for competition grouping | caller-provided transaction | separate prestige history/rollup | High |
| producer-merit migration | producer fields and suffix backfill | historical `DogTitleProgress` join | migration only | legacy/backfill, not production authority | High |

`KennelNotice` writes are downstream of CH/GCH/producer completion decisions and are idempotent by title source key; they do not determine current title state.

## 5. Reader Inventory

| Surface | Reads | Need |
| --- | --- | --- |
| Dog profile and DogProfileDashboard | Dog prefix/suffix plus `DogTitleProgress`; published awards/results; stored producer summary | current title/progress and historical achievement |
| Public dog, kennel roster/cards, program planner, market, stud discovery, pedigree/litter views | primarily Dog prefix/suffix; some profile-derived title summaries also read progress | current presentation |
| Show results, show history, My Results, Ribbon Room | historical `ShowResult`/`ShowAward` and credit facts, but dog-name joins read current prefix/suffix | historical achievement plus current-name presentation |
| GCH processing, Prestige, entry/planner eligibility | `DogTitleProgress.currentTitleCode`, with selected legacy/fallback reads of prefix | current title for rules/segmentation |
| Producer merit display/badges | stored producer summary, re-derived for profile from stored count | current producer presentation |
| Notices | completion decision and computed display name at write time | historical completion notification |
| Invitational/top-ten displays | awards/prestige facts plus current Dog presentation fields | historical placement plus current-name presentation |

No surveyed player surface independently recalculates CH from awards or GCH from credits. Some business readers use `visibleTitlePrefix` as a compatibility/fallback signal, notably GCH promotion and title-related eligibility; this makes the display mirror operationally relevant despite its derivation.

## 6. CH Authority Chain

`ShowResult` / `ShowAward` published in breed-block finalization → `recalculateDogTitleProgress` reads every positive-point award for the dog → grouped best award per show day yields points and majors → `DogTitleProgress` upsert writes progress and `currentTitleCode` (`CH` at 15 points and 2 majors) → the same transaction updates `Dog.visibleTitlePrefix` → a first-CH transition recalculates parent producer merit and creates an idempotent notice.

The durable evidence for CH is the historical `ShowAward` set; the record used by normal current-state readers is `DogTitleProgress`. Current CH can be reconstructed from persisted awards under the current summarization rule, but no rebuild was run. A display prefix can diverge if a noncanonical writer or an incomplete legacy state bypasses the synchronizing path; normal CH finalization updates both atomically.

## 7. GCH Authority Chain

Finalized qualifying `ShowAward`/`ShowResult` facts → `processGrandChampionCreditsForShowDay` computes and persists `DogGrandChampionCredit` rows with schedule/provenance → the same processing derives GCH totals into `DogTitleProgress` → each candidate is revalidated in its own transaction by `promoteGrandChampionTitleForDog` → that transaction writes `currentTitleCode`, completion metadata, and `visibleTitlePrefix`, then writes an idempotent notice.

`DogGrandChampionCredit` is the historical qualification evidence; `DogTitleProgress` is the current GCH projection; Dog prefix is its display mirror. `DogTitleProgress` progress is recalculable from credits, while the first-completion metadata’s exact reconstruction semantics remain less explicit.

## 8. Producer Merit Authority

Producer merit is not CH/GCH title authority. It counts a parent’s offspring whose `DogTitleProgress.currentTitleCode` is in the Champion-of-record code set, applies sex-specific tiers, and synchronizes the resulting count, level, label, suffix, and composed Dog suffix. It is invoked when an offspring first becomes CH, in that same title-recalculation transaction. The source relation and offspring current-title projection can determine it; the Dog producer fields are maintained summaries. No normal batch refresh or repair path was found beyond the introducing migration, so completeness for pre-existing inconsistent records is not independently proven.

## 9. Current vs Historical Presentation

ADR-0002 preserves existing event-time snapshots, and ADR-0004 preserves dog/history across migrations. Results and awards preserve event facts, but neither `ShowResult` nor `ShowAward` has a title-prefix/title-code snapshot. Therefore historical result, Ribbon Room, and pedigree-adjacent name joins generally display the dog’s current Dog title fields today, while award/credit amounts and placements remain historical facts. This audit records the absence; it does not propose a new snapshot.

## 10. Dog Field Cache Analysis

| Dog field | Can be derived? | Synchronization writer | Reader dependency | Classification | Confidence |
| --- | --- | --- | --- | --- | --- |
| `visibleTitlePrefix` | Yes, from maintained title progress; CH/GCH progress itself from award/credit history | CH recalculation and GCH promotion | direct player name presentation; limited rule fallbacks | denormalized presentation mirror | High |
| `visibleTitleSuffix` | Only producer-merit segment is derivable; other segments are retained | producer-merit recalculation | direct player name presentation | denormalized presentation field | High |
| `championOffspringCount` | Yes, parentage plus offspring current-title projection | producer-merit recalculation | producer merit and profile | synchronized derived summary | High |
| `producerMeritLevel`, `producerMeritSuffix`, `producerMeritLabel` | Yes, from count, sex, tier rules | producer-merit recalculation | profile/badges/name suffix | synchronized derived summary | High |

The cache test is met for the normal title paths: a recognized writer exists and CH/GCH state changes write progress and prefix within their relevant transactions. It is not evidence that every legacy/import path has been repaired, and no universal title rebuild function was found.

## 11. Repair / Legacy Paths

The producer-merit introduction migration backfilled Dog fields from parentage and `DogTitleProgress`; it is a one-time legacy path. Duplicate-breed migration verification only reads visible title fields. The Year 13 regular-show repair and its test did not establish a normal title writer in the inspected title references. These paths do not define production authority.

## 12. Regression Coverage

| Test | What it protects | Cross-store synchronization covered? |
| --- | --- | --- |
| `testDogTitles.ts`, `testDogShowRecordTitlePoints.ts` | CH thresholds and title/result presentation | partial; current progress/display coverage, not universal rebuild |
| `testDogTitleNotices.ts` | CH/GCH title notice source keys/content | notice transition behavior |
| `testGrandChampionCredits.ts`, `testGrandChampionIntegration.ts`, `testGrandChampionPromotion.ts`, `testGrandChampionPromotionFiltering.ts` | credit calculation, promotion qualification, progress/prefix reconciliation decisions | substantial GCH-path coverage |
| `testGrandChampionHistoricalImmutability.ts` | finalized GCH credit historical behavior | historical-credit protection |
| `testDogProgenyTitleEarnedNotice.ts` | producer tiers, Dog summary/suffix composition, notices | producer summary synchronization |
| `testRibbonRoomReadModel.ts`, `testMyResultsHierarchy.ts` | historical result/award/credit read models | historical read behavior, not title-at-event snapshot |
| `testKennelPrestige.ts`, `testPrestigeBatching.ts` | Prestige qualification/rollup behavior | separate from title-display synchronization |

## 13. Confirmed Invariants

- `ShowAward` is the durable historical CH award/point/major evidence.
- `DogGrandChampionCredit` is the durable historical GCH qualification evidence with award linkage/provenance.
- `DogTitleProgress` is the maintained current-state projection consumed by current profile, eligibility, and progression logic.
- Normal CH finalization writes award history, CH progress, and prefix in one transaction.
- Normal GCH promotion writes progress, prefix, completion metadata, and notice in one transaction after durable credit processing.
- Producer merit is a separately maintained parent summary based on offspring `DogTitleProgress`, not a competing title authority.
- Prestige credits/rollups are separate from title authority.

## 14. Unresolved Questions

- Is `grandCompletedAtShowDayId`/`grandCompletedAtEpoch` intended as immutable historical completion truth or merely first-completion metadata? The code maintains it but no explicit rebuild contract was found.
- How should existing records be reconciled if a legacy/import path left prefix, progress, or producer summaries inconsistent? No production repair/rebuild authority was identified.
- Should compatibility readers continue treating `visibleTitlePrefix` as a title-state fallback after all records are known synchronized? This is a design/cleanup question, not answered by the present behavior.
- Historical result pages have no event-time title snapshot; whether their current-title display is the intended player promise remains an explicit product question.

## 15. ARCH-DEBT-004 Recommendation

**B. PARTIAL CANONICALIZATION POSSIBLE.** The authority model is now sufficiently established to narrow future work: historical awards/credits are durable evidence; `DogTitleProgress` is the maintained current projection; Dog prefix/suffix and producer fields are presentation/derived summaries. However, prefix fallback readers, completion-metadata reconstruction, and historical-page current-title behavior require scoped decisions before any broad removal or consolidation of fields.

### Explicit Answers

1. A dog’s normal current Champion status is determined by `DogTitleProgress.currentTitleCode`, maintained from `ShowAward` history; awards are the durable reconstructable proof.
2. A dog’s normal current Grand Champion status is determined by `DogTitleProgress.currentTitleCode`, maintained from `DogGrandChampionCredit` history and Champion eligibility; credits are the durable proof.
3. `currentTitleCode` is a synchronized, authoritative-for-current-read-model projection, not the irreducible historical source.
4. Dog visible prefix/suffix fields are denormalized presentation fields; prefix mirrors the current conformation title and suffix additionally carries producer-merit presentation.
5. CH/GCH current display can be reconstructed from title/history records under current rules, except exact suffix composition and first-GCH completion metadata are not fully reconstructable/proven from this audit alone.
6. Producer merit is a separate authority chain derived from parentage and offspring current title projections.
7. CH finalization updates awards, progress, and prefix atomically; GCH promotion updates progress and prefix atomically after credits are persisted/processed. The broader cross-service GCH credit-processing-to-promotion sequence is not one single all-day transaction.
8. Normal same-transaction writers roll back together, but a failure between separate GCH credit processing and later promotion can leave current display/progress awaiting reconciliation; legacy/import divergence is also possible.
9. Title notices are emitted from transition/completion decisions and saved as historical notices; they are not derived later from current Dog fields.
10. No surveyed player surface independently infers CH/GCH from award/credit history; many directly read Dog display fields, and current-state services read `DogTitleProgress` with limited prefix fallbacks.
