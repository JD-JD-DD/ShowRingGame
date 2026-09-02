# Documentation Maintenance

## 1. Purpose

Keep documentation accurate in proportion to real design, architecture, decision, or operational change. A normal feature must not become a documentation project, and **No documentation change required** is a valid, expected outcome.

## 2. Documentation Authority Map

| Change type | Authority | Update when | Do not update for |
| --- | --- | --- | --- |
| Product/game design | [Master File](../PRODUCT/master-file.md) | game meaning, rules, eligibility, player-visible system behavior, approved TBD/FUTURE, or deliberate historical-preservation design changes | refactors, implementation moves, documented-behavior bug fixes, tests, CSS, performance work |
| Implementation architecture | [Architecture docs](README.md) | canonical rule/service or domain ownership, persistence classification, history semantics, established dependency/pattern, guardrail, or debt status changes | local components/DTOs/queries/helpers within an unchanged boundary |
| Durable architecture decision | [ADR](../ADR/README.md) | meaningful alternatives create or supersede a durable future constraint | routine features, bug fixes, optimization, temporary details, decisions already dictated by an ADR |
| Operational procedure | [Runbook](../RUNBOOKS/README.md) | deploy, migration/backfill, recovery, repair, rollback, reconciliation, or administrative procedure changes | product rules, ordinary architecture, UI behavior, non-operational internals |

## 3. Master File Update Rules

Update the Master File when product meaning changes: a gameplay/eligibility/state rule changes, a new feature becomes approved current design, a TBD receives a decision, an economic model is approved, a locked preservation rule changes, or calibration meaning/range materially changes. Do not update it for implementation relocation, private refactoring, query optimization, test-only work, layout, or a bug fix restoring existing LOCKED design.

## 4. Architecture Update Rules

Update Architecture when implementation authority or stable architecture meaning changes: canonical rules/services move or change owner, domains/dependencies/persistence classification/history semantics change, a new established pattern or guardrail is introduced, or debt is discovered/resolved/reclassified. Do not document every surface DTO, local query optimization, private helper move, or exact reuse of an existing canonical path.

## 5. ADR Update Rules

Create or update an ADR only for a durable architectural decision with meaningful alternatives that constrains future work and needs a recorded rationale. Supersede or update an existing ADR when such a decision changes; do not silently contradict it.

## 6. Runbook Update Rules

Update a Runbook when an operator procedure changes. Runbooks answer “What does an operator do?” and do not own product rules, ordinary architecture, or UI behavior.

## 7. Changes Affecting Multiple Authorities

Each documentation layer has an independent threshold. An approved show-class system might update the Master File for rules and Architecture for service ownership, while requiring an ADR only for a durable alternative and a Runbook only for operational change. Do not update all layers automatically.

## 8. When No Documentation Change Is Required

**No documentation change required** is correct for typo fixes, semantics-preserving performance work, replacing local duplication with the same canonical helper, regression additions, documented-behavior bug fixes, responsive/accessibility work that preserves state semantics, and local refactors inside an unchanged boundary.

Completion reports may say: `Documentation: No update required — design and architecture are unchanged.`

## 9. Bug Fix Decision Rule

1. If implementation violates existing documentation, fix implementation; normally no design-doc update is needed.
2. If architecture documentation is objectively stale about the canonical path, update Architecture with the scoped implementation fix.
3. If requested behavior intentionally changes design, update the Master File as part of that approved change.
4. If documentation and production conflict and the correct authority is unclear, use the Codex Development Protocol stop-and-report rule; do not redefine design through a bug fix.

## 10. Calibration and Implementation References

Changing an explicitly tunable calibration value does not automatically require Master File churn. Update it when the value is itself recorded as canonical there, or when calibration role, range, or player/system semantics changes materially.

Master File Current Implementation References are informational pointers. Update Architecture first when a canonical path moves; update a Master pointer only when it is materially stale and misleading.

## 11. Documentation Quality Standard

Edit the smallest authoritative section; preserve stable IDs/headings and historical audits/ADRs; cross-reference rather than duplicate detailed rules; distinguish current behavior from history; avoid unmarked speculation; and keep player terminology consistent. Do not create a new document when an existing authority clearly owns the information.

## 12. Development Completion Check

After meaningful work, report proportionately:

- Master File: YES/NO — reason
- Architecture: YES/NO — reason
- ADR: YES/NO — reason
- Runbook: YES/NO — reason

This is an impact assessment, not a requirement to open or edit all four layers.

## 13. Examples

- **New feature:** an approved Grooming profession may update the Master File and Architecture; an ADR/Runbook only applies if its own threshold is met.
- **Local bug:** fix a Market health display consumer while the shared helper remains authoritative: Architecture and Master File updates are not required; add focused regression if useful.
- **Architecture move:** moving a canonical Support selector changes Architecture location documentation, not product design; an ADR is needed only for a broader durable decision.
