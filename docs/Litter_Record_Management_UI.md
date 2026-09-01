

# Litter Management — Feature 1 Implementation Plan

## Feature 1 — Litter Record Management UI

### Purpose

Upgrade the existing **Litter Record** from a primarily read-only litter view into the UI foundation for breeder litter management.

This stage does **not** implement litter naming, puppy naming, kennel-run movement, sale listing, re-homing, or bulk mutations.

It establishes the page architecture, permissions, current-state puppy presentation, selection model, and reusable inline-management framework that Features 2–4 will use.

The existing litter serial, litter membership, puppy registration numbers, pedigree relationships, lifecycle systems, ownership rules, sale rules, kennel-run rules, and dog-management services remain unchanged. Litter serial and puppy registration identity are already canonical parts of litter creation and must remain untouched. 

---

## Locked Behavior

### Management authority

The Litter Record has two effective experiences:

**Breeder management view**

* Available only when the viewing kennel is the breeder kennel for the litter.
* The breeder may eventually manage only puppies still owned by that breeder kennel.

**Public/read-only view**

* Used by all other viewers, including later owners of puppies from the litter.
* Contains no litter-management controls.

Breeder status alone does not permit management of a puppy after that puppy leaves the breeder's ownership.

---

### Puppy persistence

Every puppy remains represented in the litter permanently.

This includes puppies that are:

* living and breeder-owned;
* sold or transferred;
* deceased;
* re-homed/Forever Home;
* lost before placement;
* in future non-active historical states.

A puppy leaving the breeder's kennel must never disappear from its Litter Record.

The litter page should load current dog information rather than functioning as a frozen whelping snapshot. As applicable, puppy cards may therefore reflect current:

* call/registered name;
* registration number;
* titles;
* lifecycle state;
* owner;
* kennel run;
* sale/listing state.

Litter membership, parentage, and registration identity remain unchanged by ownership transitions. 

---

### Selection eligibility

Only puppies that are currently:

* alive/manageable;
* owned by the breeder kennel;

are structurally selectable.

Historical/non-manageable puppies do not receive a selectable control.

Examples:

* breeder-owned + alive → selectable
* sold/transferred → not selectable
* deceased → not selectable
* litter loss → not selectable
* Forever Home/re-homed → not selectable

Selection eligibility does **not** mean the dog will later be eligible for every management action. Features 3 and 4 will add action-specific eligibility.

---

### Selection UI

Feature 1 prepares selection structurally but does **not expose the bulk-management UI yet**.

Prepare support for:

* selectable puppy-card state;
* individual selection;
* `Select all eligible`;
* selected-count state;
* clear-selection behavior;
* future shared action workspace.

Do not display non-functional checkboxes or an empty bulk-action toolbar in Feature 1.

Feature 4 will expose those controls once real bulk actions exist.

---

### Puppy cards

Do not add individual action buttons to puppy cards.

Cards should continue to function primarily as dog-information panels.

Historical cards remain visually consistent with the current presentation, except they receive no future management checkbox.

The architecture should allow a selectable control to be added to breeder-owned manageable puppies without redesigning the card.

---

### Dog-page navigation

Each normal puppy Dog record should provide an obvious path to its Dog Page.

Preferred behavior:

* make the puppy's displayed name/registration identity a clear link; or
* provide a small `Open` control.

Do not make the entire card the only navigation target if that would later conflict with checkbox selection.

Lost-before-placement historical entries do not require a Dog Page link if no normal Dog record exists.

---

### Inline management foundation

Future management workflows remain **inline on the Litter Record**.

Do not introduce:

* modals;
* popovers;
* card-level action menus.

Reserve page structure for:

**Litter-level management**

* Feature 2 litter name
* Feature 2 private breeder note

**Puppy-selection controls**

* Select all eligible
* selected count

**Shared action workspace**

* Feature 3/4 naming
* kennel-run movement
* sale listing
* re-home

These areas do not need to be visibly empty before their features are implemented.

---

### Confirmation visibility

Feature 1 establishes the visual/accessibility standard for confirmation controls used by later litter-management actions.

Consequential/destructive confirmations must use:

* clearly visible primary confirmation buttons;
* clearly differentiated Cancel controls;
* sufficient contrast against the surrounding panel;
* visible keyboard focus;
* semantic buttons;
* descriptive confirmation text;
* no reliance on color alone.

Avoid generic confirmation text such as:

`Are you sure?`

Future confirmations should describe the actual effect.

---

### Success behavior foundation

Future mutations from the Litter Record should:

* remain on the current page;
* update affected puppy data in place;
* preserve scroll position;
* show concise success feedback;
* preserve unaffected selection when appropriate;
* remove a puppy from selection automatically if it becomes unmanageable.

Feature 1 should structure the client/page state so later features can support this without rewriting the page.

---

### Failure behavior foundation

The page must support inline action errors rather than requiring redirects.

Future errors should:

* remain associated with the relevant action workspace;
* state the actual failure reason;
* preserve unaffected input/selection;
* allow puppy state to refresh after stale-state failures.

The server remains authoritative.

---

# Staged Implementation

## Stage 1A — Current Litter Page Audit

### Goal

Document the current Litter Record data flow and identify the smallest reusable seams for management-mode support.

### Work

Audit:

* Litter Record route/page.
* Whelped Litters route/page.
* current litter query/service.
* puppy-card rendering.
* public versus authenticated litter access.
* current breeder and owner fields.
* lifecycle-state presentation.
* current title/name loading.
* kennel-run relationship loading.
* sale/listing-state loading.
* existing confirmation/button styles used by My Kennel and health-testing workflows.

Determine whether the current Litter Record already has a client component or whether a narrow client boundary will be needed for future selection state.

### Preserve

Do not modify:

* schema;
* litter generation;
* registration numbers;
* breeding/whelping;
* ownership;
* lifecycle;
* sale behavior;
* kennel-run behavior.

### Validation

Produce an implementation map identifying:

* current page/component files;
* data source;
* existing DTO shape;
* reusable components/helpers;
* minimum files likely to change in Stage 1B.

No gameplay changes in this stage.

---

## Stage 1B — Breeder Management Read Model

### Goal

Give the Litter Record enough server-authoritative information to distinguish breeder-management view from public/read-only view.

### Required behavior

Determine:

`isBreederView`

from the authenticated kennel and the litter's breeder kennel.

For every real puppy, provide sufficient current state to determine whether it is structurally manageable.

Conceptually expose information such as:

* dog ID;
* litter membership;
* current owner kennel;
* lifecycle/current state;
* current display name;
* registration number;
* current titles;
* kennel run if applicable;
* sale/listing state if applicable;
* `isManageableByBreeder`.

`isManageableByBreeder` means only that the puppy may participate in the future selection system.

It does **not** determine whether the puppy may be named, sold, moved, or re-homed.

### Security

Do not infer breeder management rights only in the client.

The server/read model must establish whether the viewer is the litter breeder.

### Preserve

Public viewers must continue receiving the public litter information required by the current page.

Do not expose private kennel-management data unnecessarily on the public version.

### Validation

Verify:

* breeder sees management-capable read model;
* buyer of a puppy sees only public/read-only litter;
* unrelated kennel sees public/read-only litter;
* breeder no longer receives puppy management eligibility after transferring that puppy;
* historical puppy remains visible.

---

## Stage 1C — Current-State Puppy Card Foundation

### Goal

Refactor or extend puppy cards so they can support future selection without changing their current primary presentation.

### Required changes

Ensure each real puppy card can render current:

* name;
* registration identity;
* titles where applicable;
* lifecycle/status;
* owner;
* kennel run where appropriate;
* current sale/listing indicator where appropriate.

Historical/non-active puppies remain cards in the litter.

Do not remove cards when a puppy:

* transfers;
* sells;
* dies;
* enters Forever Home.

### Navigation

Add or preserve a clear Dog Page link for normal Dog records.

Avoid making full-card click behavior interfere with the future checkbox area.

### Preserve

Do not add:

* Name button;
* Move button;
* Sale button;
* Re-home button;
* Actions menu.

### Validation

Check representative litters containing:

* breeder-owned living puppy;
* transferred puppy;
* deceased puppy;
* re-homed puppy;
* litter-loss entry;
* named/titled older offspring.

---

## Stage 1D — Hidden Selection Architecture

### Goal

Implement the reusable selection model Feature 4 will expose, without shipping unfinished selection controls to players.

### Required architecture

Prepare support for:

* set of selected puppy IDs;
* select one;
* deselect one;
* select all structurally eligible puppies;
* clear selection;
* selected count;
* automatic removal when a puppy becomes unmanageable;
* preservation of selection across safe local page updates.

Selection must be limited to puppies marked manageable by the breeder read model.

### Important constraint

Do **not** visibly render:

* checkboxes;
* Select All;
* selected-count bar;
* action toolbar.

Feature 4 will activate these controls.

The purpose of this stage is to avoid rebuilding the Litter Record when bulk management arrives.

### Validation

Focused component/unit coverage should verify:

* only manageable puppy IDs enter selection;
* historical puppies cannot enter selection;
* Select All uses only eligible breeder-owned puppies;
* stale/unmanageable IDs can be removed cleanly.

---

## Stage 1E — Inline Management Layout Anchors

### Goal

Prepare the Litter Record layout for Features 2–4 without showing empty or placeholder UI.

### Layout preparation

Establish stable locations for:

**Litter header/manage area**

* future litter name
* future private breeder note

**Puppy selection area**

* future Select All
* future selected count

**Shared action area**

* future Name
* Move Kennel Run
* Put Up for Sale
* Re-home
* inline forms and confirmation states

The layout should remain usable on desktop and mobile.

### Desktop priority

Do not convert management into overlay-driven interaction.

Keep sufficient horizontal space for the existing puppy panels and future inline forms.

### Accessibility

Ensure layout supports:

* semantic headings;
* keyboard navigation;
* visible focus;
* screen-reader labels;
* adequate text/button contrast;
* layouts that tolerate longer localized labels.

---

## Stage 1F — Confirmation/Action Visibility Foundation

### Goal

Correct the visual issue where confirmation controls can blend into their surrounding background and establish a reusable litter-management confirmation pattern.

### Required behavior

Use or create the smallest reusable style/component necessary for:

* primary confirmation;
* Cancel;
* disabled state;
* visible focus;
* error state;
* success state.

If an appropriate project-wide component already exists, reuse it rather than creating a litter-specific version.

### Important constraint

This stage must not introduce actual re-home/sale/move mutations just to demonstrate the component.

Apply the visibility correction only where existing litter-page confirmation controls currently need it, if such controls already exist.

### Validation

Check:

* desktop dark-theme visibility;
* keyboard focus;
* disabled-state readability;
* color is not the sole indicator;
* mobile tap target/readability.

---

## Stage 1G — Feature 1 Regression and Integration Validation

### Goal

Confirm that the architectural changes did not alter existing litter simulation or public behavior.

### Required regression coverage

Verify:

* litter serial remains unchanged;
* puppy registration numbers remain unchanged;
* litter parentage remains unchanged;
* breeder attribution remains unchanged;
* ownership remains unchanged;
* no puppy is deleted from litter history due to lifecycle/ownership state;
* public Litter Record remains read-only;
* breeder view is recognized correctly;
* transferred puppies are visible but non-manageable;
* deceased/re-homed/lost puppies remain visible and non-manageable;
* current names/titles/state load correctly;
* no hidden trait/genetic data is newly exposed;
* no visible unfinished bulk controls appear.

The existing engine already establishes litter serial, litter order, parent references, and registration-number creation; none of those outputs should change in this feature. 

### Project validation

Run the focused regression created for Feature 1, then the project's normal build validation.

---

# Feature 1 Completion Criteria

Feature 1 is complete when:

* the Litter Record reliably knows whether the viewer is the breeder;
* breeder management authority is separated from public litter viewing;
* every litter puppy remains permanently visible regardless of later status;
* current Dog data is reflected on puppy cards;
* only breeder-owned/manageable puppies are structurally eligible for future selection;
* the reusable selection state exists but is not yet exposed;
* the page has stable inline locations for later litter and puppy management;
* confirmation/action visibility meets the UI/accessibility standard;
* no new naming, sale, run, re-home, economy, lifecycle, pedigree, or breeding behavior has been introduced;
* current litter simulation and historical identity remain unchanged.

## Explicitly Deferred

**Feature 2**

* custom litter name;
* private breeder note.

**Feature 3**

* individual naming;
* kennel-run movement;
* sale listing;
* re-home mutations.

**Feature 4**

* visible checkboxes;
* Select All;
* selected count;
* bulk action bar;
* bulk mutations.

**Feature 5**

* breeder registered-name prefix system.

That sequencing gives us a clean **seven-stage Feature 1**, with the early stages mostly read-model/UI architecture and the final stages focused on presentation and regression protection. It also avoids building throwaway controls that Features 2–4 would immediately replace.
