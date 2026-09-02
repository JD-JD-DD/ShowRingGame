# ADR-0006: Championship Point Schedules Are Versioned Persisted Domain Rules

Status: ACCEPTED

## Context

Championship and Grand Championship scoring need historically reproducible thresholds that reflect observed competition. Plausible approaches included a universal static table, recalculating thresholds ad hoc in judging or presentation, or publishing durable annual schedules owned by the Championship domain and consumed at judging time. The latter is the deliberate Post-Invitational design because effective year, provenance, publication state, and historical awards matter.

## Decision

ShowRing treats Annual Championship Point Schedules as versioned, persisted Championship-domain rules. Judging consumes the applicable published schedule; presentation does not calculate thresholds, and later schedules do not rewrite prior awards.

## Alternatives Considered

- **Use a universal static point table.** Not selected; it was superseded by annual observed-competition schedules.
- **Recompute thresholds inside each judging or UI path.** Not selected because publication, provenance, exact key coverage, and historical repeatability require durable authority.
- **Treat draft schedules as authoritative.** Not selected because only a complete published schedule is live for the applicable year.

## Consequences

### Positive

Competition scoring is reproducible, historically explainable, and consistently shared by CH/GCH consumers and player reference views.

### Tradeoffs / Costs

The system requires annual publication lifecycle, exact completeness checks, sparse-resolution rules, and a fail-closed path for missing authoritative data.

### Required Invariants

- The canonical key includes effective year, district, breed, and sex.
- Only a published complete schedule is authoritative for its effective year.
- Judging consumes the applicable persisted schedule; UI reads it rather than calculating thresholds.
- Awarded points, competition context, and title credits remain historical snapshots.
- New schedules never backfill, rerate, or rewrite completed results.

## Current Implementation Reference

Architecture: `docs/ARCHITECTURE/canonical-rules.md`; `docs/ARCHITECTURE/data-ownership.md`.

Current implementation: annual schedule/publication persistence and judging/title point consumers.

## Related Documentation

[Master File: Show Classes, Championship Points, Titles, and Invitational](../PRODUCT/master-file.md#show-classes-championship-points-titles-and-invitational) · [canonical rules](../ARCHITECTURE/canonical-rules.md) · [data ownership](../ARCHITECTURE/data-ownership.md) · [ADR-0002](0002-event-time-historical-snapshots.md)
