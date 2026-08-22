Stud Contract — Full Staged Implementation Plan
Authority and scope

For every implementation stage:

Authoritative rules:
C:\Users\tangl\showringgame\docs\stud-contract-source.md

Current implementation:
Repository code at the time that stage begins.

Historical reference only:
The original Stud Contract audit.

Do not treat the pre-STUD-FLOW route descriptions as current without reinspection.

The master file remains authoritative for broader principles: server-side eligibility, dog pages as navigation hubs, deterministic economy, ledger-backed money movement, and avoiding exposure of hidden genetics.

Architecture to build toward

There are three distinct persistent concepts.

Published Stud Offer

One active set of terms belonging to a sire.

This is what the stud owner creates with the Stud Owner Worksheet.

It is editable for future breedings.

Stud Contract Request / Contract

A sire + dam transaction based on a snapshot of the published offer.

For automatic approval, it can move immediately into accepted status when the dam owner confirms.

For manual approval, the snapshotted terms remain pending for up to 24 real hours.

Post-breeding contract obligations

After breeding, the accepted contract can later produce:

return-service entitlement;
puppy-selection workflow;
puppy claim/reservation;
completion/forfeiture state.

Those obligations belong to the immutable contract—not to the current public offer.

That distinction is central to the source rules.

Phase I — Current-state re-audit and persistence foundation
STUD-CONTRACT-01 — Post-STUD-FLOW integration audit
Goal

Reinspect the current repository before introducing persistence.

This prevents the old audit from becoming stale architecture guidance.

Audit

Trace:

current /stud-contract;
current Public Stud Stud Terms / Contract Terms;
current Breed Dog Open Contract;
current Plan a Litter Open Contract;
current Offer Dog At Stud;
DogListing;
current health-test configuration;
current title helpers;
createBreedingAttemptForKennel;
current Stud Recovery helper;
current dam breeding eligibility;
current notices;
litter creation;
neonatal mortality processing;
puppy sale/rehome/naming/transfer paths;
current cron conventions.
Special cron audit

Identify:

how Vercel cron routes authenticate;
existing cron cadence conventions;
idempotency patterns;
batching patterns;
retry/logging conventions;
whether an existing breeding/lifecycle job is suitable for event-triggered integration.
Output

No production changes.

Produce a concrete current integration map before schema design.

STUD-CONTRACT-02 — Persistence model
Goal

Add the minimum persistence needed for published terms and immutable contracts.

Do not put the whole new feature into additional DogListing booleans.

Recommended models

Conceptually:

StudOffer

id
sireDogId
ownerKennelId
status
version
compensationType
cashAmount nullable
puppyPickPosition nullable
puppySex nullable
minimumLitterSize nullable
noLitterReturnService
smallLitterReturnThreshold nullable
brucellosisRequirement
titleRequirement
approvalMode
publishedAt
updatedAt

StudOfferHealthRequirement

offerId
canonical health-test code
requirement level

This child model is preferable because health tests will be breed-specific and may evolve.

StudContract

id
sourceOfferId
sourceOfferVersion
sireDogId
damDogId
sireKennelId
damKennelId
status
complete immutable snapshot of all agreed terms
requestedAt
approvalDeadlineAt nullable
acceptedAt nullable
declinedAt nullable
expiredAt nullable
breedingAttemptId nullable

The contract must contain the terms themselves, not depend on reading the current offer later.

Important

The contract snapshot is authoritative after request/acceptance.

Do not implement puppy selection or return-credit models yet.

Validation

Lock:

one active published offer per sire;
health requirements uniquely keyed by offer + health-test code;
accepted/pending contracts survive later Stud Offer edits unchanged;
ownership IDs are snapshotted where appropriate;
no outside breeding behavior changes yet.
STUD-CONTRACT-03 — Canonical contract rule layer
Goal

Centralize the locked contract vocabulary and validation before building forms.

Canonical enums/values

Compensation:

CASH
PUPPY_BACK
CASH_AND_PUPPY_BACK

Pick:

FIRST
SECOND

Puppy sex:

EITHER
MALE
FEMALE

Approval:

AUTOMATIC
MANUAL

Health requirement:

NONE
GREEN_OR_YELLOW
GREEN_ONLY

Title:

NONE
CH_OR_HIGHER
GCH

Small-litter return:

none
1
2
3
Cross-field validation

Examples:

Cash:

cash amount required;
no puppy fields permitted.

Puppy Back:

cash amount absent;
pick, sex, minimum litter required.

Cash + Puppy:

cash amount required;
puppy fields required.

Second Pick:

minimum litter 1+ unavailable.
Critical worksheet rule

Changing an earlier answer must invalidate dependent downstream values.

Do not silently preserve stale combinations.

Phase II — Stud Owner Worksheet
STUD-CONTRACT-04 — Owner worksheet shell
Goal

Replace the concept of the tiny inline listing form with a real dedicated sequential worksheet—but do not cut over the old listing system yet.

Route

Use a dedicated owner route, for example:

/dogs/[dogId]/stud-contract

or another route selected by the current audit.

Do not reuse the dam-owner /stud-contract route for offer creation.

Structure

Step-based UI:

Compensation
Puppy-Back Terms, conditional
Return Service
Dam Requirements
Approval
Review & Publish
State behavior
Back/Next.
Completed previous sections remain reviewable.
Editing an upstream field invalidates affected later fields.
Progress indicator.
No partial public offer until Publish.

Keep player-facing text centralized where practical.

STUD-CONTRACT-05 — Compensation step

Implement exactly:

Cash
Puppy Back
Cash + Puppy Back

Cash amount appears only where applicable.

No:

deposits;
multiple offers;
alternate compensation options;
custom text.

Use locale-aware currency display.

Server validation mirrors UI validation.

STUD-CONTRACT-06 — Puppy-Back Terms step

Shown only for:

Puppy Back
Cash + Puppy Back
Fields

Pick

First Pick
Second Pick

Required Sex

Either
Male
Female

A selection is mandatory.

Minimum qualifying litter

1+
2+
3+

For Second Pick:

1+ disabled;
clear explanation why.
Required player-facing rules

The worksheet should plainly explain:

selection begins after the Week 1 neonatal window;
the game never chooses a puppy automatically;
each active selection turn lasts 24 real hours;
missed selection rights are forfeited;
a sex requirement is mandatory, not a preference;
no automatic alternate-sex substitution;
no automatic cash substitution;
selected puppy death can reopen selection if the selection window is still valid;
if no qualifying replacement remains, the puppy component may remain unfulfilled;
that alone does not create return service.

All of these come directly from the locked rules.

STUD-CONTRACT-07 — Return Service step
Fields

No-litter return service

Offered
Not offered

Small-litter return service

None
1 or fewer
2 or fewer
3 or fewer
Explanation

Make explicit that small-litter return service is driven by the surviving-litter threshold.

It is not created merely because:

requested sex is unavailable;
a prior pick consumes the only qualifying puppy;
stud owner misses selection;
selected puppy later dies unless litter-size threshold itself qualifies.

Do not implement return credits yet.

This stage records the terms only.

STUD-CONTRACT-08 — Dam Requirements step
Brucellosis
No restriction
Negative required
Breed-specific health testing

Load the canonical health tests applicable to the sire's breed.

Do not hard-code HIP/ELBOW/etc. into the Stud Contract form.

For each currently applicable test:

No restriction
Green or Yellow
Green only
Titles
No restriction
CH or higher
GCH

No:

trait thresholds;
COI gates;
free-text requirements;
arbitrary owner age limits.

This matches the locked source.

STUD-CONTRACT-09 — Approval step
Options
Automatic Approval
Manual Approval
Automatic copy

Explain that qualifying breedings do not require individual owner approval.

Manual copy

Explain:

owner must approve;
request lasts 24 real hours;
pending request does not reserve the sire;
sire must actually be eligible when approval is attempted;
request may expire while sire is in Stud Recovery.

Do not build request processing yet.

STUD-CONTRACT-10 — Review and publish
Review

Generate plain-language terms from the structured data.

Example conceptually:

Compensation
$1,500 + Second Pick Female

Minimum qualifying litter
2 surviving puppies

Return service
No litter: Offered
Small litter: 1 or fewer

Dam Requirements
Brucellosis negative
HIP: Green only
CARDIAC: Green or Yellow
CH or higher

Approval
Manual — request expires after 24 real hours

Publish

Server validates:

current ownership;
dog is an eligible sire for offering at stud under current listing rules;
all contract combinations valid;
health requirements correspond to canonical tests for breed.

Publish the Stud Offer.

No breeding occurs.

STUD-CONTRACT-11 — Offer editing/versioning
Goal

Allow the sire owner to edit future public terms without changing pending/accepted contracts.

Every meaningful publish update should advance offer version or otherwise guarantee immutable snapshot semantics.

Pending request A created from Version 2 must remain Version 2 even if public offer becomes Version 3.

This is explicitly required by the source rules.

Phase III — Public presentation and dam-side worksheet
STUD-CONTRACT-12 — Contract-backed Stud Terms
Goal

Replace the STUD-FLOW placeholder presentation with actual published offer summaries.

Public Stud and planner outside sire cards can now summarize major terms:

cash amount or puppy-back;
First/Second Pick;
sex where relevant;
key health/title requirements;
Automatic/Manual approval.

Do not put the entire contract on the card.

Compare

Now that terms actually exist, add only useful compact rows to the already regression-locked Compare table.

Do not redesign Compare.

STUD-CONTRACT-13 — Dam-side /stud-contract read-only terms
Goal

Turn the existing permanent placeholder route into the actual contract-view page.

Given:

studListingId
sireDogId
optional damDogId
source

load authoritative server-side offer data.

Do not trust URL data for eligibility or price.

Without dam

Show terms and allow navigation into selecting an eligible owned dam.

With dam

Show:

sire;
dam;
full offer terms;
dam's qualification status;
sire availability;
current Stud Recovery countdown if relevant.

Still no submission in this stage.

STUD-CONTRACT-14 — Unified contract eligibility evaluator
Goal

Replace legacy DogListing requirement evaluation with the new structured offer evaluator.

It must be reusable by:

Public Stud/contract page;
Breed Dog;
Plan a Litter;
manual request submission;
automatic acceptance;
final breeding mutation.

Evaluate:

brucellosis;
breed-specific health requirements;
title requirement.

Continue separately enforcing ordinary breeding rules:

ownership;
breed;
sex;
age;
pregnancy;
reproductive recovery;
Breeding Availability;
Stud Recovery;
pending care;
funds.

Contract requirements do not override biological eligibility.

Phase IV — Acceptance and manual requests
STUD-CONTRACT-15 — Automatic approval transaction
Goal

Make automatic outside contracts functional.

Dam owner confirms.

Within authoritative server transaction:

reload current Stud Offer;
verify dam/sire identities;
verify ownership;
re-evaluate contract requirements;
re-evaluate ordinary breeding eligibility;
snapshot immutable Stud Contract;
initiate the normal outside breeding attempt;
associate contract ↔ attempt.
Cash

For CASH and CASH_AND_PUPPY_BACK, the safest initial strategy is to reuse the current stud-fee ledger mechanism for the cash component, rather than creating a second payment engine.

However, because exact new ledger implementation is explicitly marked undecided in the source, the stage should audit this before modifying economy code. All actual money movement must remain ledger-backed per the master.

Do not invent deposits or refunds.

STUD-CONTRACT-16 — Manual approval request creation
Goal

Submitting a manual contract creates a pending request, not a breeding attempt.

Persist:

immutable requested terms;
request creation timestamp;
exact approvalDeadlineAt = requestedAt + 24 real hours;
sire/dam/kennels;
pending status.
Dam

Apply the contract-specific pending restriction:

Stud approval pending

This is not pregnancy or breeding attempted.

Ordinary biological eligibility has not yet been consumed.

No payment

Do not charge breeding/stud fee at request creation.

STUD-CONTRACT-17 — Pending Stud Requests management page

This does need to become part of the first operational manual-approval system.

Exact layout is not locked, but behavior is.

Design a scalable centralized management surface suitable for kennels with many studs.

Recommended table/list:

Stud
Dam
Requesting kennel
Contract summary
Requested
Time remaining
Stud availability
Approve
Decline
View Contract
View Dam

Allow many pending requests.

No artificial request cap.

Approving one does not remove the others.

STUD-CONTRACT-18 — Manual Approve / Decline
Decline

Atomic transition:

PENDING → DECLINED

Then remove dam's pending-contract restriction and recalculate actual eligibility.

Approve

Only actionable if:

request still pending;
deadline not expired;
sire currently eligible;
dam still eligible;
sire still meets normal availability;
contract requirements still appropriately applicable under the immutable request;
no conflicting dam breeding state arose.

If sire is recovering:

Approve disabled;
show Stud Recovery countdown;
Decline remains available;
deadline keeps running.

On successful approval:

create/accept contract;
invoke normal breeding initiation;
begin Stud Recovery normally;
other requests remain untouched.
Phase V — Scheduled request lifecycle
STUD-CONTRACT-19 — Manual approval expiry workflow

Yes, this needs scheduled processing.

Persisted deadline

Never calculate expiry only in React.

Store approvalDeadlineAt.

Cron/service

Create one idempotent server service that:

finds pending requests whose deadline has passed;
transitions them to EXPIRED;
releases dam's pending restriction;
creates appropriate notifications;
does not create a breeding;
does not charge money.
Cadence

I would target approximately every 5 minutes, unless the current Vercel/cron conventions strongly favor another existing cadence.

An hourly job is too coarse for a player-facing 24-hour deadline because it could leave dams blocked for nearly an extra hour.

The precise cron expression should follow the current repository infrastructure discovered in STUD-CONTRACT-01.

Idempotency

Repeated processing must be harmless.

Use status + deadline guards so a request cannot expire twice.

Phase VI — Breeding outcome linkage
STUD-CONTRACT-20 — Contract ↔ breeding ↔ litter linkage
Goal

Carry the accepted contract through breeding progression.

When breeding attempt progresses:

contract remains attached;
if litter results, link contract to litter;
preserve immutable terms.

At the litter-qualification checkpoint, calculate:

surviving puppy count;
whether minimum puppy-back litter size was met;
whether configured small-litter return condition was met.

Do not yet choose puppies.

STUD-CONTRACT-21 — No-litter and small-litter outcome classification
Goal

Make contract outcomes deterministic from the existing breeding lifecycle.

Create explicit derived outcome classifications such as:

no qualifying litter;
small-litter guarantee triggered;
puppy-back potentially fulfillable;
puppy-back not fulfillable by litter size.

But do not yet create reusable breeding credits if the lifecycle/storage semantics for those credits remain undecided.

This is an important boundary from the source document: return-service credit storage/lifecycle is still explicitly unresolved.

Phase VII — Puppy-selection lifecycle
STUD-CONTRACT-22 — Puppy selection persistence

Create an explicit puppy-selection obligation linked to:

contract;
litter;
pick position;
sex;
state;
current actor;
turnStartedAt;
turnDeadlineAt;
selectedDogId nullable;
forfeiture/completion timestamps.

Possible conceptual states:

waiting for litter qualification;
dam first pick;
stud pick;
selected;
forfeited;
unfulfillable;
completed.

Exact enum names can be chosen during implementation, but transitions must mirror the source rules.

STUD-CONTRACT-23 — Open selection after neonatal window

This is another timed workflow.

Canonical trigger

Selection becomes eligible after the Week 1 neonatal death window closes.

Use canonical game-time helpers.

Do not manually implement "7 hours" throughout the code.

First Pick

Open stud owner's 24-real-hour turn.

Second Pick

Open dam owner's 24-real-hour protected first-pick turn.

Send notices.

Create the temporary Stud Contract Selection section on the litter page.

STUD-CONTRACT-24 — Litter-page selection UI
First Pick

Show stud owner only qualifying puppies:

all puppies for EITHER;
males for MALE;
females for FEMALE.
Second Pick

Dam owner first sees the complete eligible litter because their protected first pick is not restricted by the stud owner's sex choice.

After dam selects:

mark that puppy as dam's protected selection;
immediately open stud owner's turn;
stud owner sees qualifying remaining puppies based on the contract sex.
Never auto-select

Player action is required.

Use explicit countdown copy for the current 24-real-hour turn.

STUD-CONTRACT-25 — Contract protection guards

Until required selections are completed or forfeited, every puppy that could affect the outstanding contractual selection must be protected.

Add authoritative server guards to:

naming;
sale listing;
rehome;
ownership transfer;
any remove-from-game path.

UI disabling alone is insufficient.

Messages should state the actual reason, for example:

This puppy is part of an active Stud Contract selection and cannot be named yet.

Once the relevant selection is resolved, release unnecessary holds.

STUD-CONTRACT-26 — Puppy-selection deadline cron

The same centralized contract timeline job can process this, rather than adding several unrelated cron routes.

Dam first-pick deadline

If expired:

dam's protected first-pick right is forfeited;
no puppy selected;
open stud owner's turn;
start a fresh 24-real-hour deadline;
notify both kennels.
Stud selection deadline

If expired:

puppy-back right forfeited;
no puppy selected;
no money substitute;
no penalty;
no return service solely from timeout;
release applicable litter protection.
Deadline authority

Persist exact deadlines.

Cron should only advance rows whose deadline is actually due.

STUD-CONTRACT-27 — Selected puppy death/reselection

If selected contract puppy dies before transfer:

if selection remains valid/open and another qualifying puppy exists, reopen stud selection;
preserve original sex and pick rules;
do not alter contract terms.

If none exists:

puppy component becomes unfulfilled;
no cash substitution;
no contract error;
return-service status remains determined solely by the independently configured litter-size rule.

This behavior must match the source verbatim in meaning.

Phase VIII — Decision-gated obligations

Two areas cannot responsibly be fully implemented yet because your source explicitly marks their mechanics undecided.

STUD-CONTRACT-28 — Return-service credit lifecycle — DECISION GATE

The worksheet can already publish:

no-litter guarantee;
small-litter threshold.

The system can already determine whether a guarantee was triggered.

But before creating an actual reusable return-service credit, we still need to decide:

how long the credit lasts;
whether it is tied strictly to same sire and dam;
what happens if sire dies/sells/retires;
whether credit bypasses a new public offer;
how the player exercises it;
whether a return breeding requires manual approval again;
whether cash is charged again.

The source explicitly leaves return-service credit storage/lifecycle undecided.

Do not let Codex invent this.

STUD-CONTRACT-29 — Selected puppy transfer — DECISION GATE

Likewise, the system can:

identify the selected puppy;
protect it;
record who is owed it.

But the source deliberately leaves puppy transfer mechanics after selection undecided.

Before automated transfer, decide:

exact transfer age;
whether transfer happens automatically or requires a claim action;
what happens if puppy dies after selection but before transfer;
kennel capacity implications if any;
whether name is chosen by stud owner after selection;
how breeder/owner history should record the transaction.

Until then, persist the contractual claim but do not invent transfer semantics.

Phase IX — Legacy cutover
STUD-CONTRACT-30 — Replace Put Dog At Stud

Only after:

owner worksheet works;
dam-side contract page works;
eligibility evaluator works;
automatic approval works;
manual requests work;
contract-backed outside breeding works.

Then:

Offer Dog At Stud → Stud Owner Worksheet

Remove the legacy inline requirements form.

Do not use its values to prepopulate the new worksheet.

That was already explicitly decided.

STUD-CONTRACT-31 — Legacy listing deactivation

At cutover:

cancel/deactivate active legacy PLAYER_STUD listings;
do not hard-delete historical records;
do not fabricate Stud Offers from old listings;
leave historical breeding attempts untouched;
require owners to relist through the worksheet.

This avoids two concurrent requirement systems.

STUD-CONTRACT-32 — Remove legacy requirement authority

Once the new evaluator is authoritative:

Remove legacy contract-equivalent enforcement such as:

legacy all-green flags;
legacy green/yellow flags;
legacy champion-dam flags;
old brucellosis listing requirement path,

from the outside contract path.

Do not remove any biological or general health rules.

Ensure there is exactly one source of truth.

Phase X — Final integration and regression
STUD-CONTRACT-33 — Full contract lifecycle regression suite

Cover:

Owner worksheet
every compensation branch;
sequential invalidation;
disabled impossible options;
dynamic breed-specific health tests;
Review snapshot.
Offer versioning
edit public offer;
pending contract unchanged;
accepted contract unchanged.
Automatic approval
eligible dam succeeds;
ineligible dam rejected;
Stud Recovery enforced;
current fee behavior preserved.
Manual approval
pending state;
no money at request;
24h deadline;
decline;
expiration;
multiple simultaneous requests;
approve one leaves others;
recovering sire disables approval.
Puppy selection
First Pick;
Second Pick;
dam timeout;
stud timeout;
Either/Male/Female;
unavailable sex;
minimum litter rules;
selected puppy death/reselection;
contract protection on naming/sale/rehome/transfer.
Return classification
no litter;
1-or-fewer;
2-or-fewer;
3-or-fewer;
wrong sex does not independently trigger return service;
missed pick does not trigger it.
Existing systems

Regression lock:

owned breeding;
Stud Recovery;
Breeding Availability;
pending care;
health testing;
reproduction;
ledger;
litter generation;
mortality;
Compare;
kennel runs.
STUD-CONTRACT-34 — Documentation and authoritative-source update

Update the post-Invitational master documentation with:

implemented models;
lifecycle;
cron responsibilities;
source-of-truth rules;
explicitly deferred decisions.

Keep stud-contract-source.md as the design/rule provenance if desired, while the master documents actual implemented behavior.

Cron architecture

I would not create one cron route for every timer.

Use a single idempotent Stud Contract lifecycle processor unless the current repository architecture strongly favors otherwise.

Conceptually:

/api/cron/process-stud-contract-lifecycle

It can process bounded batches of due work:

expire manual approval requests;
open puppy-selection windows after neonatal qualification;
expire dam first-pick turns;
open stud second-pick turns;
expire stud-selection turns;
release expired/forfeited contract protection;
optionally reconcile selected-puppy death/reselection cases.

Each transition should be based on persisted state + persisted deadlines, not "what the cron thinks probably happened."

Timing domains

Keep these explicit:

Game-time derived

puppy reaches Day 8;
puppy reaches age milestones.

Real-time

manual approval = 24 real hours;
dam selection turn = 24 real hours;
stud selection turn = 24 real hours.

That is important because your game already distinguishes biological game time from player-response/cooldown real time.

Cron should not own everything

Some transitions should happen immediately when the triggering transaction is already occurring:

dam chooses puppy → immediately open stud turn;
stud approves request → immediately create breeding if eligible;
owner declines → immediately resolve;
breeding resolution → immediately attach contract outcome where practical;
puppy death → immediately test whether reselection should open if the mortality service already owns that event.

Cron is the deadline/reconciliation safety mechanism, not a replacement for event-driven transitions.

Recommended execution order

I would implement in this exact sequence:

Foundation

CONTRACT-01 re-audit
02 persistence
03 rule layer

Owner worksheet
4. 04 shell
5. 05 compensation
6. 06 puppy-back
7. 07 return service
8. 08 dam requirements
9. 09 approval
10. 10 review/publish
11. 11 editing/versioning

Discovery
12. 12 public Stud Terms
13. 13 dam /stud-contract
14. 14 unified eligibility

Breeding
15. 15 automatic approval
16. 16 manual request
17. 17 Pending Requests page
18. 18 approve/decline
19. 19 expiry cron

Litter
20. 20 breeding/litter linkage
21. 21 outcome classification
22. 22 selection persistence
23. 23 open-selection workflow
24. 24 litter UI
25. 25 protection guards
26. 26 deadline cron
27. 27 puppy death/reselection

Decision gates
28. Return-service credit lifecycle
29. Puppy transfer mechanics

Cutover
30. Replace Put Dog At Stud
31. Deactivate legacy listings
32. Remove legacy requirement authority

Closeout
33. Full regression
34. Documentation




| Stage                                      | Change needed                                                                                                                                                                                                          |              Size |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------: |
| **14**                                     | Rewrite before implementation: flat per-test health evaluator; `NONE` bypasses that specific test; G/Y and Green apply only to that test; aggregate green-check status is irrelevant; use `GCH_OR_HIGHER`.             |     **Important** |
| **15 Automatic Approval**                  | Clarify that acceptance evaluates the **exact published offer snapshot**, including each individual health-test requirement. Once accepted, the resulting StudContract snapshot is immutable.                          |             Small |
| **16 Manual Request**                      | Already says “immutable requested terms.” Add explicitly that all per-test health rows and title requirement are snapshotted. Later offer edits cannot change the pending request.                                     |             Small |
| **17 Pending Requests**                    | No business-rule change. Contract summary should naturally summarize only meaningful per-test restrictions.                                                                                                            |              Tiny |
| **18 Approve/Decline**                     | Approval must re-evaluate the dam against the **immutable request snapshot**, not the sire’s newest public offer. After approval, accepted contract terms are frozen. Use `GCH_OR_HIGHER`.                             | Important wording |
| **19 Expiry**                              | No change.                                                                                                                                                                                                             |              None |
| **20 Contract ↔ Breeding ↔ Litter**        | Add one explicit sentence: accepted contract terms are not re-derived or re-evaluated from later public offers/configuration.                                                                                          |             Small |
| **21 Outcome Classification**              | No health/title change.                                                                                                                                                                                                |              None |
| **22–27 Puppy Selection**                  | No changes from these health/title decisions. They operate from the accepted immutable contract.                                                                                                                       |              None |
| **28 Return Service Decision Gate**        | **Expand this decision gate.** This is where death/sale/permanent unavailability and return-breeding reevaluation rules need to be decided.                                                                            |         Important |
| **29 Puppy Transfer**                      | No change.                                                                                                                                                                                                             |              None |
| **30 Replace Put Dog At Stud**             | No conceptual change.                                                                                                                                                                                                  |              None |
| **31 Legacy Listing Deactivation**         | No change.                                                                                                                                                                                                             |              None |
| **32 Remove Legacy Requirement Authority** | Strengthen wording: remove legacy aggregate “all green / green-or-yellow / champion” authority; the per-test contract snapshot becomes the only contract-health authority. Aggregate green-check UI remains unrelated. | Important wording |
| **33 Full Regression**                     | Add per-test independence, extensibility, aggregate-health independence, `GCH_OR_HIGHER`, and immutable-snapshot regressions.                                                                                          |         Important |
| **34 Documentation**                       | Document those source-of-truth distinctions.                                                                                                                                                                           |             Small |


Stage 15 and Stage 18 need one precise distinction

There are really three different things:

Public offer terms can change through versioning.

Pending manual request terms cannot change after the dam owner submits the request. A V2 request remains a V2 request even if V3 is published.

Accepted contract terms cannot change after acceptance, whether acceptance was Automatic or Manual.

However, for a manual request, Stage 18 should still evaluate the dam at the moment the stud owner approves it. The immutable request says what standards apply; approval checks whether the dam still meets those exact standards.

After acceptance, we do not go look at V3, V4, newly added PATELLA requirements, etc.

So:

Offer V2
→ dam submits Manual Request using V2
→ owner publishes Offer V3
→ request still uses V2
→ approval evaluates against V2
→ accepted contract permanently contains V2 terms.

That distinction should be explicit in 15/16/18.

Stage 28 now becomes the only real unresolved area

Your existing Stage 28 already correctly flags several questions, including what happens if the sire dies/sells/retires. I would expand it before reaching that stage to include:

Original sire

dies;
is sold;
retires/permanently becomes breeding unavailable.

Original dam

dies;
is sold;
retires/permanently becomes breeding unavailable.

Ownership

does the return-service right belong to the original kennel or travel with the dam?
can a new owner exercise it?

And one distinction that we should explicitly decide there:

Does exercising a return service re-check current biological/health conditions, while keeping the contract terms themselves immutable?

I think the answer should almost certainly be yes for current biological safety/availability, because contract immutability cannot make a dead, pregnant, recovering, breeding-inactive, or medically ineligible dog breedable.

There is also brucellosis. Unlike a permanent hip result or a championship title, brucellosis status can be time-sensitive. So we should not accidentally write a rule now that says “nothing whatsoever is re-evaluated on a return breeding.” Better wording is:

The accepted contract's requirements never change. Whether the dogs are currently able to perform a later return breeding is a separate ordinary eligibility question.

Then Stage 28 decides exactly which current statuses must be rechecked and what happens to the credit if the original pairing becomes permanently impossible.

Stage 32 should become very explicit

I would change its intent from merely “remove old flags” to:

The new contract path must never consult aggregate health-status indicators or legacy DogListing health requirement flags. Contract health qualification is determined solely from the immutable per-test requirement snapshot.

The existing green checkmark can absolutely remain elsewhere in the game. It answers:

“How is this dog's overall health-testing status?”

It does not answer:

“Does this dog meet this particular stud contract?”

Those are now intentionally separate systems.

Stage 33 should gain a few specific regression locks

The final regression suite should include cases equivalent to:

HIP Green only + HIP Green → pass.
HIP Green only + HIP missing → fail.
HIP Green only + HIP Green + CARDIAC Red where CARDIAC is No restriction → pass.
HIP No restriction + HIP Red → pass contract health requirement.
CARDIAC Green/Yellow + Yellow → pass.
CARDIAC Green/Yellow + Red → fail.
newly introduced PATELLA can be configured without evaluator changes.
overall “all-health-tests-green” checkmark does not affect contract qualification.
CH_OR_HIGHER accepts CH/GCH/GCHS/GCHP/etc.
GCH_OR_HIGHER rejects CH but accepts all recognized GCH tiers.
V2 pending request remains V2 after V3 publishes.
accepted V2 contract remains V2 after V3/V4 publishes.

# STUD CONTRACT IMPLEMENTATION PLAN — WHELP-TIME RULE REVISION

This section supersedes conflicting Stud Contract implementation-plan instructions written before the whelp-time contract rule revision.

The existing implementation through STUD-CONTRACT-27 was originally built around:

- Day-8 neonatal qualification;
- surviving-puppy litter counts;
- selection opening after neonatal Week 1;
- rolling 24-real-hour selection windows.

Those assumptions are now superseded.

The implementation must be corrected beginning with the Stage 20 lifecycle before STUD-CONTRACT-28 is implemented.

---

## Revised authoritative timing and qualification model

### Whelping is the contract litter-qualification event

When the canonical litter is created:

persist the number of puppies born alive.

This live-born count becomes the immutable contractual litter-size fact.

Use that same fact for:

- Puppy Back minimum qualifying litter;
- Small-Litter Return Service threshold.

Do not wait until Day 8.

Do not recompute contractual litter size after neonatal deaths.

Do not use later surviving puppy count for either contract threshold.

Neonatal mortality remains unchanged as biological simulation.

### Puppy selection opens from litter creation

Puppy Back selection no longer waits for the neonatal mortality window.

If Puppy Back applies and the immutable minimum live-born litter size was met:

create/open the selection workflow from the litter-creation lifecycle.

### Fixed age-anchored ordinary deadlines

First Pick:

- stud turn available after litter creation;
- deadline = litter birth timestamp + 24 real hours.

Second Pick:

Dam protected first pick:

- available after litter creation;
- deadline = litter birth timestamp + 24 real hours.

Stud second pick:

- becomes actionable when dam selects or the dam right is forfeited;
- deadline is ALWAYS litter birth timestamp + 48 real hours.

Do not calculate:

`stud turn start + 24 hours`

for normal Second Pick.

If the dam chooses early:

- stud may act immediately;
- deadline remains birth + 48 hours.

If dam selection expires:

- stud turn opens;
- deadline remains birth + 48 hours.

These deadlines are predictable from puppy age.

### Absolute selection/reselection boundary

Day 56 / beginning of Week 8 remains the absolute outer contract puppy-selection boundary.

Normal picks use their 24h/48h age-anchored deadlines.

The broader Day-56 window is principally relevant to selected-puppy death/reselection.

A death-driven stud reselection may receive up to 24 real hours but cannot extend beyond Day 56.

Use the earlier of:

- reselection opened + 24 real hours;
- canonical Day-56 cutoff.

---

## Revised Stage 20

STUD-CONTRACT-20 must now make litter creation the authoritative contract qualification event.

Required authoritative facts:

- linked StudContract ↔ Litter;
- litter creation/birth timing;
- immutable live-born puppy count;
- Puppy Back minimum result;
- Small-Litter Return Service result.

Existing Day-8 qualification fields/semantics must be audited.

Do not leave an active second definition of contract qualification.

If existing field names are no longer semantically accurate, use the smallest safe schema/data migration needed to establish one clear source of truth.

Do not repurpose historically ambiguous fields silently.

No-litter remains a separate breeding terminal outcome.

---

## Revised Stage 21

Outcome classification remains derived and multi-dimensional.

Change its authority so:

- no-litter comes from canonical terminal no-litter BreedingAttempt states;
- qualified litter uses frozen whelp-time live-born facts;
- Puppy Back minimum uses live-born litter count;
- Small-Litter Return Service uses live-born litter count.

Puppy Back failure continues NOT to generate Return Service.

`CANCELLED` remains excluded from canonical no-litter states until production semantics explicitly define otherwise.

---

## Revised Stage 22

Existing selection-obligation persistence remains appropriate unless audit proves otherwise.

Preserve:

- WAITING
- DAM_FIRST_PICK
- STUD_PICK
- SELECTED
- FORFEITED
- UNFULFILLABLE
- COMPLETED
- currentActor
- turnStartedAt
- turnDeadlineAt
- damFirstPickDogId
- selectedDogId
- forfeiture timestamps
- completedAt

Do not redesign merely because the opening milestone changed.

---

## Revised Stage 23

Supersede:

`Open selection after neonatal window`

with:

`Open selection after litter creation / whelp-time qualification`

First Pick:

- state → STUD_PICK;
- actor → STUD_OWNER;
- deadline = litter birth + 24 real hours.

Second Pick:

- state → DAM_FIRST_PICK;
- actor → DAM_OWNER;
- deadline = litter birth + 24 real hours.

The selection workflow should open event-driven from litter creation where practical, with centralized lifecycle reconciliation as an idempotent safety net.

Do not wait for Day 8.

---

## Revised Stage 24

Existing candidate and selection rules remain authoritative:

First Pick:

- EITHER = all qualifying living puppies;
- MALE = qualifying males;
- FEMALE = qualifying females.

Second Pick dam turn:

- dam may select any current eligible puppy;
- stud sex restriction does not apply.

After dam selects:

- record damFirstPickDogId;
- immediately activate stud's turn;
- preserve the fixed stud deadline = birth + 48 real hours.

Do NOT replace that deadline with `selection time + 24 hours`.

If the dam selects immediately after birth, the stud can act immediately but retains the fixed birth+48h deadline.

---

## Revised Stage 25

Protection rules remain derived from outstanding selection state.

Timing changes do not alter core protection semantics.

Protection now begins earlier because Puppy Back selection begins at litter creation.

Natural neonatal mortality remains unblocked.

A selected puppy may die during the neonatal period.

---

## Revised Stage 26

Deadline processor must use persisted fixed age-based deadlines.

Dam timeout:

at birth + 24 real hours:

- dam protected first-pick right forfeited;
- damFirstPickDogId remains null;
- record forfeiture;
- if qualifying stud candidate exists, activate STUD_PICK;
- stud deadline remains the precomputed birth + 48 real-hour deadline;
- do NOT create a fresh 24-hour deadline.

Stud timeout:

at the persisted birth + 24h First Pick deadline
or birth + 48h Second Pick deadline:

- Puppy Back selection right forfeited;
- no puppy selected;
- no cash substitute;
- no penalty;
- no Return Service solely from timeout.

The lifecycle processor advances only rows whose exact persisted deadline is due.

---

## Revised Stage 27

Selected-puppy death/reselection remains event-driven from canonical mortality.

Changes:

- selected puppy may now die during neonatal Week 1 because selection can occur immediately after whelping;
- neonatal death is not blocked;
- neonatal death does not alter the frozen contractual live-born count;
- neonatal death does not create or revive Return Service.

If selected puppy dies before Day 56 and another qualifying replacement exists:

- reopen stud selection;
- preserve immutable pick/sex terms;
- preserve prior Second Pick dam selection/forfeiture;
- player action required;
- deadline = min(reselection open + 24 real hours, Day-56 cutoff).

If no candidate exists or Day 56 has been reached:

- Puppy Back → UNFULFILLABLE;
- no cash substitute;
- no Return Service caused by the death.

---

# Revised STUD-CONTRACT-28 — Return Service Lifecycle

The Return Service decision gate is now resolved.

Return Service is one remaining entitlement under the original accepted Stud Contract.

It is NOT a new Stud Contract.

Implement:

### Trigger

At most one Return Service per original contract.

Trigger only from:

- canonical no-litter outcome when No-Litter Return Service was offered;
- whelp-time live-born count satisfying configured Small-Litter Return Service threshold.

Never trigger from Puppy Back failure.

### Duration

- 60 real days;
- fixed expiration;
- temporary unavailability does not pause/extend it.

### Identity

Requires:

- same sire;
- same dam;
- same original sire-owning kennel;
- same original dam-owning kennel.

Ownership transfer of either dog immediately extinguishes outstanding Return Service.

Death or canonical permanent breeding ineligibility of either dog also extinguishes it.

### Temporary unavailability

Does not extinguish:

- Stud Recovery;
- Breeding Inactive;
- temporary reproductive restriction;
- temporary/current health deficiency.

Attempt action should return actual current failure reason.

### Exercise

Player action:

`Attempt Return Service`

No:
- sire reservation;
- priority;
- Stud Recovery bypass;
- new Manual Approval;
- current public Stud Offer requirement.

Use original immutable agreement.

Recheck current biological/safety eligibility.

Time-sensitive requirements from the original agreement, especially brucellosis where required, must be current.

### Money

Do NOT charge stud-owner compensation again.

Normal non-stud breeding/system expenses remain applicable.

### Consumption

Return Service is consumed only when the replacement BreedingAttempt is successfully created.

Once created:

- Return Service is permanently USED;
- original contract cannot create another Return Service;
- outcome of return breeding can never generate another return.

### Event-driven extinction

Ownership change, death, permanent ineligibility, and expiration should update the entitlement when the event occurs rather than waiting for the player to attempt use.

Temporary eligibility remains derived/current-state presentation.

### Contract history

Add a durable My Stud Contracts player surface.

Requirements:

- both contracting kennels;
- newest first;
- 10 initially;
- Load More +10;
- historical resolved contracts retained;
- View Contract detail;
- separate contract lifecycle status from current Return Service availability.

### Required acknowledgment

The dam-owner acceptance flow must include the Player Obligations warning.

Confirm remains disabled until explicitly acknowledged.

Do not store this as a customizable contract term.

The acknowledgment confirms the player saw the fixed game-rule disclosure.

---

# Revised worksheet copy requirements

STUD-CONTRACT-06 Puppy Back must no longer say:

`selection begins after the Week 1 neonatal window`

It must explain:

- litter-size qualification uses puppies born alive at whelping;
- neonatal deaths do not alter contractual litter-size results;
- First Pick deadline is puppy age 24 real hours;
- Second Pick dam deadline is puppy age 24 real hours;
- Second Pick stud deadline is puppy age 48 real hours;
- the next player may act as soon as the prior selection is completed/forfeited;
- the fixed age-based deadline does not move;
- selected-puppy death may reopen the stud selection before Day 56;
- puppy-selection failure does not independently create Return Service.

STUD-CONTRACT-07 Return Service must explain:

- no-litter and Small-Litter Return Service only;
- Small-Litter threshold uses puppies born alive at whelping;
- neonatal/later deaths do not create Return Service;
- Puppy Back problems do not create Return Service;
- maximum one Return Service;
- 60-real-day expiration;
- same sire/dam/original kennels;
- ownership change/death/permanent ineligibility extinguishes it;
- temporary unavailability does not pause expiration;
- no reservation or priority;
- no second stud compensation;
- one successful Return Service BreedingAttempt consumes the entitlement permanently.

STUD-CONTRACT-10 Review & Publish must include the fixed fine print.

Dam-owner confirmation must include required Player Obligations acknowledgment.

---

# Revised cron architecture

Continue using one idempotent:

`/api/cron/process-stud-contract-lifecycle`

It may reconcile:

- manual approval expiry;
- whelp-time contract qualification missed by event-driven processing;
- selection opening missed by event-driven processing;
- due fixed puppy-selection deadlines;
- selected-puppy death/reselection recovery;
- Return Service expiration/reconciliation.

Event-driven transitions remain preferred when the triggering transaction already exists:

- litter creation → qualify contract/open initial Puppy Back selection;
- dam selection → activate stud Second Pick immediately;
- puppy death → reconcile selected claim;
- dog ownership transfer → extinguish Return Service;
- dog death/permanent ineligibility → extinguish Return Service;
- successful Return Service breeding → consume entitlement.

The cron remains deadline/reconciliation safety infrastructure.

---

# Corrective implementation order

Before implementing Return Service lifecycle, revisit the existing implementation in this order:

20R — Whelp-time qualification authority
21R — Outcome classifier authority
23R — Selection opening at litter creation
24R — Fixed Second Pick birth+48h deadline
25R — Protection regression after earlier opening
26R — Fixed age-based timeout processing
27R — Neonatal selected-puppy death/reselection regression

Stage 22 persistence should be audited but is not expected to require redesign.

After 20R–27R pass:

28 — Return Service lifecycle
28A — Return Service event-driven extinction
28B — Attempt Return Service action
28C — My Stud Contracts/history UI and required fine print/acknowledgment

Then resume:

29 — Selected puppy transfer decision gate
30–34 — legacy cutover and closeout.

Do not implement Stage 28 against the obsolete Day-8 qualification model.

