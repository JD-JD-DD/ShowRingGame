## Breed Art Funding — Staged Implementation Plan

### Section A — Foundation and Funding Model

**Stage ART-01 — Existing PayPal + Architecture Audit**

Read-only. No changes.

Map the recently completed subscription-support implementation:

PayPal client/configuration, sandbox/live configuration, order/subscription APIs, webhook verification and routing, database models, idempotency handling, environment variables, support pages/components, and tests.

Also identify the canonical 318 active breeds and where breed group/name data comes from.

The purpose is specifically to determine **what the Breed Art Fund can safely reuse and what must remain separate**.

This is important because subscriptions and one-time contributions are different PayPal products even though authentication, webhook infrastructure, environment configuration, and utilities may be reusable.

**Stop and review the audit before ART-02.**

---

**Stage ART-02 — Funding Data Model**

Add the underlying campaign structure without payments or UI.

Conceptually:

`ArtCampaign`
`ArtContribution`
`ArtCommission/Artwork` or equivalent

The initial collection seeds one campaign for every active breed:

**Standard Breed Artwork — Beagle**
**Standard Breed Artwork — Saluki**
etc.

Each has:

$50 goal
10 funding units
$5 per unit
breed association
campaign type/collection
status

Player-facing states:

**Needs Funding**
**Funded — Awaiting Artwork**
**Drawing Complete**

The model must support future independent campaigns such as:

**Beagle Holiday Art**
**Beagle Dam & Puppies**

without changing the original Beagle campaign.

No PayPal integration yet.

---

**Stage ART-03 — Campaign Read Model + Funding Rules**

Build the server-side domain/service layer.

This establishes canonical calculations for:

amount funded
units funded
units remaining
amount remaining
whether contributions are allowed
funded count
drawing-complete count
three closest-to-funded campaigns

Rules:

**1 unit = $5**
**10 units = funded**
minimum contribution = 1 unit
maximum = remaining units
Fund Remaining = all remaining units

Never trust a dollar amount supplied by the browser. The server derives the amount from requested units.

This is also where the deterministic **Help Finish a Breed** ordering lives.

---




### Section B — Player-Facing Board

**Stage ART-04 — Funding Board Shell**

Build the page with **read-only data** first.

Top project explanation:

> **Help fund the ShowRing breed artwork collection**
>
> Each breed illustration costs $50 to commission.
>
> $40 compensates the artist.
> $10 supports ShowRing development and operating expenses.

Then:

**7 of 318 breeds funded**
**3 drawings complete**

Then **Help Finish a Breed**.

Then the main board.

No payment buttons function yet.

---

**Stage ART-05 — Filtering, Status and Thumbnails**

Add the primary browsing experience:

**Group**
**Breed Name**
**Funding Status**

Statuses:

**All**
**Needs Funding**
**Funded — Awaiting Artwork**
**Drawing Complete**

Each campaign displays its progress/status.

Drawing Complete shows its thumbnail.

Funded campaigns become visually and functionally read-only.

This stage should also handle responsive/mobile behavior and keyboard/accessibility requirements.

---




### Section C — PayPal Contributions

This is deliberately later. By this point we have a functioning funding system with no money involved.

**Stage ART-06 — PayPal One-Time Payment Technical Spike**

This should probably be another **audit/proof stage**, not immediately a production implementation.

Using what ART-01 found, determine the safest PayPal flow for:

> 10 finite $5 funding units shared among potentially concurrent buyers.

Specifically test whether the existing PayPal setup can use an **authorize → server verifies availability → capture** flow while reusing the current credentials/configuration/webhook infrastructure.

Test the race:

Beagle has **1 unit remaining**.

Player A begins checkout.
Player B begins checkout.

Only one may successfully fund that final unit.

**No production contribution flow until this passes.**

---

**Stage ART-07 — Contribution Checkout**

Now connect the board to PayPal.

Player chooses:

**$5 / $10 / $15 / etc.**
or
**Fund Remaining**

Then:

**Recognition**

○ Credit my kennel: *SilverOak Kennels*
○ Remain anonymous

Then:

> **Contributions are final and non-refundable.** Your contribution funds the ShowRing Breed Art Project. Reaching the funding goal means ShowRing will commission artwork for this breed; it does not guarantee a specific artist or completion date.

Required:

☐ **I understand that my contribution is non-refundable.**

Only after that can the player proceed to PayPal.

---

**Stage ART-08 — Capture, Idempotency and Funding Completion**

This is the critical money stage.

A successful PayPal payment must create exactly **one canonical contribution**.

Webhook retries cannot duplicate it.

Browser refreshes cannot duplicate it.

Two people cannot fund unit #10.

A campaign reaching exactly $50 automatically transitions:

**Needs Funding → Funded — Awaiting Artwork**

and closes permanently to further contributions.

This stage gets particularly strong regression coverage before moving on.

---




### Section D — Recognition and Gallery

**Stage ART-09 — Permanent Supporter Recognition**

Add public recognition.

For a completed/funded campaign:

**Funded by X supporters**

Interaction reveals:

**SilverOak Kennels**
**Foxfire Kennels**
**Windward**
**Anonymous supporters: 2**

Repeat public contributions from the same kennel appear **once** in permanent recognition.

No contribution amounts are shown.

The underlying individual contribution records remain intact.

---

**Stage ART-10 — Completed Artwork Gallery**

Build the finished-art experience.

Each item contains:

**Artwork**
**Breed**
**Artist**
**Funded by X supporters**

Selecting it exposes supporter recognition.

The main funding board retains the thumbnail too, so filtering by **Drawing Complete** doubles as a collection browser.

---



### Section E — Manual Artwork Administration

**Stage ART-11 — Admin Artwork Completion Tools**

Keep this deliberately simple.

No artist portal.
No automatic artist assignment.
No artist workflow engine.

Admin manually supplies:

artist credit
final artwork
completion date

and marks:

**Drawing Complete**

We can record an internal commissioned state if useful for accounting/administration, but it does not need to become another player-facing status.

The actual **artist contract/payment process remains outside this feature**.

That is important given the decision that each artwork is independently commissioned.

---



### Section F — Finishing Work

**Stage ART-12 — Call for Artists**

Bottom of the page:

> **Interested in contributing art to ShowRing?**
>
> We're interested in working with artists who love dogs and would like to contribute to ShowRing's growing art collection.
>
> **Message us to learn more.**

I'd route **Message us** into whatever contact mechanism makes the most sense after Codex audits what's currently available—potentially your existing kennel messaging rather than introducing another communication system.

---

**Stage ART-13 — Payment/Failure UX + Final Hardening**

Final pass specifically for unpleasant cases:

PayPal canceled
PayPal declined
authorization expires
capture fails
webhook delayed
duplicate webhook
player closes browser
funding changes during checkout
campaign becomes funded while checkout is open
anonymous/public recognition correctness
completed campaigns reject contribution attempts server-side

Then run focused regression coverage and the normal production build validation.

---




