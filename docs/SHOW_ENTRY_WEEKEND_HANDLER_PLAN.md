# Show Entry Weekend and Handler Plan

## Goal

A user should have 3 or 4 shows to choose from on a weekend. For example:

- Show A
- Show B
- Show C
- sometimes Show D

If a user chooses to show at Show A, that becomes their primary show for the weekend. They pay the kennel travel fee to that show once, plus entry fees, plus ringside handler fees only for dogs over the first 3 entered of each breed.

Example:

- 6 Bulldogs entered at the primary show: ringside handler fees apply to Bulldogs 4, 5, and 6.
- 6 Salukis entered at the primary show: ringside handler fees apply to Salukis 4, 5, and 6.
- The kennel pays one travel fee for the primary show.

If the user also wants to enter dogs at Show B or Show C, those are secondary shows. The kennel does not travel there directly. Every dog entered at a secondary show requires a traveling handler fee. If ringside handler fees are `$100`, traveling handler fees may be `$500` per dog.

Every dog in the user's kennel can be shown only once per weekend, but different dogs may be assigned to Show A, B, C, or D.

## MasterFile Alignment

The MasterFile already supports the shape of this system:

- Travel occurs at the kennel level during cluster attendance selection.
- Kennels choose clusters at the kennel level.
- Entry quotes include entry fees, travel, and handlers.
- Handlers are deterministic logistics and a money sink, not performance modifiers at launch.
- `OWNER_HANDLED_LIMIT = 3`.
- Future expansion includes travel handlers, handler availability, handler tiers, and handler professions.

## Target Model

The weekend becomes the core planning unit.

- A weekend has multiple show clusters.
- A kennel can choose one primary show for that weekend.
- The first entered show can automatically become primary in the MVP.
- Primary show fees:
  - entry fees
  - one kennel travel fee
  - ringside handler fees for dogs over the first 3 per breed
- Secondary show fees:
  - entry fees
  - traveling handler fees for every dog entered
  - no kennel travel fee
- A dog may only be entered once across the whole weekend.

## MVP Step 1: Weekend Identity

Add a shared weekend key helper.

The helper should identify all generated show clusters in the same game year/week as the same weekend, regardless of slot.

Examples:

- `generated-year-10-week-40-slot-1`
- `generated-year-10-week-40-slot-2`
- `generated-year-10-week-40-slot-3`

All map to:

```txt
year-10-week-40
```

This creates a stable foundation for later primary show plans, dog conflict checks, and weekend-level UI.

## MVP Step 2: Primary Show Plan

Add a persisted weekend plan:

```txt
KennelShowWeekendPlan
```

Suggested fields:

- `id`
- `kennelId`
- `weekendKey`
- `primaryClusterId`
- `travelFeeCharged`
- `createdAtEpoch`
- `updatedAt`

Rules:

- If a kennel submits its first entry for a weekend, that show becomes primary.
- Existing current behavior is preserved.
- Travel is charged once for the primary show.

## MVP Step 3: Primary Handler Math

Replace the current flat handler fee with per-breed ringside handler math.

Rule:

```txt
ringsideHandlerDogs = max(0, dogsEnteredForBreed - 3)
ringsideHandlerFee = ringsideHandlerDogs * RINGSIDE_HANDLER_FEE
```

This should be calculated per breed, not per whole cluster.

## MVP Step 4: Secondary Show Entries

Allow a kennel to enter different dogs in secondary shows during the same weekend.

Validation:

- The same dog cannot be entered in any other show that weekend.
- If the cluster is primary, use primary show fee rules.
- If the cluster is not primary, charge traveling handler fee for every dog.
- Do not charge kennel travel on secondary shows.

## MVP Step 5: Weekend Entry UI

Update the show-entry UX to show the weekend as a planning surface.

The page should make it clear:

- which show is primary
- which shows are secondary
- which dogs are already assigned to another show that weekend
- entry fees
- travel fee
- ringside handler fees
- traveling handler fees
- total cost
- projected balance

## Full Deployment: Named Handler Schedules

Later, add real handlers and schedules.

Suggested models:

```txt
Handler
HandlerSchedule
```

`Handler` fields:

- `id`
- `name`
- `tier`
- `travelingFeePerDog`
- `isActive`

`HandlerSchedule` fields:

- `handlerId`
- `weekendKey`
- `clusterId`

Secondary show entries would require an available handler for that show.

Examples:

- Handler Z is scheduled for Show B.
- Handler X is scheduled for Show C.
- The user selects an available handler and pays that handler's traveling fee per dog.

Capacity, specialties, reputation, and player-handler professions should come later.

## Safe Implementation Order

1. Add weekend key helper and focused checks.
2. Add `KennelShowWeekendPlan`.
3. Make first entered show become primary and charge travel once.
4. Change primary handler fee to per-breed over 3.
5. Allow secondary clusters with traveling handler fee per dog.
6. Add weekend-aware UI.
7. Add named handler schedules.

## Rule Wording

Use this wording going forward:

```txt
A dog may only be entered once per weekend, across all shows in that weekend.
```

A kennel may enter different dogs at multiple shows in the same weekend.
