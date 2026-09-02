# Showing and Judging Architecture

## Purpose

Maps the flow from deterministic show schedule through authoritative entry, judging, publication, awards, and historical views. Design meaning belongs in the [Master File](../../PRODUCT/master-file.md).

## Domain Boundary

**Owns:** show calendar/cluster/day records, entries, judging finalization, results and awards.  
**Consumes:** game time, dog/lifecycle eligibility, conditioning snapshots, breed/judge data, economy effects, title rules.  
**Exposes:** scheduled events, authoritative entry disposition, published results/awards, historical competition context.

See [domains.md](../domains.md) for the complete boundary map.

## Canonical Paths

- **Rules:** `packages/rules/eligibility/showEligibility.ts`; judging/title helpers in `packages/rules`.
- **Services:** `showSchedule.service.ts`, `showEntry.service.ts`, `judging.service.ts`.
- **Persistence:** `ShowCluster`, `ShowDay`, `ShowEntry`, `ShowResult`, `ShowAward`.
- **Primary mutation routes:** canonical show-entry creation and judging finalization services.
- **Scheduled progression:** show-schedule maintenance and finalization jobs.
- **Presentation/read models:** show, kennel, and dog result read models.

## Lifecycle / Flow

`schedule maintenance → ShowCluster / ShowDay → entry eligibility and quote → durable ShowEntry with captured context → judging disposition/finalization → ShowResult + ShowAward → title/history consumers`

Entry-time and judging-time checks are intentional variants: eligibility may change between submission and event finalization. Do not collapse them without an explicit rule change.

## Cross-Domain Dependencies

- **Upstream:** Calendar & Game Time; Dogs/Lifecycle; Conditioning; Breeds/Genetics; Economy/Ledger.
- **Downstream:** Championships/Titles/Prestige; dog and kennel history; notices/presentation.

## Historical / Persistence Invariants

Cluster identity, entries, captured context, published results, and awards are historical facts. Never rebuild or rerate published results because later rules, breed groups, ownership, or title state changes.

## Intentional Variants

- Show-entry checks are submission-time; judging rechecks are event-time.
- Player-facing visible categories are not raw genotype or judge calculation internals.
- Hidden entries become visible only through the publication flow.

## Known Architecture Debt

Review `ARCH-DEBT-006` before creating another dog/show read model. The current domain is a distributed read surface, not permission to create competing state authority.

## Implementation Guidance

1. Read the Show and Judging sections of the Master File.
2. Use canonical entry/judging paths; do not write results or awards from a second finalizer.
3. Preserve entry snapshots, audit context, and publication permanence.
4. Check point/title consumers when changing award semantics.
5. Add focused regression coverage for boundary, idempotency, and historical behavior.

## References

[Master File](../../PRODUCT/master-file.md) · [canonical rules](../canonical-rules.md) · [canonical services](../canonical-services.md) · [data ownership](../data-ownership.md) · [dependency map](../dependency-map.md) · [patterns](../cross-cutting-patterns.md)
