# Architecture Decision Records

ADRs record durable architecture decisions where multiple reasonable choices existed and ShowRing intentionally selected one.

Future files use `0001-short-decision-name.md` and include: context, decision, alternatives considered, consequences, and status. Valid statuses are **PROPOSED**, **ACCEPTED**, **SUPERSEDED**, and **DEPRECATED**.

Architecture facts belong in [`docs/ARCHITECTURE/`](../ARCHITECTURE/README.md). Gameplay design belongs in [`docs/PRODUCT/master-file.md`](../PRODUCT/master-file.md). Operational procedures belong in [`docs/RUNBOOKS/`](../RUNBOOKS/README.md).

Stage 8 established this framework. The accepted decisions below are the initial ADR set; architecture observations that do not meet the ADR qualification test remain in Architecture documentation.

## Accepted ADRs

| ADR | Decision | Primary concern |
| --- | --- | --- |
| [ADR-0001](0001-game-time-and-audit-time.md) | Simulation game time is distinct from real audit time. | Reproducible time rules |
| [ADR-0002](0002-event-time-historical-snapshots.md) | Event-time snapshots and published outcomes are historical truth. | Historical preservation |
| [ADR-0003](0003-server-authoritative-player-mutations.md) | Irreversible player mutations are authorized and revalidated server-side. | Integrity and eligibility |
| [ADR-0004](0004-preserve-dog-history-across-engine-migrations.md) | Engine migrations preserve dog identity and known historical state. | Migration safety |
| [ADR-0005](0005-canonical-support-subscription-resolution.md) | Current Support state uses canonical lifecycle semantics. | External subscription lifecycle |
| [ADR-0006](0006-versioned-championship-point-schedules.md) | Championship point schedules are versioned persisted domain rules. | Competition-rule ownership |
| [ADR-0007](0007-separate-biological-breeding-and-stud-contract-authority.md) | Biological breeding and commercial stud contracts remain separate authorities. | Domain boundaries |

## Candidate Decisions Not Yet ADRs

| Candidate | Reason not recorded as ADR |
| --- | --- |
| Hidden genetic truth versus player-visible categories | Primarily a LOCKED product-design information boundary already owned by the Master File. |
| Supporter cosmetic-only behavior | Primarily a locked no-gameplay-advantage design rule; architecture registries already describe its presentation boundary. |
| Community batch identity enrichment | Established cross-cutting implementation pattern, not a decision requiring an ADR. |
| Server Component direct reads and service-backed mutations | Established application pattern; audit evidence does not establish a deliberate durable choice against a credible alternative. |
| Universal economy/ledger mutation authority | Architecture debt remains unresolved (`ARCH-DEBT-002`), so it cannot be accepted as a decision. |
