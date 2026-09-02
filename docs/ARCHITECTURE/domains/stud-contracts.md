# Stud Contracts Architecture

## Purpose

Maps the commercial layer around stud offers, requests, accepted terms, selection rights, return service, deadlines, and retained legacy linkage. Biological reproduction remains owned by Breeding.

## Domain Boundary

**Owns:** stud offers/contracts and their commercial lifecycle.  
**Consumes:** dog/lifecycle eligibility, breeding attempts/litters, kennel ownership, economy, notices.  
**Exposes:** accepted commercial terms and derived player actions to the breeding flow and presentation.

See [domains.md](../domains.md) for complete ownership.

## Canonical Paths

- **Rules:** stud-offer/contract eligibility helpers in `packages/rules` where present.
- **Services:** stud-contract service family and breeding integration.
- **Persistence:** stud offer, contract, puppy-back selection, return-service, and historical linkage records.
- **Primary mutation routes:** offer/request/approval/decline, selection-right, and return-service services.
- **Scheduled progression:** deadline/contract progression where applicable.
- **Presentation/read models:** stud services/contracts and kennel/dog workflow views.

## Lifecycle / Flow

`offer/request → commercial validation → accepted terms → breeding attempt → pregnancy/whelping → selection or return-service resolution → completed historical contract`

Presentation status, current state, and action are derived from contract, breeding, pregnancy, litter, selection, and return-service facts; they are not an additional persistence authority.

## Cross-Domain Dependencies

- **Upstream:** Kennels, Dogs/Lifecycle, Economy/Ledger.
- **Downstream:** Breeding/Litters, Market/ownership, Notices, history.

## Historical / Persistence Invariants

Retain accepted terms, selection/return outcomes, linked breeding/litter history, and ledger history. Cancelled legacy `PLAYER_STUD` listings and their historical links remain compatible records.

## Intentional Variants

Commercial offer eligibility and biological breeding eligibility differ intentionally. Do not replace one with the other.

## Known Architecture Debt

`ARCH-DEBT-007` records historical `PLAYER_STUD` linkage as legacy compatibility. New code must not depend on it as live authority.

## Implementation Guidance

1. Read Stud Contracts and Breeding in the Master File.
2. Keep terms/lifecycle server-authoritative and derived UI state presentation-only.
3. Follow canonical contract services rather than direct attempt/listing mutation.
4. Preserve legacy records without fabricating current offers from them.
5. Test deadlines, idempotency, selection rights, and breeding handoff.

## References

[Master File](../../PRODUCT/master-file.md) · [canonical rules](../canonical-rules.md) · [canonical services](../canonical-services.md) · [data ownership](../data-ownership.md) · [dependency map](../dependency-map.md) · [patterns](../cross-cutting-patterns.md)
