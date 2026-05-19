# Show Side Implementation Plan

This plan translates the show-side parts of `MasterFile4_3.md` into a broad build roadmap.

It is intentionally high-level. The purpose is to preserve the intended direction while letting implementation happen in small, testable passes.

## Design Goal

ShowRingGame should support two strong play styles:

- Breeder path: buy dogs, breed, produce litters, sell/place puppies, manage genetics.
- Show path: buy dogs, enter shows, campaign dogs, earn placements, points, titles, and kennel prestige.

The best long-term game loop should use both paths:

```txt
breed promising dogs
-> campaign them in shows
-> earn results and titles
-> increase reputation and market value
-> make better breeding and sales decisions
```

## Current Technical Starting Point

Already present:

- Prisma schema for:
  - judges
  - show clusters
  - show days
  - show entries
  - show results
  - dog title progress
- Rules engines for:
  - judge weights
  - judging category scoring
  - entry/travel/handler cost quotes
- Dog page placeholder action:
  - `Enter Show`

Mostly missing:

- `/shows` UI
- show listing API
- show detail API
- entry planner UI
- entry submission service
- ledger debit flow
- judging persistence
- results page
- show history
- title progression

## Phase 1: Show Calendar and Cluster List

Goal: make `/shows` exist as a useful read-only page.

Build:

- Show cluster seed/generation path.
- Read-only `/shows` page listing upcoming/open clusters.
- Basic cluster cards:
  - name
  - district
  - show dates/game times
  - entry open/close status
  - number of show days
  - assigned judges if known
- Empty state if no clusters exist.

Notes:

- This phase does not need dog entry yet.
- This gives players a visible show-side destination and confirms the calendar model.

## Phase 2: Show Detail and Entry Planner Shell

Goal: let players inspect one cluster and begin planning entries.

Build:

- `/shows/[showId]` page.
- Show-day list within a cluster.
- Eligible-dog panel.
- Optional dog preselection from dog page:
  - dog page `Enter Show` can route to `/shows?dogId=...` or a specific planner once selected.
- Display live planning sections:
  - selected dogs
  - selected show days
  - estimated fees
  - projected balance

Notes:

- This should mirror the improved breed flow: if the player starts from a dog page, the dog should feel carried into the next workflow.
- At first this can remain a planner without submit.

## Phase 3: Show Eligibility Helpers

Goal: centralize show-entry eligibility before real submission.

Build helper functions:

- `canEnterShow()`
- `getShowEntryClass()`
- `getShowEligibilityReason()`

Rules to cover:

- ownership
- alive/deceased state
- retired state
- forever-home state later
- show-age minimum
- show-age maximum
- entry lock/deadline
- one show per dog per day

Show classes to decide:

- puppy
- open/adult
- veteran

Important:

- Show class is separate from dog age stage.
- Veteran belongs to show-entry class eligibility.
- Senior/death risk belongs to lifecycle/death systems.

## Phase 4: Entry Quote and Affordability

Goal: make campaign planning financially meaningful.

Use existing rules engine:

- `getClusterEntryQuote()`

Show the player:

- entry fees
- travel cost
- handler cost
- total cost
- current balance
- projected balance after entry
- shortfall if unaffordable

Rules:

- entry fees are per dog per selected show day
- travel should count unique dogs traveling
- handler fee applies once threshold is met
- geography/district costs should matter

## Phase 5: Submit Entries

Goal: turn the planner into real persisted show entries.

Build service:

- validates eligibility
- validates affordability
- validates entry windows
- validates duplicate same-day entries
- creates `ShowEntry` rows
- creates ledger transactions
- updates kennel balance

Ledger transaction types:

- `SHOW_ENTRY_FEE`
- `TRAVEL_COST`
- `HANDLER_FEE`

Implementation note:

- Entry submission should be transactional.
- Either all selected entries and ledger debits succeed, or none do.

## Phase 6: Basic Judging Pass

Goal: make entered shows produce permanent results.

First version:

- judge one show day at a time
- load entered dogs
- group by breed
- score with assigned judge
- rank dogs by score
- persist `ShowResult`
- publish results

Use current engine:

- `rankDogsByJudgeWeights()`

MVP judging can skip:

- Winners Dog/Bitch
- BOW
- BOB/BOS
- group/BIS
- title points
- breed essential

This first judging pass is about proving the loop:

```txt
entry -> judging -> result page
```

## Phase 7: Results and Show History

Goal: make show results visible, permanent, and useful.

Build:

- `/shows/[showId]/results`
- show-day result tables
- breed result sections
- dog links
- judge display
- score/rank/placement display

Visibility:

- entries hidden before judging begins
- results visible permanently after publishing

History uses:

- dog page result history later
- kennel prestige later
- title progression later
- market value later

## Phase 8: AKC-Style Breed Competition

Goal: move from simple ranking to a real conformation show structure.

Add:

- sex-separated class judging
- class winners
- Winners Dog
- Winners Bitch
- Best of Winners
- Best of Breed
- Best of Opposite Sex

Rules:

- points determined by same-sex class competition
- BOW receives the higher point value, not combined points
- BOB point recalculation when WD/WB defeats champions
- BOS only counts same-sex champions where applicable

This is where show strategy starts to feel truly dog-show-like.

## Phase 9: Points and Champion Title Progression

Goal: make results matter beyond a single show.

Start with CH:

- 15 points
- 2 majors
- 3 different judges

Point table:

- 2 defeated -> 1 point
- 3-4 defeated -> 2 points
- 5-7 defeated -> 3 points
- 8-11 defeated -> 4 points
- 12+ defeated -> 5 points

Major rules:

- 3-5 point win
- major requires enough unique kennels once that rule is implemented

Update:

- `DogTitleProgress`
- `visibleTitlePrefix`
- dog pages
- show history

## Phase 10: Grand Champion and Advanced Titles

Goal: deepen long-term campaigning.

Add after CH is reliable:

- GCH
- GCH Bronze
- GCH Silver
- GCH Gold
- GCH Platinum

GCH starting rules:

- champion required
- 25 GCH points
- 3 majors
- 3 judges

Later:

- title ladders from `DogTitles.md`
- suffix titles if gameplay systems exist for them
- richer title history

## Phase 11: Conditioning, Fatigue, and Handling

Goal: make repeated showing a strategic choice.

Add:

- conditioning snapshots at entry
- fatigue snapshots at entry
- fatigue penalties during judging
- fatigue accrual after show results
- recovery/conditioning systems
- handler effects

Design:

- good dogs can still have bad days
- over-campaigning should have a cost
- conditioning should matter without overwhelming genetics

## Phase 12: Breed Essential and Judge Depth

Goal: add breed-specific and judge-specific nuance.

Breed essential:

- pass
- bonus
- penalty
- elimination
- disqualification

Judge depth:

- judge preference history
- regional trends
- judge reputation
- hidden/learnable tendencies

Important:

- This should come after basic judging is fun and understandable.
- Early opacity should be avoided; players need enough feedback to learn.

## Phase 13: Group, BIS, Rankings, and Prestige

Goal: make shows feel larger than breed-level competition.

Add:

- group placements
- Best in Show
- rankings
- kennel prestige effects
- dog reputation
- market value modifiers

Optional point bonuses:

- Group 4 -> +1
- Group 3 -> +2
- Group 2 -> +3
- Group 1 -> +4
- BIS -> +5

These are not majors.

## Integration With Breeding and Market

Once the show loop is stable, connect results to breeder-side gameplay:

- titled dogs increase puppy demand
- show results affect sale prices
- kennel reputation affects market trust
- buyers value proven parents
- campaign history becomes part of pedigree value

This integration should happen after both sides are individually playable.

## Recommended Immediate Build Slice

When ready to start show implementation, begin with:

1. Seed/generate a few upcoming show clusters.
2. Build `/shows` list page.
3. Build show detail page shell.
4. Show eligible dogs without submit.
5. Add quote preview.

This gives the show side a visible UI without risking ledger, title, or judging complexity too early.
