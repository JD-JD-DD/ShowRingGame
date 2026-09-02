# Stage 10 — Canonicalization Closeout

## 1. Purpose

Stage 10 converted architecture-audit findings into surgical cleanup where evidence supported it and deliberately stopped where it did not. It closes the stage with documented boundaries rather than treating a debt register as a mandate to make all implementations look alike.

## 2. Completed Canonicalizations

| Finding | Issue and action | Invariant preserved | Final status |
| --- | --- | --- | --- |
| ARCH-DEBT-001 | Replaced a duplicate extended reproductive-recovery duration with the named lifecycle constant at the breeding eligibility gate. | One 365-hour extended-recovery rule. | RESOLVED — CANONICALIZED |
| ARCH-DEBT-003 | Replaced duplicate player age-display duration use with `SHOW_YEAR_HOURS`. | One game-year duration while retaining surface-specific output. | RESOLVED — CANONICALIZED |
| ARCH-DEBT-005 | Shared the elapsed scheduled-cancellation current-state predicate between Support and Community while retaining Community's batched reads. | Support retains lifecycle finalization; Community remains read-only and no-N+1. | RESOLVED — CANONICALIZED |

Stage 10 also repaired the narrow ARCH-DEBT-002 single-brucellosis transaction boundary: the Health-domain service co-persists screening, balance debit, and ledger history. That repair does not resolve the broader Economy/Ledger architecture question.

## 3. Investigated but Not Broadly Refactored

- **ARCH-DEBT-002:** Current accounting invariants are documented, but evidence does not support one universal writer, idempotency mechanism, or balance assertion abstraction. Feature-local transaction writers remain appropriate unless a concrete inconsistency is demonstrated.
- **ARCH-DEBT-004:** Current semantic title progress, historical awards/credits, title-prefix presentation mirror, and compatibility fallbacks are documented. Bounded legacy and presentation questions do not justify a title-system rewrite.
- **ARCH-DEBT-006:** Direct Server Component Prisma reads, services, mappers, and narrow helpers are legitimate read-model variants. The field-contract audit found no same-fact semantic drift, hidden-data leak, historical misuse, or material N+1 defect requiring a universal read layer.

## 4. Preserved Legacy

**ARCH-DEBT-007** remains **LEGACY — PRESERVE / DO NOT EXTEND**. `StudOffer`/`StudContract` is current commercial-stud authority. PLAYER_STUD linkage remains for historical compatibility only; new runtime code must not use it as current contract truth, while historical records and tests may read it where needed.

## 5. Current Active Architecture Questions

- **Economy/Ledger:** Preserve signed per-kennel ledger amounts, logical post-effect `balanceAfter`, transactional co-persistence, paired player transfers, recipient-only faucets, and payer-only sinks. A universal architecture remains intentionally unestablished.
- **Titles:** Preserve semantic current-title authority, historical award/credit authority, the prefix mirror, and compatibility fallbacks. Legacy reconciliation, completion metadata, historical current-name presentation, and producer suffix scope remain bounded questions.

Neither item is an immediate defect or authority for speculative refactoring.

## 6. Stage 10 Lessons / Implementation Rules

- Canonicalize confirmed same-rule duplication.
- Investigate UNKNOWN authority before refactoring.
- Preserve intentional variants and historical compatibility.
- Use shared pure semantics where batch and individual implementations must agree; do not replace batching with N+1 canonical calls.
- Direct Server Component Prisma reads are not debt by themselves.
- Keep one concrete concept per cleanup stage.

## 7. Stopping Rule

Stage 10 is complete when confirmed duplicate/divergent findings have been addressed where safe, remaining UNKNOWNs have bounded documentation, intentional legacy is identified, and no further cleanup is justified without a concrete feature, defect, migration, or explicit design decision.

Repository evidence now meets that condition. No further Stage 10 cleanup is justified.

## 8. Handoff to Stage 11

Stage 11 is **Architecture Regression Guardrails**: protect the architecture decisions and canonical boundaries established here rather than continue opportunistic cleanup.
