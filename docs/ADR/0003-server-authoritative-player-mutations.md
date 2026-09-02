# ADR-0003: Irreversible Player Mutations Are Server-Authoritative

Status: ACCEPTED

## Context

Player UI can accurately explain eligibility, quotes, disabled reasons, and previews, but its information can be stale or manipulated before a durable action. Show entry, breeding, purchases/transfers, health testing, grooming, contracts, and bulk actions all change state that affects other systems. The alternative—treating the client presentation as authorization—would permit stale or bypassed eligibility.

## Decision

ShowRing authorizes and revalidates irreversible player mutations on the server immediately before persistence. Player-facing previews and disabled states are explanatory presentation, not mutation authority.

## Alternatives Considered

- **Trust client eligibility/preflight as sufficient authorization.** Not selected because state can change between rendering and submission.
- **Use one generic UI gate for every domain.** Not selected because biological, commercial, market, health, and event-time conditions are intentionally different rules.
- **Validate only at initial request time.** Not selected because scheduled/event-time paths may require a legitimate secondary recheck.

## Consequences

### Positive

Mutations preserve current ownership, balance, lifecycle, health, timing, and domain eligibility despite stale UI or concurrent actions.

### Tradeoffs / Costs

The server repeats some checks visible in the UI, and services must return clear failure reasons for changed state.

### Required Invariants

- UI state, DTO flags, and previews never bypass authoritative service validation.
- Mutation paths validate against current durable facts within their transaction/operation boundary.
- Intentional event-time or lifecycle rechecks remain separate from submission-time checks.
- Bulk operations revalidate each target rather than treating selection state as authority.

## Current Implementation Reference

Architecture: `docs/ARCHITECTURE/cross-cutting-patterns.md`; `docs/ARCHITECTURE/canonical-services.md`.

Current implementation: feature services for show entry, breeding, health/care, market, grooming, and contracts.

## Related Documentation

[Master File: Master Design Principles](../PRODUCT/master-file.md#master-design-principles) · [canonical services](../ARCHITECTURE/canonical-services.md) · [canonical rules](../ARCHITECTURE/canonical-rules.md) · [cross-cutting patterns](../ARCHITECTURE/cross-cutting-patterns.md) · [ADR-0007](0007-separate-biological-breeding-and-stud-contract-authority.md)
