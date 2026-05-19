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
  - when a player clicks `Breed Dog` from a dog page, the breed page should:
    - pin the clicked dog at the top as the selected dog
    - show only eligible dogs of the same breed and opposite sex as possible mates
    - hide ineligible dogs from the mate list rather than showing every dog disabled
    - keep visible trait/category sliders on the selected dog and eligible mate cards
  - implement post-whelp cooldown by deriving from latest whelped attempt or persisting `whelpingCooldownUntil`
  - keep `CHECKED_NOT_PREGNANT` immediately breedable if otherwise eligible

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

Status: next design/code section

- Define the senior/death-risk age threshold.
- Implement death-risk engine or service.
- Decide how often death risk is processed.
- Ensure death risk is hidden from users.
- On death:
  - set dog as deceased
  - record death epoch
  - remove dog from active kennel pages
  - remove all show/breeding/market functionality
  - preserve dog page as historical only
  - show dog in memorium section
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

- Replace user-facing `ALIVE`/`Lifecycle` text with better age/placement/status UI.
- Add retirement couch view.
- Add memorium view.
- Add forever-home state/flow.
- Reserve transferred/sold for real ownership changes.
- Add dog-page pregnancy status and due date.
- Add pregnancy notification or dashboard summary if kennel roster status is not enough.
