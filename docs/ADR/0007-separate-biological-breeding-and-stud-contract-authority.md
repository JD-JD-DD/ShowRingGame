# ADR-0007: Biological Breeding and Stud Contracts Are Separate Authorities

Status: ACCEPTED

## Context

ShowRing supports commercial stud offers and contracts alongside biological reproduction. A simpler architecture could let an accepted contract authorize breeding by itself, or combine offer and biological rules in one mutable authority. That would conflate commercial rights with current dog health, lifecycle, recovery, and reproductive facts that can change after a contract is accepted.

## Decision

ShowRing keeps biological breeding eligibility and commercial stud-contract authority separate. Stud contracts govern commercial terms and rights; they cannot redefine or bypass biological breeding validity.

## Alternatives Considered

- **Treat contract acceptance as final breeding authorization.** Not selected because health, care, lifecycle, recovery, and current reproductive state remain biological gates.
- **Put commercial terms inside biological eligibility.** Not selected because offer, request, approval, selection, return service, and deadlines are a separate lifecycle.
- **Depend on legacy `PLAYER_STUD` links as current authority.** Not selected because they are historical compatibility only.

## Consequences

### Positive

Commercial workflows can evolve without weakening biological safeguards, and biological rules remain reusable across contract and non-contract breeding.

### Tradeoffs / Costs

Contracted breeding involves coordinated validation and intentionally different checks at request, approval, execution, deadline, and whelping.

### Required Invariants

- Breeding owns biological age, health, lifecycle, recovery, and reproductive validity.
- Stud Services owns offers, contracts, commercial terms, selection and return rights.
- Both authorities may validate at their relevant stage; neither substitutes for the other.
- Legacy `PLAYER_STUD` records remain historical compatibility, never new live authority.

## Current Implementation Reference

Architecture: `docs/ARCHITECTURE/canonical-rules.md`; `docs/ARCHITECTURE/domains/stud-contracts.md`.

Current implementation: breeding eligibility/progression and stud offer/contract lifecycle services.

## Related Documentation

[Master File: Breeding, Pregnancy, Litters, and Puppy Management](../PRODUCT/master-file.md#breeding-pregnancy-litters-and-puppy-management) · [canonical rules](../ARCHITECTURE/canonical-rules.md) · [canonical services](../ARCHITECTURE/canonical-services.md) · [stud-contract guide](../ARCHITECTURE/domains/stud-contracts.md) · [ADR-0003](0003-server-authoritative-player-mutations.md)
