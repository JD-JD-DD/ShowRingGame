# Stud Contract — Final Implementation and Operations Reference

This is the implementation-facing companion to
`docs/stud-contract-source.md`. Both documents describe the final implemented
Stud Contract system. Earlier phased plans and decision gates are superseded
except where preserved below as completed history or explicitly deferred work.

## Final implementation status

STUD-CONTRACT-01 through STUD-CONTRACT-34 are complete. The active system is
StudOffer/StudContract based:

- A current `PUBLISHED` StudOffer is the only public authority for a future
  outside breeding.
- A manual request is an immutable pending StudContract snapshot.
- An accepted StudContract is the immutable authority for that breeding.
- Later public-offer versions do not rewrite pending or accepted contract
  terms.

The public resolver, `/studs`, Breed Dog, and Plan a Litter expose only valid
published StudOffers. The dam-side contract route accepts real sire/dam
identity and resolves the StudOffer authority. Outside direct breeding is not
allowed without a Stud Contract. Owned breeding remains a separate ordinary
path.

## Models and transaction authority

`StudOffer` stores versioned public terms and per-test requirements.
`StudContract` stores the accepted or pending agreement snapshot, including
compensation, Puppy Back configuration, Return Service choices, brucellosis,
title requirement, approval mode, and per-test requirement rows.

Automatic acceptance reloads the current published offer in its transaction,
then checks structured requirements and current operational state before
creating both the accepted contract and BreedingAttempt. Manual request
creation snapshots the offer and creates no BreedingAttempt or ledger entry.
Manual approval uses the pending contract snapshot plus current biological and
availability state; it does not consult a newer public offer.

The only contract-health evaluator is the per-test structured evaluator. Its
stored levels are `NONE`, `GREEN_OR_YELLOW`, and `GREEN_ONLY`; ordinary
overall-health, all-green, green-or-yellow, and completion indicators remain
presentation/general-game systems rather than contract authority. Title tiers
are `NONE`, `CH_OR_HIGHER`, and `GCH_OR_HIGHER`. Brucellosis is a structured
contract requirement checked against current valid test state at the relevant
transaction.

## Owner and public routes

The owner entry point is the dog profile's **Stud Owner Worksheet**, which
opens `/dogs/[dogId]/stud-contract`. It supports CASH, PUPPY_BACK, and
CASH_AND_PUPPY_BACK, sequentially invalidates incompatible downstream terms,
loads canonical breed health-test rows, and publishes/version-edits terms.

There is no runtime OfferDogAtStud form, list-at-stud API, legacy fee form, or
legacy terms prepopulation. Public sire routing uses `/stud-contract` with
sire/dam identity, never a current `studListingId`.

## Whelp, Puppy Back, and protection

At litter creation, `liveBornPuppyCount` and the resulting Puppy Back and
Small-Litter Return Service qualification facts are frozen on the accepted
contract. Day-8 survivors are not contractual qualification authority.

- First Pick opens at litter creation; its fixed deadline is birth + 24 real
  hours.
- Second Pick opens the dam's protected turn at litter creation through birth
  + 24 real hours. The stud can act once that pick is made or forfeited, but
  its fixed deadline is always birth + 48 real hours.
- No pick is automatic. A missed stud turn forfeits the Puppy Back right and
  does not create cash substitution or Return Service.
- A selected puppy death before Day 56 can reopen stud-only reselection when a
  valid replacement exists. The sex rule remains, the dam pick is not
  restored, and the deadline is capped by Day 56.

Outstanding selection rights are guarded on sale, rehome, transfer, and
removal paths. Naming remains ordinary ownership behavior. At Day 56, a
selected puppy transfers automatically to the immutable original sire kennel's
UNCATEGORIZED run, preserving breeder history and selected-dog identity, with
no payment, capacity rule, or refusal.

## Return Service

The system creates at most one Return Service entitlement per original
accepted contract. It is limited to no-litter and configured small-litter
outcomes, evaluated from the frozen live-born-at-whelp count. Puppy deaths,
unavailable requested sex, missed selection, and selected-puppy death do not
independently create it.

An entitlement is available for 60 real days for the same sire, dam, and
original contracting kennels. It does not create second stud compensation,
priority, or reservation. Temporary unavailability does not pause expiry;
ownership transfer, death, or permanent ineligibility extinguishes it. A
successfully created Return Service BreedingAttempt consumes it permanently.

## Lifecycle processor

`/api/cron/process-stud-contract-lifecycle` is reconciliation and deadline
infrastructure. It processes persisted-state transitions such as manual
request expiry, Puppy Back deadline progression, selected-puppy death
reconciliation, Day-56 transfer, and Return Service expiry/reconciliation.

Persisted rows and timestamps are authoritative. The processor is idempotent:
reprocessing resolved rows must not duplicate notices, transfers, return
entitlements, or consumption, and it does not invent business outcomes.

## Legacy cutover — complete

The legacy PLAYER_STUD transition is complete:

- Normal runtime PLAYER_STUD creation UI, API, and service were removed.
- Public resolver fallback, planner branches, contract-route authority,
  submission authority, and legacy requirement enforcement were removed.
- Production cutover transitioned 485 `ACTIVE` PLAYER_STUD rows to
  `CANCELLED`.
- The subsequent dry run reported zero active rows and zero candidates.
- Historical cancelled DogListing rows, their fields, historical
  `BreedingAttempt.studListingId`, and historical ledger/litter/contract data
  remain unchanged.
- No StudOffers were fabricated from historical listings.

The one-time `cutover:deactivate-legacy-player-stud` script remains dry-run by
default and performs idempotent `ACTIVE → CANCELLED` changes only with
`--apply`. Production cutover is already complete; it is not recurring
maintenance.

## Regression and validation status

Focused scripts cover worksheet terms, offer versioning, structured health and
title requirements, automatic and manual approval, public discovery/routing,
whelp qualification, Puppy Back selection and reselection, protection,
transfer, Return Service, and lifecycle processing. Stage 33 also updated
obsolete assertions and added explicit legacy-authority absence coverage.

Stage 33 found no production defect and made no production-code change. Local
focused `tsx` execution remains blocked before test execution by the known
`EPERM` failure opening `tsx/dist/cli.mjs`; no runner workaround was used.
The production build after Stage 32 succeeded.

## Completed stage history

- **01–07:** public terms, worksheet, compensation, Puppy Back, Return
  Service configuration, and structured dam requirements.
- **08–19:** versioning, public discovery, automatic/manual agreement flow,
  immutable contracts, and health/title enforcement.
- **20–29:** whelp-time qualification, selection deadlines, protection,
  reselection, Return Service lifecycle, and Day-56 transfer.
- **30–32:** owner-entry migration, legacy PLAYER_STUD deactivation, and
  removal of legacy requirement/public authority.
- **33:** focused lifecycle regression audit and legacy-absence coverage.
- **34:** final documentation reconciliation.

## Deferred / Not Implemented

The following historical design ideas remain intentionally unimplemented:

- frozen/stored semen;
- deposits or compensation variants beyond CASH, PUPPY_BACK, and
  CASH_AND_PUPPY_BACK;
- multiple selectable offers, multiple Puppy Back obligations, and third or
  later pick positions;
- automatic alternate-sex or cash substitution;
- negotiation/counteroffers, arbitrary custom terms, trait or COI
  requirements, private/restricted access lists, and messaging;
- contract-specific naming rights or prefix/suffix concessions.




## Proposed staged implementation

1. **HUB-01 — Unified Read Model**

   * Expand `/stud-contracts` so every row has:

     * persistent **Open**
     * derived **Status**
     * **Breeding** (`Dam × Stud`)
     * derived **Current state**
     * derived **Needs Action** metadata
   * Preserve newest-first history and 10/+10 pagination.
   * No action buttons move yet.
   * No new stored status enum.

2. **HUB-02 — Filters and Sorting**

   * Add top controls:

     * **All**
     * **Needs Action**
     * **Pending**
     * **Active**
     * **Complete**
     * **Declined / Expired**
   * Make filtering work correctly with pagination; server-side if necessary.
   * Optionally add simple sort if useful, but default remains newest-first.
   * `Needs Action` derives from existing persisted states, not a new DB flag.

3. **HUB-03 — Manual Approval Actions**

   * Move **Approve / Decline** behavior from `/stud-contracts/requests` into the appropriate rows on `/stud-contracts`.
   * Sire owner sees action buttons.
   * Dam owner sees “Awaiting stud owner.”
   * Use existing approval/decline APIs and immutable request authority.
   * Include accurate deadline and current sire/dam availability messaging.
   * This also fixes the incomplete Pending Requests UI identified in Audit 01.

4. **HUB-04 — Puppy Back Actions**

   * Surface **Pick Puppy** only when the active kennel currently owns the selection turn.
   * Use the existing Puppy Back selection state/deadlines.
   * Do not duplicate selection logic.
   * Row states can distinguish:

     * waiting for dam pick
     * stud pick available
     * puppy selected
     * selection forfeited/completed

5. **HUB-05 — Return Service Actions**

   * Surface **Use Return Service** only when an entitlement is actually available to the active kennel.
   * Show the existing 60-real-day deadline/availability.
   * Preserve same sire/dam/original kennel rules and existing transaction path.
   * Keep Return Service state separate from the main contract lifecycle status. 

6. **HUB-06 — Current-State Refinement**

   * Finish the player-facing lifecycle descriptions across all contract phases, for example:

     * Approval required
     * Awaiting stud owner
     * Breeding attempted
     * Pregnancy pending
     * Pregnant
     * Whelped
     * Puppy selection due
     * Puppy selected
     * Return Service available
     * Complete
     * Declined
     * Expired
   * Derive each from existing authoritative state.
   * No new simulation state or lifecycle enum.

7. **HUB-07 — Contract Detail Completion**

   * Keep `/stud-contracts/[contractId]` as the permanent detailed record.
   * Fill the audit gaps:

     * pending approval deadline
     * declined timestamp
     * expired timestamp
     * any missing lifecycle/selection/Return Service dates already persisted
   * Preserve immutable contract terms as detail authority.

8. **HUB-08 — Navigation Consolidation**

   * Make **My Stud Contracts** / **Stud Contracts** a prominent normal navigation destination rather than buried under Account.
   * Remove the separate **Stud Requests** navigation item.
   * Add appropriate low-friction links from Stud Owner Worksheet / relevant breeding surfaces where useful.
   * Keep one obvious answer to “where do I manage my stud contracts?”

9. **HUB-09 — Retire `/stud-contracts/requests`**

   * Only after Approve/Decline and request-state presentation work correctly on the hub.
   * Remove the separate player-facing requests page or redirect it safely to `/stud-contracts` with an appropriate Needs Action/Pending view.
   * Remove obsolete placeholder copy/components only when no callers remain.
   * Do not touch the underlying manual-request transaction services.

10. **HUB-10 — Notices and Deep Links**

    * Update Stud Contract notices so relevant notices link directly to:

      * `/stud-contracts/[contractId]`, or
      * `/stud-contracts` when the workspace is more appropriate.
    * Manual approval request → actionable contract.
    * Puppy pick → relevant contract/litter action.
    * Return Service → relevant contract.
    * Preserve dog/litter links where they are still useful secondary navigation.

11. **HUB-11 — Unified Regression Closeout**

    * Lock:

      * both kennel roles
      * historical records
      * Open link
      * Status derivation
      * Current-state derivation
      * Needs Action filtering
      * Approve/Decline
      * Puppy Pick
      * Return Service
      * pagination/filter interaction
      * durable detail
      * requests route retirement/redirect
      * notice deep links
    * Confirm no new stored lifecycle authority was introduced.


