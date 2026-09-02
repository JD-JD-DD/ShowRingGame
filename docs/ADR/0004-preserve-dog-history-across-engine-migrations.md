# ADR-0004: Preserve Dog History Across Engine Migrations

Status: ACCEPTED

## Context

Simulation engines evolve, particularly genetics, phenotype precision, breed context, and judging. The project could regenerate existing dogs to match a new model, preserve only current identity while recalculating historical attributes, or migrate engines while preserving established records. Rerolling or reconstructing known historical dogs would destroy player trust, pedigrees, breeding evidence, and published competition truth.

## Decision

ShowRing permits future simulation-engine migrations, but preserves established dog identity and known historical state rather than silently rerolling existing dogs.

## Alternatives Considered

- **Regenerate existing dogs under the new engine.** Not selected because known phenotype, pedigree value, and player history would be rewritten.
- **Keep identity but recalculate historical outcomes from new inputs.** Not selected because results, awards, titles, health and breeding records are event-time facts.
- **Freeze all future engine evolution.** Not selected because the simulation can evolve through deliberate, versioned migration work.

## Consequences

### Positive

Engine improvements can coexist with durable dog identity, known phenotype, pedigree, reproductive, health, ownership, title, and result history.

### Tradeoffs / Costs

Migration work needs versioning, compatibility logic, data rehearsal, and explicit preservation tests; legacy and future-calculation paths may coexist.

### Required Invariants

- Preserve dog ID, registration, names, parentage/pedigree, breeder and ownership history.
- Preserve known phenotype and established genetics/version context as applicable; never silently reroll visible historical dogs.
- Preserve health, breeding/litter, title, award, and published-result history.
- New engine rules affect future calculations only through deliberately scoped, versioned migration/release behavior.

## Current Implementation Reference

Architecture: `docs/ARCHITECTURE/data-ownership.md`; `docs/ARCHITECTURE/domains/genetics.md`.

Current implementation: versioned genetics/phenotype and dog-history persistence; Post-Invitational migration/release design.

## Related Documentation

[Master File: Historical Preservation Rules](../PRODUCT/master-file.md#historical-preservation-rules) · [Master File: Breed Reference, Genetics, Phenotype, and Visible Ring Categories](../PRODUCT/master-file.md#breed-reference-genetics-phenotype-and-visible-ring-categories) · [data ownership](../ARCHITECTURE/data-ownership.md) · [ADR-0002](0002-event-time-historical-snapshots.md)
