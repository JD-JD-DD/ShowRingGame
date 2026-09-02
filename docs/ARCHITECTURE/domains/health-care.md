# Health and Care Architecture

## Purpose

Maps phenotype health testing, brucellosis/infectious-disease flows, ordinary and emergency veterinary care, reproductive emergencies, and their durable downstream effects.

## Domain Boundary

**Owns:** health eligibility/outcomes, disease/care events, emergency treatment and recovery records.  
**Consumes:** dogs/lifecycle, breed applicability, game time, kennel balance, breeding state.  
**Exposes:** health truth and action constraints to breeding, grooming, market/stud, pedigree, and presentation.

See [domains.md](../domains.md) for complete ownership.

## Canonical Paths

- **Rules:** health and action-eligibility helpers in `packages/rules` where defined.
- **Services:** `healthTest.service.ts`, `infectiousDisease.service.ts`, `emergencyVetCare.service.ts`, `reproductiveEmergencyTreatment.service.ts`; brucellosis screening route/service flow.
- **Persistence:** health-test, screening, disease, care, and reproductive-emergency models.
- **Primary mutation routes:** authoritative paid-test, screening, care, and treatment operations.
- **Scheduled progression:** health/care resolution where documented by the owning service/job.
- **Presentation/read models:** dog health, breeding, market/stud, and pedigree consumers.

## Lifecycle / Flow

`request or scheduled condition → dog/breed/maturity/current-state validation → payment/treatment transaction → immutable result or care event → eligibility/presentation consumers`

## Cross-Domain Dependencies

- **Upstream:** Dogs/Lifecycle, Breeds, Calendar, Economy/Ledger.
- **Downstream:** Breeding/Litters, Grooming, Market/Rehoming, Stud Contracts, dog/pedigree presentation.

## Historical / Persistence Invariants

Test outcomes, screenings, care and emergency records are immutable historical evidence. Preserve outcome, actor/cost, time, dog, and related reproductive effects.

## Intentional Variants

- Phenotype health tests and brucellosis are separate flows.
- Current internal health truth may differ from public-result fallback used for a presentation consumer.
- Ordinary care and reproductive emergency treatment have different lifecycle consequences.

## Known Architecture Debt

`ARCH-DEBT-002` applies to the transaction/balance boundary. Do not add a direct balance mutation or bypass the health operation's atomic path without inspecting current ledger behavior.

## Implementation Guidance

1. Read Health/Care and Lifecycle sections of the Master File.
2. Reuse the authoritative health/care service for the relevant action type.
3. Recheck eligibility at the server boundary; never trust a displayed health state as mutation authority.
4. Preserve immutable outcomes and downstream recovery/eligibility effects.
5. Test applicability, maturity, payment, idempotency, and historical presentation.

## References

[Master File](../../PRODUCT/master-file.md) · [canonical rules](../canonical-rules.md) · [canonical services](../canonical-services.md) · [data ownership](../data-ownership.md) · [dependency map](../dependency-map.md) · [patterns](../cross-cutting-patterns.md)
