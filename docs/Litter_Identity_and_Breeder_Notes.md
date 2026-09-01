Feature 2 — Litter Identity & Breeder Notes
Locked Business Rules
Litter management authority

Only the kennel identified by Litter.bredByKennelId may:

assign the litter's first custom name;
rename the litter;
create, edit, or clear the private breeder note.

Individual puppy ownership is irrelevant.

The breeder retains these rights even when:

some puppies have transferred;
every puppy has transferred;
puppies have died;
puppies have entered Forever Home;
no currently manageable puppies remain.

A puppy buyer or unrelated kennel never gains litter-metadata editing authority.

Custom litter name

The custom litter name is player-facing/public metadata.

Rules:

maximum 25 characters;
trim leading/trailing whitespace;
normal text characters and punctuation allowed;
plain text only;
preserve capitalization;
not unique;
do not automatically append Litter;
breeder may rename it indefinitely.

Examples:

C Litter
Humpty Dumpty
Storybook
Spring Repeat
1
Name permanence rule

customName is optional only until first assigned.

Once customName becomes non-null:

it may be replaced with another valid name;
it may never be cleared back to null;
blank input is invalid;
whitespace-only input is invalid;
no Remove Name UI exists;
no API/mutation path exists for removing it.

An unnamed litter may remain unnamed indefinitely.

An unnamed litter must also be able to save breeder-note changes without being forced to receive a custom name.

Canonical litter identity

serial7 remains the immutable canonical litter identity.

Custom naming must never change or participate in:

serial generation;
puppy registration-number construction;
database relationships;
litter IDs;
litterId;
litterOrder;
parentage;
breeder attribution;
registration uniqueness.

The custom name is presentation metadata only.

Display hierarchy

Where an existing player-facing interface primarily identifies a litter by serial:

Named litter

C Litter
Serial 6258828

Unnamed litter

Serial 6258828

For compact contexts where only one label fits:

named → C Litter
unnamed → Serial 6258828

The serial may remain secondary anywhere exact identification is useful.

Links continue routing through immutable litter IDs, never custom names.

Private breeder note

Rules:

private to breeder kennel only;
maximum 2,000 characters;
freeform;
multiline;
plain text;
no rich text;
editable indefinitely;
may be cleared;
no gameplay effect.

UI copy should explicitly communicate privacy, for example:

Private breeder note
Only your kennel can see this note.

The note must never be included merely because a player can see a public-facing litter name.

Staged Implementation Plan
Stage 2A — Litter Metadata & Display Reference Audit
Goal

Map the exact persistence, authorization, read-model, mutation, and display surfaces before changing code.

Audit

Identify:

current Litter Prisma model;
current litter migrations/conventions;
/litters/[litterId] detail service and DTO;
/litters archive/list DTO;
LitterCards;
all current player-facing uses of serial7;
all canonical/system uses of serial7;
litter selectors and references in breeding/stud-contract workflows;
APIs returning litter data;
existing breeder-authorized metadata mutation patterns;
existing inline Edit → Save / Cancel UI patterns;
validation/error conventions;
character-limit conventions;
shared formatting/helper patterns suitable for litter labels.
Classify serial usages

Each use of serial7 should be classified as:

Canonical/system identity

registration construction;
persistence;
uniqueness;
lookups;
internal relationships;
audit/debug data.

or:

Player-facing label

headings;
cards;
links;
selectors;
descriptive UI.

Only player-facing label uses are candidates for the custom-name hierarchy.

Special audit

Determine the smallest safe architecture for enforcing:

Once customName is non-null, it may never become null again.

This must be enforced server-side, not merely through UI omission.

Output

Produce the minimum change map for Stages 2B–2G.

No code changes.

Stage 2B — Litter Metadata Persistence
Goal

Add persistence for custom litter names and private breeder notes without changing canonical litter identity.

Schema

Add optional fields conceptually equivalent to:

customName
breederNote

to Litter.

customName

Storage semantics:

nullable because existing/new litters begin unnamed;
plain text;
preserves capitalization;
application validation maximum: 25 characters.

Null means:

This litter has never received a custom name.

Once a non-null value has been stored, later application behavior must prevent returning it to null.

Do not attempt to encode complicated first-assignment state separately unless the audit proves it necessary. The null/non-null transition itself should be sufficient.

breederNote

Storage semantics:

nullable;
plain text;
multiline;
application validation maximum: 2,000 characters.

Null means no private note.

Unlike customName, breederNote may transition freely between null and non-null.

Migration

Existing litters receive:

customName = null
breederNote = null

Do not backfill either field.

Preserve

No changes to:

serial7;
(breedCode2, serial7) uniqueness;
registration generation;
litter creation logic;
puppy creation;
parentage;
breeder assignment;
ownership;
lifecycle;
breeding/whelping.
Stage 2C — Breeder-Authorized Metadata Mutation
Goal

Create one canonical server-authoritative mutation path for litter name and breeder note.

Authorization

Mutation must load/verify the litter against the authenticated kennel.

Only:

Litter.bredByKennelId === viewerKennelId

may mutate the metadata.

Do not authorize through:

current puppy ownership;
Dog.ownerKennelId;
client-provided isBreederView;
hidden selection state;
route assumptions alone.
Name state machine
Unnamed litter + no entered name

Allowed when saving some other metadata such as the breeder note.

Result:

customName remains null.

Unnamed litter + valid entered name

Allowed.

This is the first assignment.

Result:

customName = normalizedName

From this point forward, the litter is permanently in the named state.

Named litter + valid replacement name

Allowed.

Result:

existing customName is replaced.

Named litter + blank input

Reject.

Named litter + whitespace-only input

Reject.

Named litter → null

Never allowed.

There must be no mutation option that interprets empty input, omitted input, null, or another sentinel as a request to remove an established name.

Name normalization/validation

Server must:

trim leading/trailing whitespace;
preserve internal spaces;
preserve capitalization;
allow ordinary punctuation;
enforce maximum 25 characters;
treat content as plain text;
impose no uniqueness requirement;
never automatically append Litter.
Breeder note

Server must:

accept multiline plain text;
enforce maximum 2,000 characters;
allow replacement;
allow clearing;
preserve line breaks;
have no simulation effect.

Use the project's existing normalization conventions for whether an empty note is stored as null or empty string; prefer canonical null storage if that matches nearby patterns.

Errors

Return specific expected errors such as:

Litter name must be 25 characters or fewer.
A named litter must have a litter name.
Private breeder note must be 2,000 characters or fewer.

Do not return only generic Invalid request messages when a specific validation reason is known.

Stage 2D — Metadata Read Models & Canonical Litter Display Label
Goal

Expose metadata through the correct read models while strictly separating public-facing name metadata from the private breeder note.

Breeder Litter Record DTO

May include:

customName;
serial7;
breederNote;
existing breeder-management context.
General/player-facing litter DTOs

Where a litter label is displayed, expose only what is needed:

customName;
serial7.

Do not propagate breederNote.

Privacy boundary

breederNote must not be added to:

Whelped Litters list DTO unless that view specifically needs the breeder's private note;
generic litter selectors;
breeding/stud-contract selector DTOs;
puppy-owner DTOs;
Market data;
Community data;
unrelated APIs;
client payloads that do not render/edit the note.

The safest default is:

only the breeder Litter Record management read path receives breederNote.

Canonical display helper

If Stage 2A confirms repeated label formatting, introduce the smallest shared presentation helper for concepts such as:

primary litter label;
serial secondary label.

Conceptually:

getLitterDisplayName(customName, serial7)

returns:

custom name when present;
otherwise Serial ${serial7}.

Do not build a generic litter identity framework.

Stage 2E — Inline Litter Record Editor
Goal

Implement breeder-facing metadata editing inside the Feature 1 litter-header seam.

Read state

Named litter:

C Litter
Serial 6258828

Unnamed litter:

Serial 6258828

Private-note area:

Private breeder note
Only your kennel can see this note.

When a note exists, display it in readable multiline form.

Edit interaction

Inline only.

Controls:

Litter name
Private breeder note
Save
Cancel

There is no Remove Name control.

No:

modal;
popover;
drawer;
browser confirmation.
Unnamed litter editing

The litter-name field may initially be blank.

The breeder can:

enter a first name;
leave it blank while editing only their breeder note.

Saving a blank name here leaves customName = null.

Named litter editing

Populate the field with the current name.

The breeder may:

keep it unchanged;
replace it with another valid name.

They may not:

blank it;
clear it;
remove it.

If they erase the field and press Save:

server rejects the request;
inline validation explains that a named litter must retain a name;
current persisted name remains unchanged;
entered form state remains available for correction.
Input behavior

Litter name

normal text input;
maxLength=25 as client assistance;
server remains authoritative;
optional character counter if consistent with existing project UI.

Private breeder note

multiline textarea;
maxLength=2000;
server remains authoritative;
preserve line breaks.
Save

One Save handles both fields.

On success:

update the litter metadata;
remain on the same page;
refresh/update the displayed state;
show concise success feedback;
avoid unnecessary redirects/scroll jumps.
Cancel

Discard local edits and restore persisted values.

No server mutation.

Accessibility

Use Feature 1F conventions:

semantic form controls;
connected labels;
visible focus;
readable disabled states;
specific inline errors;
role="alert" for errors;
appropriate role="status" for success;
mobile-friendly controls;
no color-only meaning;
layout tolerant of longer translated text.
Stage 2F — Existing Litter Label Propagation
Goal

Apply custom-name-first presentation to the game's existing player-facing litter references.

Known targets

At minimum audit and update:

Litter Record;
Whelped Litters;
LitterCards;
existing litter links;
existing litter selectors;
breeding/stud-contract litter references identified in 2A.
Named presentation

Where space supports primary + secondary identity:

C Litter
Serial 6258828

Compact presentation

Where only one label reasonably fits:

C Litter

Unnamed presentation

Serial 6258828

Important

Custom name supersedes serial only as the human-facing primary label.

It does not replace the serial in the data model.

Routing

Continue using:

/litters/[litterId]

or existing immutable identifiers.

Never:

build routes from the custom name;
use the name as a lookup key;
impose uniqueness to support routing.
Do not touch canonical serial uses

Do not replace serial7 in:

registration-number construction;
database uniqueness;
internal relationships;
generated registration data;
audit/debug information;
system code that requires exact litter identity.
Future systems

Do not build production-history UI or future selectors now.

Future features should reuse the same litter-label convention when added.

Stage 2G — Feature 2 Regression & Integration Validation
Goal

Validate permissions, name permanence, privacy, presentation, and simulation preservation.

Authority cases

Verify:

breeder can assign first litter name;
breeder can rename;
breeder can edit note;
breeder can clear note;
breeder retains authority after all puppies leave;
current puppy owner does not gain metadata rights;
unrelated kennel cannot mutate metadata.
Unnamed-state cases

Verify:

existing litter begins unnamed after migration;
unnamed litter may remain unnamed indefinitely;
unnamed litter may save/update a breeder note without receiving a name;
unnamed litter may receive its first valid name.
Name-permanence cases

After first naming:

valid rename succeeds;
blank replacement is rejected;
whitespace-only replacement is rejected;
explicit null removal attempt is rejected;
omitted/specially crafted request cannot clear it;
no UI Remove Name control exists;
no API route/action exists whose purpose is removing the name.
Name validation

Verify:

1-character value accepted;
25 characters accepted;

25 rejected;

surrounding whitespace trimmed;
capitalization preserved;
punctuation preserved;
duplicate name across two litters accepted;
HTML-like text is rendered inertly as text;
Litter is never appended automatically.
Note validation/privacy

Verify:

2,000 characters accepted;

2,000 rejected;

multiline retained;
clearing works;
breeder sees note;
note is absent from unrelated/general litter DTOs;
note is not exposed to puppy buyers;
note is not exposed merely because customName is player-facing.
Display hierarchy

Verify:

Named Litter Record

name primary;
serial secondary.

Unnamed Litter Record

serial primary.

Whelped Litters

same hierarchy.

Other audited existing references

custom-name-first behavior where appropriate.
Identity preservation

Verify no change to:

serial7;
litter ID;
breed code;
puppy registration number;
litterId;
litterOrder;
sire/dam;
bredByKennelId;
breederKennelId;
ownership.
Simulation preservation

Verify no change to:

breeding;
pregnancy;
whelping;
puppy creation;
mortality;
lifecycle;
Forever Home;
sale/listing;
kennel runs;
pedigree;
naming of dogs;
titles;
showing;
economy.
Build/regression validation

Run:

focused Feature 2 regression coverage;
relevant existing litter regressions;
normal project build through the project's established validation workflow;
git diff --check.

Repair only Feature 2 regressions discovered during validation.

Feature 2 Completion Criteria

Feature 2 is complete when:

litters may begin without a custom name;
breeder may assign a custom name at any later point;
after first assignment, that litter must always retain a valid custom name;
breeder may rename it indefinitely;
there is no name-removal UI or mutation path;
custom name is limited to 25 characters;
custom name is presentation metadata only;
serial remains immutable canonical identity;
breeder may store a private 2,000-character multiline note;
breeder note may be edited or cleared indefinitely;
only the breeder kennel can modify either field;
puppy ownership never changes litter metadata authority;
breeder retains authority after all offspring leave;
private note stays confined to breeder-management data;
existing player-facing litter references consistently prefer the custom name once one exists;
Litter Record editing is inline with Save/Cancel;
no public Litter Record page is created;
no registration, pedigree, breeding, ownership, lifecycle, sale, kennel-run, economy, or show behavior changes.

