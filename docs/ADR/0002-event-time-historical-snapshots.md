# ADR-0002: Event-Time Historical Snapshots Are Preserved

Status: ACCEPTED

## Context

ShowRing events depend on facts that later change: dog condition and ownership, competition counts, judging profiles/rules, accepted commercial terms, support periods, and medical/emergency context. Reconstructing a past event from mutable current state would corrupt player-facing history. A narrower decision to protect only published shows would leave the same architectural risk in contracts, care, and other event records.

## Decision

ShowRing stores event-time snapshots when a durable event depends on mutable facts. Published competition outcomes, awards, and their event-time context are historical truth and are not recalculated from later rules or current state.

## Alternatives Considered

- **Reconstruct historical meaning from current Dog, Breed, offer, title, or subscription state.** Not selected because those records legitimately change after the event.
- **Protect published show results only.** Not selected because contracts, care, support, and versioned simulation events have the same historical-context need.
- **Snapshot every related field indiscriminately.** Not selected; snapshots remain purposeful domain data, not a substitute for normal ownership or derived-state design.

## Consequences

### Positive

Historical results, awards, contracts, care, and integration periods remain explainable and stable across later gameplay/rule changes.

### Tradeoffs / Costs

Persistence carries intentional duplicated event context. Mutations and migrations must preserve snapshot semantics and avoid treating frozen fields as replaceable caches.

### Required Invariants

- `ShowResult`/`ShowAward` event context and published values are never rerated under newer rules.
- Entry-time, judging-time, accepted-contract, health/emergency, subscription-period, and version snapshots remain distinct from current state where the domain stores them.
- Current balance, ownership, title summary, profile, or subscription state must not substitute for historical records.
- Correction of historical facts requires explicit scoped authority; it is not an ordinary recalculation.

## Current Implementation Reference

Architecture: `docs/ARCHITECTURE/data-ownership.md`; `docs/ARCHITECTURE/cross-cutting-patterns.md`.

Current implementation: event/snapshot fields on show entries/results/awards, contract records, health/emergency records, and subscription history.

## Related Documentation

[Master File: Historical Preservation Rules](../PRODUCT/master-file.md#historical-preservation-rules) · [data ownership](../ARCHITECTURE/data-ownership.md) · [canonical rules](../ARCHITECTURE/canonical-rules.md) · [ADR-0001](0001-game-time-and-audit-time.md) · [ADR-0006](0006-versioned-championship-point-schedules.md)
