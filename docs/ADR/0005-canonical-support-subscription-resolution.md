# ADR-0005: Current Support Subscription Uses Canonical Lifecycle Semantics

Status: ACCEPTED

## Context

Provider subscription state includes changes, cancellation and paid-through periods. A current subscription is therefore a domain meaning, not merely an arbitrary row with an `ACTIVE` status. The project could select a convenient status row independently at each consumer, or resolve current state through the support lifecycle semantics and derive presentation from that result.

The architecture audit found an unresolved Community batch-selector parity issue. That finding does not undermine the accepted semantic decision; it identifies a consumer that must be checked against it.

## Decision

ShowRing determines a user's current Support subscription through canonical subscription lifecycle semantics. Presentation consumes that semantic result and does not define subscription truth.

## Alternatives Considered

- **Let each page or consumer query an arbitrary active subscription row.** Not selected because upgrades, cancellations, former supporters, and paid-through periods require lifecycle interpretation.
- **Make badge presentation the source of subscription truth.** Not selected because badge preference and cosmetic output are not provider lifecycle authority.
- **Treat the existing Community batch selector as proven equivalent without verification.** Not selected; `ARCH-DEBT-005` remains unresolved.

## Consequences

### Positive

Account, support, public-kennel, lifecycle, and future presentation consumers share one semantic definition of "current."

### Tradeoffs / Costs

Consumers performing bulk enrichment must preserve the same semantics efficiently; independent selectors require parity verification.

### Required Invariants

- Current state is interpreted from subscription/change/period/provider history, not an arbitrary status row.
- Badge preference and badge DTOs remain presentation-only.
- Provider lifecycle mutations and reconciliation preserve history and idempotency.
- `ARCH-DEBT-005` remains open until Community batch parity is proven.

## Current Implementation Reference

Architecture: `docs/ARCHITECTURE/canonical-rules.md`; `docs/ARCHITECTURE/canonical-services.md`.

Current implementation: support subscription lifecycle service and supporter-badge presentation boundary.

## Related Documentation

[Master File: Supporter Recognition and Breed Art Funding](../PRODUCT/master-file.md#supporter-recognition-and-breed-art-funding) · [canonical rules](../ARCHITECTURE/canonical-rules.md) · [canonical services](../ARCHITECTURE/canonical-services.md) · [architecture debt](../ARCHITECTURE/architecture-debt-register.md)
