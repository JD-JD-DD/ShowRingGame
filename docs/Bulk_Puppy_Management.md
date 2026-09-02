# Feature 4 — Bulk Puppy Management

## Staged Implementation Plan

### Stage 4A — Canonical Bulk Workflow Audit

**Goal**

Map the existing bulk-management implementations before changing the litter UI.

Feature 4 should reuse—not approximate—the game's existing bulk behavior.

**Audit current My Kennel behavior for:**

**Bulk naming**

* `BulkCallNameEditor` and related components;
* whether registered-name assignment is already part of that workflow or handled separately;
* per-dog row structure;
* request shape;
* validation handling;
* whether valid dogs can proceed when another row has invalid player input;
* mutation/service used;
* transaction semantics;
* result/error reporting.

**Bulk kennel-run movement**

* current `moveDogsToKennelRun` multi-ID behavior;
* current My Kennel bulk run UI;
* destination loading;
* how dogs already in the destination are handled;
* returned results;
* cleanup of empty automatic litter runs.

**Bulk sale**

* current My Kennel bulk-sale UI;
* exact price/configuration model;
* whether prices are per-dog, shared, or both;
* preview/preflight if one exists;
* canonical bulk service or loop/orchestration path;
* eligible/skipped behavior;
* transaction/economic behavior;
* result contract.

**Bulk re-home**

* current `KennelDogsPanel` bulk re-home flow;
* review/confirmation;
* eligible/skipped treatment;
* `rehomeOwnedDogs` multi-ID semantics;
* payout/ledger behavior;
* result contract.

**Bulk health-testing precedent**

* exact eligible/skipped preview pattern;
* reason presentation;
* zero-eligible handling;
* server revalidation;
* partial eligibility versus true execution failure;
* result summaries.

**Feature 3 integration**
Confirm the exact current shape of:

* `selectedIds: Set<string>`;
* single-selection handler;
* dormant/generalized selection helpers;
* `activeAction`;
* four existing workspaces;
* four litter-scoped mutation routes;
* `actionEligibility`;
* refresh/reconciliation callbacks.

**Output**

Produce the minimum-change implementation map for 4B–4H.

**No code changes.**

This stage is important because the specification explicitly says bulk naming and bulk sale should inherit their current My Kennel behavior rather than have a new litter-only model. 

---

# Stage 4B — Unified Multi-Puppy Selection

## Goal

Turn Feature 3's visible single-selection behavior into the one unified selection model Feature 4 requires.

The underlying `Set<string>` already exists, so this should be primarily an interaction change rather than new architecture.

## Selection behavior

A manageable breeder-owned puppy retains its checkbox.

Change visible behavior from:

> selecting Puppy B replaces Puppy A

to:

> selecting Puppy B adds Puppy B to the existing selection.

Unchecking a puppy removes only that puppy.

The same model must support:

* one puppy;
* two or more puppies;
* every currently manageable puppy.

There is **no separate single-dog mode and bulk mode**. 

## Select All Eligible

Expose the Feature 1 selection helper as:

**Select all eligible**

Meaning:

> select every puppy currently satisfying `isManageableByBreeder`.

It does **not** mean every puppy card in the litter.

Historical dogs remain visible but cannot enter the selected Set.

## Existing selections

Selecting **Select all eligible** replaces/normalizes the selection to all currently manageable puppies.

Example:

* 6 historical puppies;
* 4 currently manageable;
* 2 already manually selected.

After **Select all eligible**:

> 4 puppies selected.

## Clear selection

Keep the existing:

**Clear selection**

It empties the Set and closes any current workspace.

## Count

Use locale-aware formatting/pluralization-ready presentation:

* `1 puppy selected`
* `4 puppies selected`

## Reconciliation

Preserve the existing mechanism:

* dog disappears → prune;
* dog becomes non-manageable → prune;
* safe display change → preserve selection.

## Preserve

Do not change:

* `isManageableByBreeder`;
* action eligibility;
* puppy cards;
* canonical actions;
* historical visibility.

---

# Stage 4C — Multi-Selection Action Partition & Review Foundation

## Goal

Make the existing four shared actions work against a selection of one **or many** dogs and establish the common **Eligible / Skipped** presentation model.

This stage should establish orchestration/presentation, not perform bulk mutations yet.

## Action partition

For the currently selected IDs, each action independently derives:

**Eligible**

* selected puppies whose server-derived action eligibility allows that action.

**Skipped**

* selected puppies whose server-derived action eligibility does not allow that action;
* paired with the existing specific disabled reason.

Examples:

For Sale:

> 5 puppies selected
> 3 eligible
> 2 skipped

Then:

* Puppy A — Available for sale at 8 weeks.
* Puppy B — Already listed for sale.

## Critical distinction

The partition is **action-specific**.

A puppy skipped for Sale may still be eligible for:

* Name;
* Move Kennel Run;
* Re-home.

Selection itself remains unchanged.

## Zero eligible

If an action has:

> 0 eligible

the action may be opened into its explanatory state if useful, but submission must be impossible and the reason(s) must be visible.

Do not silently do nothing.

## One puppy

The exact same partition architecture applies.

If one dog is selected:

* 1 eligible / 0 skipped;
  or
* 0 eligible / 1 skipped.

Do not branch into the old Feature 3 single-puppy architecture.

## Client/server distinction

The existing Stage 3B eligibility is useful for immediate display.

It is **not submission authority**.

Every bulk mutation will recompute eligibility server-side later.

## Presentation

Create a compact reusable presentation convention, not a giant generic framework:

* selected count;
* affected count;
* skipped count;
* concise skipped rows/reasons.

This can be a tiny UI helper/component if useful.

Do not create a universal gameplay `ActionEligibilityEngine`.

---

# Stage 4D — Unified Naming Workspace

## Goal

Extend the existing Name workspace from one selected puppy to one-or-many selected puppies while reusing canonical My Kennel bulk naming.

## Workflow

> Select puppies → Name → per-puppy naming rows → Save

Each eligible selected puppy gets its **own** row.

Conceptually:

| Puppy   | Call name | Registered name     |
| ------- | --------- | ------------------- |
| Puppy 1 | input     | input               |
| Puppy 2 | input     | input               |
| Puppy 3 | input     | permanent/read-only |

Bulk naming does **not** assign one shared name.

## Canonical behavior

Reuse the audited My Kennel bulk naming path.

Do not duplicate:

* call-name validation;
* call-name clearing;
* registered-name normalization;
* uniqueness;
* permanence;
* restricted-name rules.

## Registered names

Per puppy:

* still assignable → editable field;
* already assigned → current registered name + permanence explanation.

Call name can remain editable independently.

## Server revalidation

Each submitted puppy must independently recheck:

* breeder-of-litter authority;
* membership in this litter;
* current ownership;
* current canonical naming eligibility.

Expected action ineligibility becomes skipped.

Canonical **player-entered naming validation** should follow whatever semantics Stage 4A finds in the existing My Kennel bulk naming system.

Do not invent different partial-save rules.

## Success

Affected dogs remain selected.

Refresh names/current card state.

Keep skipped dogs selected too—they may still be useful for another action.

Provide concise result status.

---

# Stage 4E — Unified Kennel Run Workspace

## Goal

Extend Move Kennel Run to one-or-many selected puppies.

## Workflow

> Select puppies → Move Kennel Run → choose one destination → review eligible/skipped → Confirm Move

## Destination

Continue fetching breeder-owned runs from the canonical existing run endpoint.

One selected destination applies to all affected puppies.

## Eligibility

At submission, server independently checks every selected dog:

* breeder authority;
* litter membership;
* current ownership;
* destination ownership;
* canonical run rules.

## Already in destination

Treat a dog already assigned to the chosen destination as a predictable **skip/no-op**, not a failure of the other dogs.

Example:

> 4 puppies selected
> 3 will be moved
> 1 already in Young Dogs

## Mutation

Reuse canonical multi-ID:

`moveDogsToKennelRun`

Do not individually write `kennelRunId`.

Do not implement litter-run cleanup separately.

## Success

* affected cards show new run;
* selection remains;
* skipped dogs remain selected;
* one concise result summary.

Example:

> **Kennel run updated**
> 3 puppies moved to Young Dogs. 1 skipped.

---

# Stage 4F — Unified Bulk Sale Workspace

## Goal

Extend Put Up for Sale to one-or-many selected puppies using the **existing My Kennel bulk-sale workflow** discovered in 4A.

## Workflow

> Select puppies → Put Up for Sale → configure canonical listing values → review eligible/skipped → create listings

## Pricing/configuration

This is deliberately determined by current canonical behavior.

If My Kennel currently supports:

* individual prices → use individual prices;
* common price/value application → use that;
* both → preserve both.

Do **not** choose a new model specifically for litters. 

## Eligibility

Per puppy, canonical sale eligibility remains authoritative.

Expected skips include:

* under 56 game hours;
* already listed;
* no longer owned;
* pending veterinary care;
* stud-selection protection;
* active breeding conflict;
* other canonical restrictions.

The 56-hour threshold remains canonical, not client-calculated.

## Existing listings

Never:

* edit;
* replace;
* remove;
* reset;
* relist.

An already-listed puppy is simply skipped.

## Partial eligibility

Example:

> 5 puppies selected
> 3 will be listed for sale
> 2 will be skipped

Those 3 proceed.

The two skips do not invalidate the operation.

## Economics

All:

* price validation;
* listings;
* market state;
* fees;
* ledger/economics;

remain canonical.

The litter bulk route should orchestrate existing market services, not recreate them.

## Success

* listed puppies remain selected because ownership remains;
* refreshed eligibility makes Sale unavailable for them;
* other actions remain available as appropriate;
* result summary lists affected/skipped counts and reasons.

---

# Stage 4G — Unified Bulk Re-home Workspace

## Goal

Extend Re-home to one-or-many puppies with explicit review and confirmation.

This is the highest-consequence bulk action.

## Workflow

> Select puppies → Re-home → review eligible/skipped → Confirm Re-home

## Review

Show exactly which dogs will be affected.

For example:

**Re-home 4 puppies?**

* Puppy A — registration
* Puppy B — registration
* Puppy C — registration
* Puppy D — registration

Also show skipped selected puppies separately if any.

## Consequence copy

State clearly that affected puppies:

* leave the breeder's active kennel;
* are not casually recoverable;
* remain preserved in pedigree and litter/history records.

## Confirmation

Use:

**Confirm Re-home 4 Puppies**

**Cancel**

For one puppy, naturally use singular:

**Confirm Re-home**

or the existing single-puppy label.

No modal/popover/browser confirm.

## Server revalidation

Individually recheck every selected dog.

Expected ineligibility is skipped.

Eligible dogs proceed.

Unexpected canonical/service/database failure is a **real failure**, not converted into a skip. This distinction is explicitly locked in the Feature 4 specification. 

## Mutation

Reuse canonical `rehomeOwnedDogs` multi-dog behavior.

Do not duplicate:

* lifecycle transition;
* listing cleanup;
* owner clearing;
* run clearing;
* litter-run cleanup;
* return-service cleanup;
* payout/ledger logic.

## Success

Affected dogs:

* remain visible historically;
* lose checkbox/manageability;
* are automatically pruned from selection.

Skipped/manageable puppies remain selected.

Example:

5 selected, 3 re-homed, 2 skipped:

After refresh, the 2 still-manageable dogs remain selected.

That follows the locked rule that operations should not unnecessarily destroy a useful selection. 

---

# Stage 4H — Server Revalidation, Partial Success & Result Contract Hardening

## Goal

Normalize the bulk orchestration behavior across all four actions without creating a new gameplay rules engine.

## Server input

Bulk routes receive immutable dog IDs plus action-specific player configuration.

They must never receive trusted:

* eligibility;
* owner ID;
* breeder ID;
* lifecycle;
* market state;
* age.

## Per-puppy submission revalidation

For every selected ID:

1. belongs to requested litter;
2. viewer is that litter's breeder;
3. breeder still owns dog;
4. current lifecycle/state permits management;
5. canonical action-specific eligibility passes.

## Classify outcomes

### Eligible / affected

Canonical action succeeds.

### Expected skip

Examples:

* ownership changed;
* too young;
* already listed;
* action no longer applies;
* already in destination run.

Record:

* dog identity;
* concise safe reason.

Continue with other eligible dogs.

### Unexpected failure

Examples:

* database error;
* broken transaction;
* malformed canonical service result;
* unexpected service exception.

Do **not** turn this into:

> skipped

Surface a real action error.

Exactly how atomic failure is handled should follow the existing canonical bulk action semantics identified in Stage 4A; do not invent a different cross-action transaction policy.

## Result shape

Use a small consistent response concept where practical:

* requested count;
* affected count;
* skipped count;
* skipped dog IDs/player identities + reasons.

Do not create a giant generic bulk-operation framework if the four existing services naturally return slightly different details.

## Result UI

After successful action:

**Sale listings created**
3 puppies listed. 2 skipped.

Then optional concise skipped rows.

Use `role="status"` for the result.

Expected failures within an active form use `role="alert"`.

## Selection reconciliation

After authoritative refresh:

* Name → affected/manageable dogs stay selected;
* Move → affected/manageable dogs stay selected;
* Sale → affected/manageable dogs stay selected;
* Re-home → affected dogs disappear from selection;
* skipped but still-manageable dogs remain selected;
* no-longer-owned skipped dogs prune naturally.

---

# Stage 4I — Bulk Workspace / Accessibility Integration

## Goal

Polish the now-unified one-or-many workflow and remove any residual Feature 3 assumptions that only one puppy can be selected.

## Audit/fix

Review all four workspaces for assumptions such as:

* `selectedPuppy`;
* singular-only headings;
* single registration number;
* single-result messages;
* one-ID request shapes;
* one-dog stale refresh assumptions.

Convert only those that now need one-or-many behavior.

## One action at a time

Continue using one `activeAction`.

No separate:

* bulkActiveAction;
* singleActiveAction.

## Draft lifecycle

Keep current simple rules:

* action switch → discard workspace draft;
* Clear selection → discard;
* selection changes → reconcile workspace inputs to current selected dogs according to action needs;
* no localStorage/sessionStorage/database drafts.

For naming specifically, the workspace may need to preserve unchanged rows when another manageable puppy is added/removed while the workspace is open **only if that falls naturally from the existing component design**. Do not build a complex draft reconciliation framework.

## Accessibility

Confirm:

* each selected checkbox has dog-specific label;
* Select all eligible semantic checkbox/button;
* selected count announced/readable;
* skipped reasons accessible;
* per-dog naming rows have unique connected labels;
* bulk confirmation lists are screen-reader readable;
* focus-visible remains on all controls;
* result summary uses semantic status;
* destructive re-home copy does not rely on color.

## Localization

Use plural-aware complete text:

* `1 puppy selected`
* `4 puppies selected`
* `1 puppy will be moved`
* `4 puppies will be moved`
* `2 puppies will be skipped`

Centralize repeated strings/helpers where practical, but do not introduce a translation framework.

---

# Stage 4J — Feature 4 Regression & Integration Validation

## Goal

Prove Feature 4 expanded the interface from one dog to many without changing the underlying dog-management rules.

## Selection

Verify:

* one dog works;
* several dogs work;
* Select all eligible works;
* historical dogs never select;
* selected count reflects manageable dogs only;
* Clear selection works;
* no separate single/bulk mode exists.

## Eligibility

For every action verify mixed selections:

* all eligible;
* some eligible/some skipped;
* none eligible;
* puppy becoming stale between render and submit.

Expected ineligibility must not block eligible dogs. 

## Naming

Verify:

* each dog receives separate fields;
* canonical naming validation;
* registered-name permanence;
* My Kennel bulk semantics preserved;
* no shared-name shortcut accidentally assigns identical names.

## Move

Verify:

* one destination;
* breeder-owned destination only;
* eligible dogs move;
* already-there dogs skip/no-op;
* cleanup remains canonical.

## Sale

Verify:

* `<56` skipped;
* `>=56` proceeds only if otherwise eligible;
* listed dogs skipped;
* existing listings untouched;
* canonical price/configuration preserved;
* economics unchanged.

## Re-home

Verify:

* review identifies every affected puppy;
* explicit confirmation;
* canonical multi-dog mutation;
* affected cards remain historically;
* checkboxes disappear;
* affected IDs prune from selection;
* skipped manageable IDs remain selected.

## Error classification

Verify:

**Expected rule failure**
→ skipped with reason.

**Unexpected technical/service failure**
→ actual operation error.

No technical error may be mislabeled as ordinary ineligibility.

## Feature 1 preservation

Verify:

* historical card model;
* `isManageableByBreeder`;
* selection reconciliation.

## Feature 2 preservation

Verify:

* custom litter name;
* breeder note privacy;
* metadata client boundary;
* serial identity.

## Feature 3 preservation

Verify:

* selecting exactly one puppy still provides the same four actions;
* no duplicate single-dog action interface;
* canonical litter-scoped action behavior remains;
* one workspace;
* stale refresh.

## Identity/simulation preservation

No changes to:

* `serial7`;
* registration;
* litter membership;
* litter order;
* parentage;
* breeder attribution;
* ownership semantics;
* lifecycle rules;
* sale economics;
* run rules;
* breeding/whelping;
* shows/judging.

---

# Feature 4 Completion Criteria

Feature 4 is complete when:

* only breeder-owned/manageable puppies are selectable;
* historical puppies remain visible but unselectable;
* the same Set-based selection supports one, several, or all manageable puppies;
* **Select all eligible** selects only currently manageable puppies;
* selected count reflects actual selected manageable dogs;
* there is no separate single-puppy and bulk-puppy management UI;
* each action independently partitions selection into eligible and skipped;
* skipped puppies and reasons are clearly communicated;
* zero eligible dogs prevents submission;
* expected ineligibility does not block eligible dogs;
* unexpected system/service failure remains an actual error;
* bulk naming provides per-puppy fields and reuses canonical My Kennel behavior;
* bulk Move Kennel Run sends affected puppies to one valid breeder-owned run;
* dogs already in that run can no-op/skip without blocking others;
* canonical automatic litter-run cleanup remains unchanged;
* bulk sale reuses the existing My Kennel pricing/configuration behavior;
* the 56-game-hour sale threshold remains canonical;
* existing listings are never edited/replaced by bulk sale;
* bulk Re-home provides explicit review and destructive confirmation;
* re-homed puppies remain historically visible;
* affected re-homed puppies automatically leave selection/manageability;
* Name, Move, and Sale preserve useful selection;
* skipped manageable puppies remain selected;
* stale/non-owned puppies prune after authoritative refresh;
* only one action workspace is open at a time;
* successful operations update cards in place;
* every operation gives a concise result summary;
* no modal/popover action workflow is introduced;
* all bulk mutations revalidate each puppy server-side;
* no new naming, run, sale, re-home, lifecycle, economy, pedigree, registration, breeding, or show rules are introduced;
* Feature 1, Feature 2, and Feature 3 remain intact.

