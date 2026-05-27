# ShowRingGame TO DO

This file is the short working queue. Use `docs/DRIFT_AUDIT.md` for the reasoning, evidence, and decisions behind these items.

## Current Focus

### 1. Check Breeding Eligibility

Status: first pass implemented; central helper/tests still needed

- Current server create path blocks:
  - wrong owner
  - same dog
  - same sex
  - different breed
  - too young
  - female over current max age
  - pending pregnancy check
  - pregnant
  - post-whelp cooldown
  - not alive
- Remaining gaps:
  - male age-out does not exist yet
  - female cutoff differs from the MasterFile (`2555` in code vs `2520` in MasterFile)
  - `FOREVER_HOME` does not exist yet
  - eligibility logic is still duplicated across rules, service, breed page, dog page, and kennel roster
- Next implementation pass:
  - create or centralize one breeding eligibility helper for service/API/UI
  - add focused checks for active pregnancy, did-not-take, cooldown, age-out, retired, deceased, and future forever-home cases
- Implemented first pass:
  - when a player clicks `Breed Dog` from a dog page, the breed page now honors `/breed?dogId=...`
  - the clicked dog is pinned at the top/side as the selected dog
  - eligible same-breed opposite-sex mates are shown
  - ineligible dogs are hidden from the mate list
  - visible trait/category sliders appear on the selected dog and mate cards
  - breeding creation now charges the flat breeding fee server-side and records a ledger transaction
  - post-whelp cooldown is now derived from the latest whelped attempt in the breed page, dog page, kennel roster, and server create path
  - female max breeding age is enforced on the server create path and the current breeding UI paths

Original audit checklist:

- Verify breeding eligibility works consistently across:
  - rules helpers
  - breeding service
  - breed page
  - dog page
  - kennel roster
- Confirm bitches are blocked when:
  - too young
  - too old
  - currently pending pregnancy check
  - pregnant
  - in post-whelp cooldown
  - retired
  - deceased
  - forever-homed
- Confirm bitches are immediately breedable after a `CHECKED_NOT_PREGNANT` result if otherwise eligible.
- Confirm dogs and bitches can eventually have different breeding age-out thresholds.
- Decide exact senior/breeding cutoff thresholds.
- Add tests or focused checks before changing behavior.

### 2. Death Risk and Deceased Stage

Status: audited; implementation pass needed

- Define the senior/death-risk age threshold.
- Decide the mortality curve; MasterFile only says daily death probability increases gradually.
- Implement death-risk engine or service.
- Prefer deterministic daily checks keyed by dog/day so the same day is not rerolled repeatedly.
- Decide how often death risk is processed:
  - lazy page-load resolution
  - scheduled game tick
  - hybrid
- Ensure death risk is hidden from users.
- On death:
  - set dog as deceased
  - record death epoch
  - set market state to not for sale
  - close/cancel active listings
  - remove dog from active kennel pages
  - remove all show/breeding/market functionality
  - preserve dog page as historical only
  - show dog in memorium section
- Add death-during-pregnancy handling before death processing can affect pregnant dams:
  - if dam dies while pending/pregnant, close attempt and prevent litter creation
  - decide sire-death behavior during pregnancy
- Add death-during-show-entry handling when show entries are implemented.
- Split lifecycle helpers before or during implementation:
  - dog age stage
  - death risk
  - show entry class
  - breeding eligibility
- Decide whether forever-home dogs continue aging/death-processing or become static historical records.
- Retired dogs should continue aging and eventually become deceased.

### 3. Post-Whelp Cooldown

Status: first pass implemented; polish/testing needed

- Use current rule unless superseded: `WHELPING_COOLDOWN_HOURS = 270`.
- Done: derive the bitch's post-whelp cooldown from the latest `WHELPED` attempt.
- Done: block breeding creation while cooldown is active.
- Done: keep `CHECKED_NOT_PREGNANT` immediately breedable if otherwise eligible.
- Done: show a kennel roster countdown while cooldown is active.
- Next: add focused tests for active pregnancy, did-not-take, cooldown, and age-out cases.

### 4. Breeding and Litter Follow-Ups

Status: audited; implementation later

- Keep lazy pregnancy/whelping resolution for now, but make sure every pregnancy/litter UI route calls the resolver before display.
- Add retry handling for rare litter `serial7` collisions.
- Litter size distribution is now in the rules package.
- Add puppy naming from the litter detail page.
- Add puppy sale/listing/pricing after market pricing strategy is decided.
- Add forever-home flow only after `FOREVER_HOME` status/placement semantics are implemented.
- Decide pregnant dog sale/transfer policy before pregnant transfers are allowed:
  - current code assigns puppies to the breeding creator
  - MasterFile says pregnancy remains attached to the dog
  - policy needs to decide whether puppies follow the dam's current owner or the original breeding creator
  - make sure puppies from a sold/transferred pregnant bitch end up in the correct kennel
- Litter size generation:
  - implemented range is 2-14 puppies
  - distribution centers heavily on 8 puppies:
    - 70% at 8
    - 10% at +/- 1
    - 7.5% at +/- 2
    - 5% at +/- 3
    - 4% at +/- 4
    - 2.5% at +/- 5
    - 1% at +/- 6
  - tune later if gameplay testing suggests a different feel
- Add death-during-pregnancy handling when death risk/deceased logic is implemented.

### 5. Kennel/Dog Page UI and Actions

Status: audited; implementation pass needed

- Dog page:
  - remove or replace raw user-facing `ALIVE`/`Lifecycle` display for normal active dogs
  - show pregnancy state, pregnancy check countdown, or due countdown when applicable
  - done: make the `Breed Dog` button account for pending, pregnant, post-whelp cooldown, age, alive state, and ownership
  - disable or hide breeding when the dog is senior, retired, deceased, or forever-homed once those final statuses are centralized
  - done: list direct progeny on sire and dam pages with clickable dog links
  - make deceased/forever-home dog pages historical-only with no gameplay actions
- Breed page from dog page:
  - first pass implemented: `/breed?dogId=...` is honored, the clicked dog is pinned/preselected, only eligible same-breed opposite-sex mates are listed, and trait sliders are shown
  - later pass: make this use the final shared eligibility helper once post-whelp cooldown, senior male age-out, retired, deceased, and forever-home states are centralized
- Kennel page:
  - keep the main roster as active usable dogs
  - add retirement couch view later
  - add memorium view later
  - replace local breedable/show filters with shared eligibility DTOs when helpers are centralized
  - done: widen the kennel roster filter controls so long breed names are easier to read
- Global kennel header/status bar:
  - design a persistent top summary bar that can include kennel name, total active dogs, pregnant dogs, ledger balance, and UTC time
  - decide whether any other kennel-health signals belong there before replacing the simple standalone UTC clock
- Public kennel profiles:
  - make kennel/user names on the bulletin board clickable
  - add a public kennel page that shows that kennel's dogs
  - highlight that kennel's dogs currently at stud and dogs currently for sale
- Actions and placement:
  - rename or replace `Re-Home Dog` with final `Forever Home` behavior
  - done: add a confirmation step to the current `Re-Home Dog` action that clearly says this cannot be undone
  - reserve transferred/sold for ownership changes to another kennel
  - add a retire action after retirement couch semantics are implemented

### 6. Player Dog Market and Sales

Status: todo; strategy/design needed before implementation

- Build market support for player-owned dog listings, not just foundation dogs.
- Let users list eligible owned dogs for sale from the dog page or kennel page.
- Market should show both:
  - foundation/system dogs
  - player-listed dogs
- Player selling flow needs decisions:
  - asking-price freedom vs suggested-price guardrails
  - listing fee, expiry, and relisting rules
  - whether stale failed listings affect market guidance
  - how dog quality, breed scarcity, sex, age, titles, show results, fertility, and recent sales affect suggested price
  - how foundation pricing avoids undercutting player listings too aggressively
- Sale transaction behavior:
  - transfer `ownerKennelId` to buyer
  - record ledger transactions for buyer and seller
  - mark listing sold
  - update dog `marketState`
  - preserve dog page, pedigree, litter links, and historical data
- Eligibility/policy blockers:
  - block or decide sale behavior for pregnant bitches before allowing pregnant sales
  - block deceased, retired, and forever-home dogs
  - decide whether post-sale dogs remain visible to previous owner through litter/pedigree/history only
- Puppy sales should use the same listing foundation once puppy naming and sale age rules are ready.
- Add a stud dog market/page:
  - done: build a dedicated stud dog page for browsing public stud listings
  - users can offer eligible male dogs for public stud service
  - owner sets a whole-dollar stud fee
  - other players can browse available studs by breed
  - breeding flow can select a public stud and charge the buyer/pay the stud owner
  - enforce male ownership, breed compatibility, age/breeding eligibility, retired/deceased/forever-home exclusions, and any future per-dog breeding cooldown or use limits
  - record `STUD_FEE_IN` and `STUD_FEE_OUT` ledger transactions
  - decide whether stud listings use `DogListing`, a separate `StudListing`, or a breeding-contract model before implementation
  - first UI target:
    - dog page action: `Available for Stud`
    - owner enters a whole-dollar stud fee
    - bitch breed page keeps owned eligible males first, with a secondary `See Available Studs` action
    - public studs list only same-breed eligible males from other kennels
    - creating the breeding charges the bitch owner and pays the stud owner

### 7. Show Entry and Judging Flow

Status: active implementation

- Broad roadmap: `docs/SHOW_IMPLEMENTATION_PLAN.md`
- Current state:
  - show schema exists for judges, clusters, show days, judging blocks, entries, results, awards, and title progress
  - judge, judging, economy, and show-calendar helper engines exist
  - `/shows`, `/shows/[showId]`, and results pages are implemented for first-pass test shows
  - players can enter eligible dogs and pay the `$25` entry fee
  - manual judging endpoints still exist for backend/admin use, but the visible `Run Judging` button has been removed
- First implementation pass:
  - build the judging spine before the calendar/entry wrapper
  - done: core rules produce base score, final score, controlled variance, tie-breaks, final rank, and placement code
  - done: breed-level judging for all entries under one judge
  - done: `ShowJudgingBlock` schema/migration supports ring, judge, breed, class type, start epoch, and block order
  - done: first-pass block persistence creates simple `ShowResult` rows from entered dogs
  - done: admin judging endpoint can publish one block by id
  - done: show-day judging endpoint now rolls through its blocks
  - done: judge panel seed path reads `docs/fulljudgepanel.csv`
  - done: seed path creates clusters, show days, and judging blocks from `docs/partialshowblock.csv`
  - done: read-only `/shows` list for seeded clusters
  - done: read-only `/shows/[showId]` detail page with day/block table
  - done: show entry service validates eligibility, creates entries, charges entry fee, records ledger transaction, and snapshots conditioning/fatigue
  - done: admin test route seeds entries through the real show entry service
  - done: `/shows/[showId]` lists eligible kennel dogs per judging block and submits real entries
  - done: `POST /api/shows/[showId]/enter` creates player show entries through the shared service
  - done: show entry fee is `$25`, the entry button says `Enter $25`, and entries debit the kennel ledger/balance
  - done: entry close timing is temporarily relaxed while show timing rules are still being designed
  - done: `/ledger` page shows recent kennel ledger transactions
  - done: a global UTC clock appears in the upper right of app pages
  - done: rules helper generates deterministic show clusters from MasterFile calendar rules:
    - 3 clusters per week
    - 75% 2-day and 25% 4-day cluster pattern
    - 15-district rotation with every district hosting every 5 weeks
    - annual event hour excluded
    - 120-hour generation horizon
    - 14-hour future entry close offset
  - done: `docs/showClusterCalendar.csv` provides a year-agnostic annual show-cluster calendar template:
    - 52 game weeks per game year
    - 156 show clusters per game year
    - the same cluster weeks, districts, and day patterns repeat every game year
  - done: show calendar generation now uses week-in-year for cluster type and district rotation so the schedule does not drift between game years
  - later: decide the actual entry close timing and re-enable entry window enforcement
  - next: enforce that a dog can only be entered in one district per show cluster/weekend, so the same dog cannot be entered in District 11 and District 10 during the same weekend
  - next: wire the cluster generator/calendar template into a persistence/service path that creates real upcoming clusters
  - next: implement lazy automatic judging when block start epochs pass
  - done: first-pass CH title progression recalculates from `ShowAward` points after judging
  - done: first-pass title application sets `visibleTitlePrefix = "CH"` once a dog has 15 points and 2 majors
  - next: parse/use the real point schedule instead of the temporary all-breed points rule
  - next: show title progress on dog pages and/or a show record page
  - next: add one central all-show-results page where users can browse recent/past results across shows
  - next: apply visible title prefixes/suffixes consistently anywhere dog names are rendered
  - next: preserve the entering kennel on show entries/results so a later ownership change does not rewrite historical result kennel names
  - next: remove raw epoch time from the show listing page and use player-facing date/time display
  - refine show detail/entry planner page with quote summaries and stronger entry feedback
  - then make dog page `Enter Show` route to the planner with optional `/shows?dogId=...` preselection
  - then add eligible dog filtering for show entries
  - add explicit show helpers:
    - `canEnterShow()`
    - `getShowEntryClass()`
    - `getShowEligibilityReason()`
  - decide puppy/open/veteran class age ranges before class placement is implemented
  - wire `getClusterEntryQuote()` into the entry planner
  - implement submit-entry service:
    - ownership check
    - alive/retired/deceased/forever-home placement check
    - show age check
    - duplicate same-day entry check
    - entry-lock/deadline check
    - affordability check
    - ledger transactions for entry/travel/handler fees
  - generate sample clusters and judges from the generator instead of hand-maintained CSV rows
  - expand permanent show history
- Later show-side systems:
  - Winners Dog / Winners Bitch
  - Best of Winners
  - Best of Breed / Best of Opposite
  - majors and unique kennel checks
  - GCH and higher title ladders
  - breed essential rules
  - group wins and Best in Show wins
  - group/BIS layers, including result pages and dog-page/show-history display
  - conditioning/fatigue effects
  - market/prestige effects from show wins

## Lifecycle/Status Model

- Keep show entry class separate from dog age stage.
- Show entry classes are for the show-entry engine:
  - puppy
  - open/adult
  - veteran
- Dog age stages are for breeding/show eligibility, death risk, and death:
  - puppy: cannot breed
  - adult: can breed if otherwise eligible
  - senior: cannot breed and enters death-risk logic
- Alive/deceased describes whether the dog is an active game object or historical/memorium record.
- Retirement couch is user-chosen and should disable functionality while keeping the dog in the kennel.
- Forever home removes the dog from active play permanently.
- Sold/transferred means ownership changes to another kennel.

## Later

- Keep foundation market stocked with both sexes:
  - at least 2 active foundation females per breed
  - at least 1 active foundation male per breed
  - dense breed base target is 2, but sex floors make the effective minimum 3 when needed
- Replace user-facing `ALIVE`/`Lifecycle` text with better age/placement/status UI.
- Add retirement couch view.
- Add memorium view.
- Add forever-home state/flow.
- Reserve transferred/sold for real ownership changes.
- Add dog-page pregnancy status and due date.
- Add pregnancy notification or dashboard summary if kennel roster status is not enough.
