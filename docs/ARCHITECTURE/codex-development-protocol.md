# Codex Development Protocol

## 1. Purpose

Architecture is part of everyday ShowRing development. Meaningful work must locate and preserve established authority before it changes code; the goal is focused implementation, not process overhead or stylistic uniformity.

## 2. Authority Order

1. **Design:** [Master File](../PRODUCT/master-file.md) defines what the game means.
2. **Architecture:** this directory identifies domains, canonical paths, persistence boundaries, and patterns.
3. **Durable decisions:** [ADRs](../ADR/README.md) preserve accepted choices.
4. **Operations:** [runbooks](../RUNBOOKS/README.md) define repeatable procedures.
5. **Current code:** confirms actual location and behavior before editing.

Documentation identifies intended authority but never replaces inspecting current implementation. Do not silently change LOCKED design; design changes require a deliberate Master File update, and genuine architecture changes require deliberate architecture documentation.

## 3. When the Full Protocol Applies

Use the full protocol for work affecting rules, eligibility, persistence, money, history, services, jobs, providers, authorization, public/hidden data, cross-domain behavior, canonical semantics, shared DTOs, reusable workflows, or architecture guardrails. It may be abbreviated for isolated copy, CSS, typo, one-line presentation, or test-only corrections with no rule/state impact. Abbreviated work still preserves known architecture.

## 4. Mandatory Pre-Change Routine

For meaningful work, in order:

1. Identify the primary owning domain and secondary affected domains in [domains.md](domains.md) and [dependency-map.md](dependency-map.md).
2. Read the relevant Master File section; classify applicable requirements as LOCKED, calibration, TBD, future, legacy, or discrepancy.
3. Check [canonical-rules.md](canonical-rules.md): consume an existing rule and preserve intentional variants rather than recreating semantics locally.
4. Check [canonical-services.md](canonical-services.md): for irreversible work use route/context → owning service → server revalidation → transaction/persistence → safe response.
5. When persistence is involved, check [data-ownership.md](data-ownership.md) for current, event, snapshot, integration, cache, historical, and downstream-consumer boundaries.
6. Check applicable [cross-cutting patterns](cross-cutting-patterns.md), including auth, batching, transactions, idempotency, DTO safety, provider boundaries, and read paths.
7. Check [architecture debt](architecture-debt-register.md): preserve resolved work, do not broaden bounded questions, and do not extend legacy paths.
8. Search [ADRs](../ADR/README.md) and preserve applicable accepted decisions.
9. Search current code for the closest domain precedent: validation, transactions, batching, safe DTOs, errors, and focused regression.
10. Identify proportionate affected consumers before changing shared semantics: pages, routes, services, jobs, providers, bulk/admin/historical paths, and focused tests.
11. Check [architecture regression guardrails](architecture-regression-guardrails.md) and run or extend relevant protection only when the boundary is affected.

## 5. Pre-Implementation Summary

Before editing, Codex should be able to state: owning domain; canonical rule and service; persistence/history boundary; relevant precedent; affected consumers; relevant guardrails; debt/legacy constraints; and the minimal implementation boundary. Do not create a separate artifact for this summary.

## 6. Implementation Standard

Prefer a One-Line Change or Minimal Change: one objective per stage, canonical reuse, intentional-variant preservation, hidden/public safety, historical preservation, batching, transaction boundaries, server-authoritative validation, accessible player feedback, and focused regression. Avoid unrelated cleanup.

If a canonical rule or service exists, consume or extend it rather than recreate its semantics locally. If repository evidence materially contradicts the documented path, stop the assumption and report the discrepancy; do not silently choose one or churn documentation merely because a path moved.

## 7. Cross-Domain Rules

When Domain B needs authority from Domain A, call Domain A’s established rule/service/helper unless documentation names an intentional variant. Do not copy conditions across domains. For example, Community may consume Support presentation but cannot define Support lifecycle; Market consumes Health/Contract/Lifecycle state; Stud Contracts and biological Breeding remain separate authorities.

## 8. Presentation / Read / Mutation Boundaries

Presentation may format, explain, preview, disable, and display derived state. It is never the sole authority for eligibility, ownership, money, lifecycle, provider state, or historical facts; irreversible server services revalidate current state.

Direct Server Component Prisma reads, read services, mappers, and presentation helpers are all accepted read variants. Do not introduce repositories, CQRS, internal HTTP, or a universal read service for neatness. UI and server paths need not share one DTO when their presentation needs differ.

## 9. Persistence and History

Identify current state versus event/snapshot/history before changing durable data. Do not recompute historical facts from current rules or repurpose historical compatibility fields as current authority. Preserve transactions for related durable writes, established batching, and event-time records.

For money, inspect [the Economy/Ledger audit](economy-ledger-invariant-audit.md): preserve signed per-kennel amounts, logical `balanceAfter`, transactional co-persistence, paired transfers, and valid faucets/sinks without inventing a universal Economy writer. For titles, inspect the title audits before altering semantic authority, presentation mirrors, or fallbacks. PLAYER_STUD is historical compatibility only; new commercial-stud behavior uses StudOffer/StudContract.

## 10. Regression and Architecture Guardrails

Meaningful work normally runs the smallest focused feature regression plus relevant architecture guardrail(s). Do not run every test or rewrite a guardrail for unrelated behavior. Preserve architecture boundaries including authority, hidden data, history, transactions, idempotency, and canonical semantics.

## 11. Validation

Implement narrowly, run focused tests, inspect the diff, run applicable guardrails, and run `git diff --check`. Use `pnpm run build` from `apps/web` when the change warrants a full build; do not substitute direct Prisma commands. If local pnpm state attempts a dependency purge/reinstall, do not allow it—use the established local `tsx.cmd` focused-test pattern and report the limitation.

## 12. Documentation Change Rules

Update architecture documentation only when domain ownership, canonical rule/service authority, persistence ownership/type, history semantics, established pattern, dependency, guardrail invariant, or durable decision genuinely changes. Update the Master File for deliberate design changes; ADRs for durable choices with meaningful alternatives; runbooks for operational procedures. Ordinary localized work should not churn documentation. Apply the proportional thresholds in [Documentation Maintenance](documentation-maintenance.md).

## 13. Standard Codex Prompt Shape

```text
We are making a [One-Line Change / Minimal Change / focused] update to [area].
Context: [authority and behavior to preserve]
Architecture: preserve docs/ARCHITECTURE/.
Owning domain: [domain]
Canonical authority: [rule/service/persistence]
Precedent: [closest implementation]
Stage goal: [one objective]
Required changes: [ordered changes]
Preserve / constraints: [boundaries not to touch]
Regression / validation: [focused tests, guardrail, diff/build]
Documentation: [update or explicitly no change]
Report: [files, behavior, validation]
```

Use this guidance proportionately; trivial prompts need not contain every heading.

## 14. Stop-and-Report Conditions

Stop the implementation assumption and report before broadening scope if the Master File conflicts with the request; canonical services disagree; docs materially contradict production code; the work changes history, extends legacy, resolves a TBD, creates competing semantics, unexpectedly crosses bounded debt, requires an unscoped migration/backfill, or broadens provider/economic side effects. Continue obvious safe portions where possible; do not silently solve the architecture question inside a feature patch.

## 15. Examples

**A. Minimal UI change:** correct a label locally after confirming it has no state/rule impact; preserve existing semantic status text and run the focused UI check if present.

**B. Canonical mutation:** add a Show-entry route option by resolving kennel context and delegating to `showEntry.service`; preserve server revalidation and run the Show-entry guardrail.

**C. Bounded cross-domain question:** add a monetary feature only after inspecting the Economy/Ledger audit and nearest transaction writer; preserve ledger invariants locally without proposing a universal Economy service.
