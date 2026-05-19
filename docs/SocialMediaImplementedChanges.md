Implemented changes 05/19/2026

Absolutely. Here’s the implemented work so far in release-note language:

**Implemented Changes**
- Added pregnancy progression support for breeding attempts.
- Pregnancy checks now resolve after the intended game-time window.
- Pregnancy timing now has natural variation around the expected dates instead of always landing on one exact day.
- Kennel roster now shows breeding status at a glance:
  - pending pregnancy check
  - pregnant
  - due countdown
  - did not take
  - recently whelped
- Litters can now be created from successful pregnancies.
- Litter size generation was updated to a wider realistic range of 2-14 puppies, centered heavily around 8.
- Foundation market now maintains both sexes, including at least one male per breed.
- Foundation market behavior was adjusted so female availability remains strong while males are still present.
- Dog trait values now use the corrected 0-20 scale with 10 as ideal.
- Genetic variation/drift is constrained so trait values stay within the valid 0-20 range.
- Breed flow from a dog page now works properly.
- Clicking `Breed Dog` now opens the breeding page with that dog preselected.
- The selected dog stays pinned while choosing an eligible mate.
- The breeding page now shows only eligible, same-breed, opposite-sex mates for the selected dog.
- Ineligible dogs are hidden from that mate list.
- Breeding cards now show compact visible trait sliders.
- After confirming a breeding, the page shows confirmation and returns to the dog page.
- Dog profile names can now be created.
- Dog profile names are permanent once confirmed.
- A confirmation pop-up warns the user before saving a permanent dog name.
- Dog names now follow validation rules:
  - 45-character limit
  - standard English letters only
  - spaces, hyphens, and apostrophes allowed
  - no numbers
  - no title abbreviations
  - no show title terms
  - no dog-role words
  - no breed names
  - no banned/offensive words
  - must be unique
- Registered/profile names now replace the BG-style placeholder name once set.
- Dog names now display consistently across dog pages, kennel roster, breeding pages, litter pages, and breeding service messages.
- Added/updated audit documentation for lifecycle, breeding, litters, market behavior, death-risk planning, and dog/kennel UI decisions.
- Added a working `TO_DO.md` to track future implementation decisions and deferred systems.

**Planned But Not Yet Implemented**
- Post-whelp cooldown before a bitch can breed again.
- Death-risk engine and deceased dog handling.
- Memorium/memorial page.
- Retirement couch.
- Forever-home flow.
- Full shared breeding eligibility helper.
- Dog page pregnancy status and due date display.
- Player dog sale pricing strategy.
- Pregnant dog sale/transfer policy.
- Show entry class work: puppy, adult/open, veteran.