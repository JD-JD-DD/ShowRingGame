# ShowRing Architecture Documentation

> **Documentation status:** Current design/architecture reference as of the latest repository architecture sweep. Always verify current implementation paths in repository code before modifying them.

## Purpose

The [Master File](../PRODUCT/master-file.md) explains **what ShowRing means**. Architecture documentation explains **where ShowRing implements it**.

This directory documents current repository topology, domain boundaries, dependencies, persistence ownership, canonical rules and services, cross-cutting implementation contracts, and known architecture debt. It does not redefine gameplay design.

## Before Making a Change

1. Read [`docs/PRODUCT/master-file.md`](../PRODUCT/master-file.md) for design meaning.
2. Identify the owning domain in [domains.md](domains.md).
3. Check [canonical-rules.md](canonical-rules.md).
4. Check [canonical-services.md](canonical-services.md).
5. Check [data-ownership.md](data-ownership.md) when durable state is involved.
6. Check [dependency-map.md](dependency-map.md) for cross-domain impact.
7. Check [cross-cutting-patterns.md](cross-cutting-patterns.md).
8. Check [architecture-debt-register.md](architecture-debt-register.md) before touching a known debt surface.
9. Follow the proportionate [Codex Development Protocol](codex-development-protocol.md) for meaningful work.
10. Inspect the current referenced code before changing anything.

Repository code remains current implementation evidence. Architecture documentation can become stale and must not override current code without inspection.

## Document Guide

| Document | Purpose | Read when |
| --- | --- | --- |
| [audit-methodology.md](audit-methodology.md) | Scope, evidence standard, and audit classifications. | Assessing audit confidence or extending an audit. |
| [system-map.md](system-map.md) | Repository topology and runtime layers. | Locating a feature family or application layer. |
| [domains.md](domains.md) | Domain ownership and boundaries. | Establishing who owns a change. |
| [dependency-map.md](dependency-map.md) | Domain dependency directions and constraints. | Evaluating cross-domain impact. |
| [data-ownership.md](data-ownership.md) | Durable-state ownership, derivation, and historical truth. | Changing persistence or reconstruction behavior. |
| [canonical-rules.md](canonical-rules.md) | Authoritative rule helpers and rule-drift notes. | Changing eligibility, calculation, or game rules. |
| [canonical-services.md](canonical-services.md) | Authoritative mutation/service paths. | Adding or modifying a mutation/read workflow. |
| [cross-cutting-patterns.md](cross-cutting-patterns.md) | Reusable implementation contracts. | Working across auth, mutations, reads, jobs, errors, or formatting. |
| [architecture-debt-register.md](architecture-debt-register.md) | Evidence-backed duplicate, drift, and authority risks. | Touching a known high-risk surface. |
| [codex-development-protocol.md](codex-development-protocol.md) | Required development routine for preserving documented authority and boundaries. | Planning or implementing meaningful work. |
| [domains/](domains/) | Focused maps for selected complex domains. | Working in one of the covered complex flows. |

## Domain Architecture Guides

| Domain guide | Use when |
| --- | --- |
| [showing-judging.md](domains/showing-judging.md) | Modifying schedule, entry, judging, results, awards, or publication. |
| [breeding-litters.md](domains/breeding-litters.md) | Modifying attempts, pregnancy, whelping, or litter/puppy workflows. |
| [stud-contracts.md](domains/stud-contracts.md) | Modifying offers, requests, accepted terms, selection rights, or legacy compatibility. |
| [economy-ledger.md](domains/economy-ledger.md) | Adding a balance/ledger-affecting action or investigating economic history. |
| [genetics.md](domains/genetics.md) | Modifying genotype, phenotype, COI, foundation, or judging inputs. |
| [health-care.md](domains/health-care.md) | Modifying testing, disease, emergency, or reproductive-care workflows. |

## Authority Model

- **Design authority:** [`docs/PRODUCT/master-file.md`](../PRODUCT/master-file.md)
- **Implementation authority:** current production code
- **Implementation documentation:** `docs/ARCHITECTURE/`
- **Persistence authority:** documented durable state plus current Prisma/code evidence
- **Presentation authority:** documented presentation/read-model paths

If architecture docs and current code disagree, inspect the code and treat the difference as a documentation/update issue; do not silently assume either is correct.

## Architecture Change Expectations

- Gameplay/design change → update the Master File.
- Canonical implementation location change → update architecture docs.
- Persistence ownership change → update `data-ownership.md`.
- Cross-domain dependency change → update `dependency-map.md`.
- New reusable implementation contract → update `cross-cutting-patterns.md`.
- New/remediated architecture debt → update `architecture-debt-register.md`.
- Important durable architecture decision → ADR in a later stage.
- Operational procedure → Runbook in a later stage.

## Codex Default

Before implementing: inspect relevant architecture docs and current referenced code; prefer the documented canonical service/rule; preserve intentional variants; do not create a second authority for an existing rule; keep changes small and localized where possible; and add or update focused regression coverage for meaningful changes.
