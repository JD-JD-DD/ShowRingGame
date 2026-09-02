# Economy and Ledger Architecture

## Purpose

Maps the broad economic boundary: kennel balance, ledger history, market/foundation/rehome flows, and feature-owned money effects. It is a caution guide, not a claim that a universal economy service already exists.

## Domain Boundary

**Owns:** economic meaning, balance/ledger history, and money effects within feature transactions.  
**Consumes:** authenticated kennel context and feature-specific eligibility.  
**Exposes:** balances, ledger records, economic outcomes and player presentation.

See [domains.md](../domains.md) and [data-ownership.md](../data-ownership.md) for established ownership details.

## Canonical Paths

- **Rules:** distributed feature rules; no universal canonical balance/ledger rule is established.
- **Services:** market, foundation, rehome, breeding, health/care, grooming, show-entry and related feature services.
- **Persistence:** kennel balance and ledger/economic-history models.
- **Primary mutation routes:** feature-authoritative transactions that validate a domain action and write its money effect.
- **Scheduled progression:** feature-owned maintenance/repair flows where documented.
- **Presentation/read models:** kennel ledger/balance and feature-specific receipt/history views.

## Lifecycle / Flow

`feature request → domain eligibility/price calculation → transaction → balance + ledger/history effect → feature state → player receipt/read model`

## Cross-Domain Dependencies

Economy is consumed by Shows, Breeding, Health/Care, Grooming, Market/Rehoming, Foundation Dogs, Stud Contracts, and Support/Art boundaries. Payment-provider records are intentionally separate from gameplay economy.

## Historical / Persistence Invariants

Economic history explains durable ownership and game-state changes. Preserve feature, actor, amount, time, and linked historical record. Do not treat a balance alone as reconstructable history.

## Intentional Variants

- Player market and foundation market are distinct variants.
- Support/provider and art-contribution payment history are not gameplay economy.
- Feature-local transactions are current implementation reality; this does not establish a new universal authority.

## Known Architecture Debt

`ARCH-DEBT-002` is the broadest debt surface: gameplay balance and ledger mutation authority is unresolved and distributed. Treat direct balance work as high-risk; inspect the exact feature transaction and ledger behavior before changing it.

## Implementation Guidance

1. Read Economy and Historical Preservation in the Master File.
2. Inspect `ARCH-DEBT-002` and current feature transaction code.
3. Keep eligibility, money effect, durable feature state, and ledger history coherent.
4. Do not introduce a second writer or infer a global service that does not exist.
5. Add regression coverage for duplicate requests, insufficient balance, and historical records.

## References

[Master File](../../PRODUCT/master-file.md) · [canonical rules](../canonical-rules.md) · [canonical services](../canonical-services.md) · [data ownership](../data-ownership.md) · [dependency map](../dependency-map.md) · [patterns](../cross-cutting-patterns.md)
