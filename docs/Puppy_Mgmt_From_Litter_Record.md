Feature 3 — Puppy Management From the Litter Record.

Feature 3 — Staged Implementation Plan
Stage 3A — Canonical Action & Eligibility Audit
Goal

Map the exact existing implementation seams for:

dog naming;
kennel-run movement;
sale listing;
Forever Home/re-home;
their server-side eligibility;
their UI interaction patterns;
their mutation/result contracts.
Audit

Identify for each action:

Name

current My Kennel naming component;
Dog Page naming path if separate;
canonical name mutation/service;
call-name vs registered-name fields;
rename semantics;
validation;
error contract.

Move Kennel Run

canonical run-assignment service/API;
destination-run query;
run ownership validation;
no-op/already-in-run behavior;
automatic litter-run cleanup behavior;
existing Dog Page/My Kennel UI.

Put Up for Sale

getDogSaleEligibility;
canonical listing service;
listing API;
My Kennel single-sale flow;
Dog Page flow;
pricing fields;
listing fees/economics;
PUPPY_SALE_MIN_AGE_HOURS = 56;
already-listed behavior.

Re-home

canonical Forever Home/Re-home service;
API route;
ownership/lifecycle validation;
kennel-run cleanup;
existing single and bulk confirmation UI;
post-success dog state.
Feature 1/2 integration audit

Confirm current litter-page architecture:

breeder-only server page;
isManageableByBreeder;
hidden selected-ID set;
LitterPuppyCardsClient;
LitterPuppyCard;
post-grid action-workspace seam;
current metadata editor remains separate.
Output

Produce exact Stage 3B–3H minimum-change map.

No code changes.

Stage 3B — Action-Specific Eligibility Read Model
Goal

Add server-authoritative, per-action eligibility to each breeder-owned puppy without treating structural manageability as universal action permission.

Add conceptually

For each real puppy:

canName
canMoveRun
canListForSale
canRehome

and, where useful:

nameDisabledReason
moveRunDisabledReason
saleDisabledReason
rehomeDisabledReason

Prefer a small structured eligibility object if that fits the repository better.

Base authority

Every action first requires:

viewer is litter breeder;
breeder currently owns puppy;
puppy belongs to this litter;
puppy is in a state compatible with the canonical action.
Critical rule

isManageableByBreeder === true only means:

this puppy may enter the selection system.

It does not mean all four action flags are true.

Eligibility reuse

Do not recreate action rules.

Eligibility should delegate to or mirror existing canonical helpers where available.

Especially:

sale → getDogSaleEligibility;
naming → current naming rules;
run movement → existing run ownership/state rules;
re-home → existing Forever Home eligibility.
Sale-age display

Too-young puppies remain structurally selectable but:

canListForSale = false;
reason should explain the actual condition, e.g. Available for sale at 8 weeks.

The underlying rule remains 56 game hours.

Stage 3C — Shared Single-Puppy Action Bar
Goal

Expose Feature 1’s hidden selection UI for one selected puppy and provide the shared action entry point that Feature 4 will later extend to multiple puppies.

Visible selection

For breeder-owned manageable puppy cards:

render checkbox;
one selected puppy may be managed.

At this stage, I would not yet expose Select All. That belongs cleanly to Feature 4.

Shared action area

When exactly one puppy is selected, show the shared inline action bar below the puppy grid:

Name
Move Kennel Run
Put Up for Sale
Re-home

No buttons inside puppy cards.

Disabled actions

If an action conceptually applies but is currently unavailable:

render disabled;
provide concise reason.

Example:

Put Up for Sale — available at 8 weeks

If an action fundamentally does not belong for the selected dog/state, it may be hidden if that matches existing project conventions.

Selection behavior
only isManageableByBreeder puppies get checkboxes;
historical cards remain checkbox-free;
selection remains ID-based;
stale/unmanageable selection still prunes automatically;
selecting another puppy replaces the current single selection for Feature 3, unless the existing architecture naturally permits multiple hidden selections without exposing bulk behavior.

This is one area I would lock carefully: Feature 3 UI should behave as single-selection even if the internal Set remains multi-capable for Feature 4.

Stage 3D — Name Puppy Workspace
Goal

Wire the litter action bar into the existing canonical single-dog naming behavior.

Interaction

Select puppy → Name → inline naming workspace.

Use exactly the current naming fields and semantics.

Reuse

Do not create litter-specific:

call-name validation;
registered-name validation;
rename rules;
character rules;
registration behavior.

The litter page should call the same canonical mutation path or service used elsewhere.

Future affix compatibility

Do not implement Feature 5 here.

The naming path must be routed through the canonical naming layer so that breeder-prefix restrictions added later automatically apply here too.

Success

After successful naming:

close workspace;
update puppy card identity;
preserve selection;
remain at same page position;
refresh authoritative state as needed.
Failure
inline specific error;
keep workspace open;
preserve entered values.
Stage 3E — Move to Kennel Run Workspace
Goal

Add the canonical single-puppy kennel-run move from the litter page.

Interaction

Select puppy → Move Kennel Run → inline workspace.

Display valid breeder-owned destination runs.

Authority

Server must recheck:

litter breeder;
puppy belongs to litter;
breeder still owns puppy;
destination run belongs to breeder;
existing run rules permit assignment.
Reuse

Use existing kennel-run service/API.

Do not create litter-specific rules.

Current run

Show current assignment where useful.

If selected destination equals current run:

treat according to canonical existing behavior;
ideally no-op/disabled rather than creating churn.
Cleanup

Do not manually implement litter-run cleanup here.

Existing kennel-run lifecycle remains responsible for deleting obsolete automatic litter runs where appropriate.

Success
card updates current kennel-run label;
workspace closes;
puppy remains selected/manageable.
Stage 3F — Put Up for Sale Workspace
Goal

Expose the existing single-dog sale-listing flow through the litter action area.

Eligibility

Use canonical sale eligibility.

A puppy must meet the existing sale rules, including:

breeder still owns dog;
dog is in sale-compatible lifecycle/state;
minimum age 56 game hours;
not already listed;
all other current market restrictions.
Too young

Still selectable for other actions.

Sale action disabled with reason.

Already listed

Sale action is unavailable.

Do not:

edit listing;
replace listing;
remove listing;
reset listing;
relist.
Workspace

Use the same current fields as canonical single-dog sale listing, including:

price;
visibility/type if current flow has it;
any existing fee or listing settings.

Do not simplify the listing form just because it is on the litter page.

Economics

All fees/debits/listing effects remain in the existing market service.

The litter page must not independently calculate or mutate sale economics.

Success
card market state updates;
workspace closes;
puppy stays selected because breeder still owns it;
sale action thereafter becomes unavailable because dog is already listed.
Stage 3G — Re-home Puppy Workspace
Goal

Expose canonical Forever Home/Re-home behavior with the Feature 1F inline destructive-confirmation standard.

Interaction

Select puppy → Re-home → inline confirmation.

Required copy

Identify the exact puppy by current name/reg number.

Explain that:

the dog leaves the active kennel;
the action is not casually reversible;
the dog remains preserved in:
this litter record;
pedigree;
historical records.
Controls
Confirm Re-home
Cancel

Clearly distinct.

No modal/popover/browser confirm.

Server

Reuse canonical re-home mutation/service.

Recheck:

viewer is litter breeder;
puppy belongs to litter;
breeder still owns puppy;
dog is currently eligible for Forever Home.
Success

After success:

puppy card remains;
lifecycle/state updates;
ownership/run information refreshes as canonical behavior dictates;
checkbox disappears because isManageableByBreeder becomes false;
selected ID is automatically removed;
workspace closes.

The master design explicitly treats Forever Home as removal from active play while preserving the dog historically/pedigree-wise.

Stage 3H — Shared Workspace State & Stale-State Handling
Goal

Make the four single-puppy workspaces behave consistently and safely.

One open workspace

At most one of:

Name
Move Kennel Run
Put Up for Sale
Re-home

may be open at a time.

Switching actions closes the current workspace.

Draft behavior

No complex draft system.

If practical, preserve unsaved local input while the page remains open, but do not introduce persistence or recovery infrastructure for drafts.

Server-authoritative stale state

Every mutation must recheck:

litter membership;
breeder authority;
current ownership;
current lifecycle;
action-specific canonical eligibility.

Example stale failure:

This puppy is no longer owned by your kennel.

After stale rejection
show specific error;
refresh authoritative puppy state;
prune selection if puppy is no longer manageable;
do not redirect.
Shared success/error behavior

Use Feature 1F conventions:

role="alert" expected errors;
role="status" success;
visible focus;
no color-only feedback;
preserve scroll position.
Stage 3I — Feature 3 Regression & Integration Validation
Goal

Validate the new litter-page entry points while proving no action business logic was duplicated or changed.

Authority

Verify every action rejects when:

viewer is not litter breeder;
breeder no longer owns puppy;
dog does not belong to litter.
Naming

Verify:

same call-name behavior as My Kennel;
same registered-name behavior;
same validation;
same rename behavior;
no litter-specific naming logic.
Run move

Verify:

destination must belong to breeder;
canonical assignment used;
current run updates;
automatic litter-run cleanup remains canonical.
Sale

Verify:

age <56 → unavailable;
age ≥56 → canonical eligibility;
already listed → unavailable;
existing listing untouched;
normal listing fields/economics preserved.
Re-home

Verify:

canonical mutation used;
destructive confirmation;
card remains after success;
dog becomes non-manageable;
selection clears.
Cards/current state

Verify cards continue to show current:

name;
registration;
titles;
lifecycle;
owner;
run;
market state.
Hidden genetics

No additional hidden trait/genetic fields reach the client.

Feature 2 preservation

Verify:

litter custom name/editor remains intact;
breeder note privacy unchanged;
serial7 unchanged;
no conflict between metadata client boundary and puppy-management client boundary.
Simulation preservation

No changes to:

registration;
pedigree;
breeder attribution;
ownership semantics;
lifecycle semantics;
market economics;
kennel-run rules;
breeding/whelping;
show systems.
Feature 3 Completion Criteria

Feature 3 is complete when:

a breeder can select one currently manageable puppy from their Litter Record;
no action buttons exist inside puppy cards;
the shared action area offers the four canonical actions;
action availability is per-action, not derived from one universal flag;
naming reuses canonical naming behavior;
kennel-run movement reuses canonical kennel-run behavior;
sale listing reuses canonical market behavior and the 56-hour minimum;
re-home reuses canonical Forever Home behavior;
every mutation rechecks breeder/litter/ownership/action eligibility server-side;
stale state produces a specific error and refreshed puppy state;
successful actions update the current card without removing historical litter membership;
re-homed puppies remain visible but lose selection/manageability;
one inline workspace is open at a time;
no modal/popover action model is introduced;
Feature 1 selection architecture is reused;
Feature 2 litter metadata/editor remains intact;
no new action business logic or gameplay rules are introduced.