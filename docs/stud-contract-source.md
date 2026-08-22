# Stud Contract — Final Implemented Rules

This document is the current rules source for the implemented Stud Contract
system. It supersedes earlier transitional descriptions of legacy PLAYER_STUD
listings, Day-8 litter qualification, and deferred puppy transfer mechanics.

## Authority and public availability

The system has three distinct authority phases:

1. **Public offer:** the current `PUBLISHED` `StudOffer` is the authority for
   future outside breeding requests.
2. **Manual request:** a `PENDING` `StudContract` is an immutable snapshot of
   the offer that was requested.
3. **Accepted contract:** an `ACCEPTED` `StudContract` is the immutable
   agreement for that breeding.

Later public-offer edits never alter a pending request or accepted contract.
Manual approval uses the immutable pending-contract terms plus current
biological and availability state; it does not re-evaluate the newest public
offer.

A valid published StudOffer makes a sire publicly offered. Without one, the
sire is not public. This rule is used by `/studs`, Breed Dog, and Plan a
Litter. Owned-sire breeding remains the ordinary in-kennel path and does not
require a StudOffer or StudContract.

## Owner and dam-side flow

The owner flow is:

`dog profile → /dogs/[dogId]/stud-contract → Stud Owner Worksheet`

The worksheet publishes CASH, PUPPY_BACK, or CASH_AND_PUPPY_BACK terms. An
existing published offer opens in edit/version mode; a meaningful published
change creates the next offer version under the versioning rules. There is no
legacy inline listing form or legacy prepopulation.

Outside-sire selection routes using the actual sire and dam identities to
`/stud-contract`. There is no current `studListingId` contract authority and
no direct outside `/api/breedings` path.

## Compensation and approval

Contract snapshots retain the exact compensation configuration.

- **CASH:** the contract's cash component follows the normal breeding and
  ledger transaction behavior.
- **PUPPY_BACK:** no fake cash stud fee is created.
- **CASH_AND_PUPPY_BACK:** both the cash component and puppy obligation are
  retained.

With **Automatic Approval**, the server reloads the current published offer,
rechecks contract requirements and ordinary current eligibility, creates an
immutable accepted contract, and creates the BreedingAttempt. Applicable cash
economy is settled only as part of that successful transaction.

With **Manual Approval**, request creation makes an immutable `PENDING`
StudContract, creates neither a BreedingAttempt nor money movement, and sets
the approval deadline to request time plus 24 real hours. Declining or expiry
resolves the request without breeding. Pending requests do not reserve the
sire, and Stud Recovery does not pause or extend their deadline. A sire can
have multiple independent pending requests; approving one does not decline
the others.

## Requirement authority

Stud Contract qualification is evaluated from the structured contract
requirements, not from a dog's overall health badge.

Each configured canonical health-test code is evaluated independently with:

- **No restriction** (`NONE`)
- **Green or Yellow** (`GREEN_OR_YELLOW`)
- **Green only** (`GREEN_ONLY`)

An unrelated red result, aggregate all-green state, completed-all-tests state,
or visible health checkmark does not independently fail a contract. Those
ordinary health systems remain valid for player presentation and other game
systems.

Title requirements are structured as `NONE`, `CH_OR_HIGHER`, and
`GCH_OR_HIGHER`; CH and recognized higher tiers satisfy CH-or-higher, while
GCH-or-higher rejects CH-only titles. Brucellosis is likewise a structured
contract requirement. When required, current negative-test validity is
checked at the relevant request, approval, or breeding transaction.

Public offer existence does not bypass ordinary controls: Breeding
Availability, Stud Recovery, pending veterinary care, funds, and biological
eligibility remain authoritative.

## Whelp qualification and Puppy Back

At litter creation, the accepted contract freezes the live-born puppy count.
That immutable count controls both Puppy Back minimum-litter qualification and
Small-Litter Return Service classification. Neonatal and later deaths do not
change that contractual result.

For **First Pick**, selection opens at litter creation for the stud owner.
The deadline is fixed at litter birth plus 24 real hours. The required sex is
EITHER, MALE, or FEMALE, and the game never auto-selects a puppy.

For **Second Pick**, the dam's protected first-pick turn opens at litter
creation and ends at birth plus 24 real hours. Once the dam selects, the stud
may act immediately, but the stud deadline always remains birth plus 48 real
hours. If the dam times out, her protected pick is forfeited and the stud turn
opens without moving that fixed deadline.

A stud-owner timeout forfeits the Puppy Back selection right. It causes no
cash substitution and no Return Service by itself. The lifecycle processor is
idempotent and operates from persisted state and deadlines.

If a selected Puppy Back puppy dies before Day 56, an eligible replacement
reopens a stud-owner-only reselection with the same sex obligation. The dam's
protected pick is not restored, and the reselection deadline follows the
implemented capped deadline with Day 56 as its outer boundary. If no eligible
replacement exists, the puppy component is unfulfilled. Neither outcome
creates cash substitution or Return Service solely because of the death.

Outstanding Puppy Back rights protect applicable puppies from sale, rehome,
ownership transfer, and removal-from-game paths. Naming remains ordinary
current-owner behavior and is not contract state authority.

At Day 56, a selected puppy automatically transfers to the immutable original
`sireKennelId`, into that kennel's canonical UNCATEGORIZED run. The original
breeder history and `selectedDogId` remain intact; the selection changes from
`SELECTED` to `COMPLETED`. There is no payment, capacity refusal, or
name-based transfer condition.

## Return Service

Return Service is a single entitlement under an original accepted contract,
not a new public offer or a second contract. It can arise only from:

1. a no-litter outcome when the immutable contract offered No-Litter Return
   Service; or
2. the frozen live-born-at-whelp count meeting the configured Small-Litter
   threshold.

Neonatal/later death, unavailable Puppy Back sex, missed Puppy Back selection,
and selected-puppy death do not independently create Return Service. At most
one entitlement exists per original contract.

An available entitlement lasts 60 real days and applies only to the same sire,
dam, and original contracting kennels. It creates no second stud compensation,
reservation, or priority. Temporary unavailability does not pause expiry.
Ownership transfer, death, or permanent breeding ineligibility of either dog
extinguishes it. A successful Return Service BreedingAttempt consumes it
permanently; the return breeding cannot create another Return Service.

## Legacy PLAYER_STUD history

Legacy PLAYER_STUD is historical data only. Production cutover transitioned
485 active rows to `CANCELLED`; the subsequent active/candidate count was
zero. Normal creation, public fallback, public submission authority, and
legacy requirement authority are removed.

Cancelled `DogListing` rows, their legacy fields, historical
`BreedingAttempt.studListingId` values, and historical ledger, litter, and
contract records are retained unchanged. No StudOffers were fabricated from
legacy values.

## Deferred / Not Implemented

The following ideas remain intentionally outside the implemented system:

- frozen or stored semen;
- deposits and compensation variants beyond the three implemented modes;
- multiple simultaneous offers, multiple Puppy Back obligations, or third and
  later pick positions;
- automatic cash substitution for an unavailable Puppy Back selection;
- negotiation, counteroffers, arbitrary free-text terms, trait/COI
  requirements, private access lists, and messaging;
- contract-specific naming-prefix/suffix concessions or other naming rights
  beyond ordinary ownership behavior.


### The core UI contract

I’d document the target row model approximately as:

| Open     | Status   | Breeding   | Current state                 | Action                 |
| -------- | -------- | ---------- | ----------------------------- | ---------------------- |
| **Open** | Pending  | Dam × Stud | Approval expires in 14h       | **Approve / Decline**  |
| **Open** | Pending  | Dam × Stud | Awaiting stud owner           | —                      |
| **Open** | Active   | Dam × Stud | Breeding attempted            | —                      |
| **Open** | Active   | Dam × Stud | Pregnant                      | —                      |
| **Open** | Active   | Dam × Stud | Whelped — puppy selection due | **Pick Puppy**         |
| **Open** | Active   | Dam × Stud | Return Service available      | **Use Return Service** |
| **Open** | Complete | Dam × Stud | Contract complete             | —                      |

The important architectural rule is:

**Status, Current state, and Action are derived presentation.**
They do not become a new database authority.

That fits the existing implementation because the contract lifecycle, Puppy Back lifecycle, Return Service lifecycle, breeding attempt, pregnancy, and litter states already exist independently. 

I would put this into the implementation source before starting HUB-01, so Codex has one locked target rather than reconstructing the page design from conversation history.