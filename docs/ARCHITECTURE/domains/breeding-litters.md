# Breeding and Litters Architecture

## Purpose

Maps biological breeding eligibility, attempt progression, pregnancy/whelping, litter history, and puppy-management boundaries. It does not replace the design rules in the [Master File](../../PRODUCT/master-file.md).

## Domain Boundary

**Owns:** breeding attempts, pregnancy progression, whelping/litter creation, litter identity, puppy-management workflows.  
**Consumes:** dogs/lifecycle, genetics/pedigree, health/care, stud contracts, kennel ownership and economy.  
**Exposes:** reproductive state, litters/puppies, parentage, breeder attribution, and durable outcome history.

See [domains.md](../domains.md) for complete ownership.

## Canonical Paths

- **Rules:** breeding eligibility helpers in `packages/rules`.
- **Services:** `breeding.service.ts`; litter and puppy-management services.
- **Persistence:** `BreedingAttempt`, `Litter`, `Dog` and parentage relationships.
- **Primary mutation routes:** canonical breeding-attempt creation and progression/whelping flows.
- **Scheduled progression:** breeding-progress resolution.
- **Presentation/read models:** dog, litter, kennel, and stud-contract views.

## Lifecycle / Flow

`request → biological eligibility + ownership/contract validation → BreedingAttempt → scheduled progression → pregnancy/whelping → Litter + puppies → management / market / historical consumers`

Commercial approval and biological eligibility are distinct gates. A valid contract does not bypass health, lifecycle, recovery, or reproductive constraints.

## Cross-Domain Dependencies

- **Upstream:** Dogs/Lifecycle; Genetics/Pedigree; Health/Care; Stud Contracts; Kennels/Economy.
- **Downstream:** Market/Rehoming, Health records, Titles/history, player notices.

## Historical / Persistence Invariants

Preserve attempt, parentage, litter serial identity, breeder attribution, puppy registration relationships, health/reproductive outcome, and resulting dogs. Litter custom names are presentation metadata; they never alter serial, parentage, relationships, or registration construction.

## Intentional Variants

- Biological breeding eligibility versus commercial stud-contract eligibility.
- Public litter name versus breeder-only note.
- Current actionable puppy state versus historical litter visibility.

## Known Architecture Debt

Review `ARCH-DEBT-001` before changing extended reproductive recovery duration. It identifies a named-constant/literal duplication surface.

## Implementation Guidance

1. Read Lifecycle, Breeding, and Historical Preservation in the Master File.
2. Use canonical eligibility and attempt/progression services.
3. Revalidate all mutable facts server-side at the mutation boundary.
4. Preserve parentage and breeder ownership semantics through transfer, death, and Forever Home.
5. Test recovery, whelping idempotency, and historical reconstruction.

## References

[Master File](../../PRODUCT/master-file.md) · [canonical rules](../canonical-rules.md) · [canonical services](../canonical-services.md) · [data ownership](../data-ownership.md) · [dependency map](../dependency-map.md) · [patterns](../cross-cutting-patterns.md)
