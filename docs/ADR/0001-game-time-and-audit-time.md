# ADR-0001: Game Time and Audit Time Are Distinct

Status: ACCEPTED

## Context

ShowRing has both simulated time-sensitive rules and real operational records. Plausible approaches included using real database timestamps as the simulation clock, using an independent game clock while retaining audits, or mixing the two per feature. Mixing them would make eligibility vulnerable to time-zone/DST interpretation and make historic game-state reconstruction unclear.

Older design wording leaves some field-level time-model questions unresolved, but the durable distinction between simulation semantics and real audit metadata is established in current design and implementation evidence.

## Decision

ShowRing treats canonical game epochs and calendar semantics as simulation time. Real-world timestamps are operational and audit metadata; they do not replace simulation time for gameplay rules.

## Alternatives Considered

- **Use real `createdAt`/`updatedAt` timestamps as the simulation clock.** Not selected because real time-zone/DST behavior is not game-rule semantics and does not provide the required simulation calendar.
- **Let each domain choose simulation time or real timestamps independently.** Not selected because shared lifecycle, calendar, and event rules need reproducible common meaning.
- **Resolve every historic field-level time ambiguity in this ADR.** Not selected; that remains a Master File/design discrepancy rather than an accepted architecture decision.

## Consequences

### Positive

Simulation eligibility and calendar behavior are reproducible at a stated game epoch, independent of real-world clock presentation.

### Tradeoffs / Costs

Developers must distinguish two time types and format them clearly. Event-time calculations require careful choice of the applicable game epoch.

### Required Invariants

- Server-authoritative gameplay rules use game-time semantics.
- Historical game events retain relevant game-time context.
- Real timestamps remain useful audit metadata but are not silently substituted for game time.
- UI distinguishes game time from real time where both appear.

## Current Implementation Reference

Architecture: `docs/ARCHITECTURE/canonical-rules.md`; `docs/ARCHITECTURE/cross-cutting-patterns.md`.

Current implementation: game-clock and rules time helpers; integer `*Epoch` fields alongside audit timestamps.

## Related Documentation

[Master File: Time and Game Calendar](../PRODUCT/master-file.md#time-and-game-calendar) · [canonical rules](../ARCHITECTURE/canonical-rules.md) · [data ownership](../ARCHITECTURE/data-ownership.md) · [ADR-0002](0002-event-time-historical-snapshots.md)
