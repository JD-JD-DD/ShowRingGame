# ShowRingGame TO DO

This file is the short working queue. Use `docs/DRIFT_AUDIT.md` for the reasoning, evidence, and decisions behind these items.

## Current Focus

### 1. Check Breeding Eligibility

Status: audited; implementation pass needed

- Audit result: server-side creation mostly works, but eligibility is duplicated across rules, service, breed page, dog page, and kennel roster.
- Current server create path blocks:
  - wrong owner
  - same dog
  - same sex
  - different breed
  - too young
  - female over current max age
  - pending pregnancy check
  - pregnant
  - not alive
- Current gaps:
  - dog page can show the breed button for a bitch with an active pending/pregnant attempt because it only checks age/alive/ownership
  - post-whelp cooldown is not enforced
  - post-whelp cooldown countdown is not shown
  - male age-out does not exist yet
  - female cutoff differs from the MasterFile (`2555` in code vs `2520` in MasterFile)
  - `FOREVER_HOME` does not exist yet
- Next implementation pass:
  - create or centralize one breeding eligibility helper for service/API/UI
  - update dog page eligibility display to use active breeding state
  - implement post-whelp cooldown by deriving from latest whelped attempt or persisting `whelpingCooldownUntil`
  - keep `CHECKED_NOT_PREGNANT` immediately breedable if otherwise eligible
- Implemented first pass:
  - when a player clicks `Breed Dog` from a dog page, the breed page now honors `/breed?dogId=...`
  - the clicked dog is pinned at the top/side as the selected dog
  - eligible same-breed opposite-sex mates are shown
  - ineligible dogs are hidden from the mate list
  - visible trait/category sliders appear on the selected dog and mate cards

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

Status: todo, no behavior change yet

- Use current rule unless superseded: `WHELPING_COOLDOWN_HOURS = 270`.
- Persist or derive the bitch's post-whelp cooldown.
- Show countdown until breeding eligibility returns.
- Do not apply cooldown after `CHECKED_NOT_PREGNANT`.

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
  - make the `Breed Dog` button use the same eligibility logic as the breeding service
  - disable or hide breeding when the dog is pending, pregnant, post-whelp cooldown, senior, retired, deceased, or forever-homed
  - make deceased/forever-home dog pages historical-only with no gameplay actions
- Breed page from dog page:
  - first pass implemented: `/breed?dogId=...` is honored, the clicked dog is pinned/preselected, only eligible same-breed opposite-sex mates are listed, and trait sliders are shown
  - later pass: make this use the final shared eligibility helper once post-whelp cooldown, senior male age-out, retired, deceased, and forever-home states are centralized
- Kennel page:
  - keep the main roster as active usable dogs
  - add retirement couch view later
  - add memorium view later
  - replace local breedable/show filters with shared eligibility DTOs when helpers are centralized
- Actions and placement:
  - rename or replace `Re-Home Dog` with final `Forever Home` behavior
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

### 7. Show Entry and Judging Flow

Status: audited; mostly greenfield implementation

- Broad roadmap: `docs/SHOW_IMPLEMENTATION_PLAN.md`
- Current state:
  - show schema exists for judges, clusters, show days, entries, results, and title progress
  - judge and judging rules engines exist
  - entry quote/travel economy engine exists
  - `/shows` pages currently render nothing
  - show API routes are placeholders
  - show service and mapper files are empty
- First implementation pass:
  - build read-only `/shows` list for open/upcoming clusters
  - build show detail/entry planner page
  - make dog page `Enter Show` route to the planner with optional `/shows?dogId=...` preselection
  - add eligible dog filtering for show entries
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
  - seed or generate sample clusters and judges
  - implement simple breed-level judging persistence
  - add results page and permanent show history
  - add CH point progression after results are reliable
- Later show-side systems:
  - Winners Dog / Winners Bitch
  - Best of Winners
  - Best of Breed / Best of Opposite
  - majors and unique kennel checks
  - GCH and higher title ladders
  - breed essential rules
  - group/BIS layers
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
