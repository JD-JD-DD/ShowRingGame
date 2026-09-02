# Economy / Ledger Invariant Audit

## 1. Purpose

This Stage 10B diagnostic investigates `ARCH-DEBT-002` before any accounting canonicalization. It records current repository evidence only; it does not authorize a shared economy service, writer refactor, schema change, or debt resolution.

## 2. Current Persistence Authority

`Kennel.balance` is the durable current balance used for affordability and current player presentation. `LedgerTransaction` is durable, per-kennel financial history: its signed `amount`, optional `balanceAfter`, epoch, transaction type, and linked dog/show/counterparty/metadata explain a feature's money effect. Neither is a replacement for the other.

`LedgerTransactionType` currently includes starter funds; show/travel/handler, breeding, market, rehome and stud entries; service/faucet entries; upkeep/listing/prize types; health, refund, grooming/stewarding, and emergency-care types. The enum alone does not prove a complete accounting policy.

## 3. Production Balance Writer Inventory

The inventory found **20 meaningful production operations** that write gameplay balance (some share a service and some have single/bulk variants). Historical test fixtures and read-only presentation references are excluded.

| Operation | Owning domain | Service/function | Direction | Payer → payee | Balance mutation form | Ledger row? | Sign / `balanceAfter` | Atomicity / retry protection | Classification | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kennel creation, route | Kennels | `api/kennel/create` | FAUCET | system → new kennel | create with starter balance | yes | `+`; starter balance | create + ledger + runs in transaction | established | High |
| Kennel creation, service | Kennels | `createKennelForUser` | FAUCET | system → new kennel | create with starter balance | yes | `+`; starter balance | transaction | established duplicate entry path | High |
| Beta auto top-off | Economy | `betaEconomy` | FAUCET | system → kennel | set prior + top-up | yes | `+`; new balance | transaction; threshold guard, repeatable after threshold | intentional beta variant | High |
| Single show entry | Showing | `createShowEntry` | SINK | kennel → system | set computed debit | yes | `-`; computed post-entry | entry, balance, ledger in transaction; unique entry constraint | established | High |
| Bulk show entry | Showing | cluster entry creation | SINK | kennel → system | set final quote balance | yes, 1–3 rows | `-`; conceptual running balance | all entry/plan/balance/ledger writes in transaction | established bulk variant | High |
| Single phenotype health test | Health | health-test execution | SINK | kennel → system | running balance then update | yes | `-`; running balance | test/result/balance/ledger transaction | established | High |
| Bulk phenotype health test | Health | bulk health execution | SINK | kennel → system | set total debit | yes, per test | `-`; conceptual running balance | all-or-nothing transaction | established bulk variant | High |
| Single brucellosis screening | Health | service or dog route orchestration | SINK | kennel → system | set debit | yes | `-`; post-screen balance | route/service execution in transaction | established, split route/helper shape | Medium |
| Bulk brucellosis screening | Health | infectious-disease bulk execution | SINK | kennel → system | set total debit | yes, per screening | `-`; conceptual running balance | all-or-nothing transaction | established bulk variant | High |
| Player dog sale | Market | market purchase | TRANSFER | buyer → seller | two computed updates | two | buyer `-`, seller `+`; each party's post-balance | listing/dog/ownership/balances/ledgers transaction | established | High |
| Foundation purchase | Foundation | foundation purchase | SINK | kennel → system inventory | set computed debit | yes | `-`; buyer post-balance | ownership/inventory/balance/ledger transaction | intentional system-counterparty variant | High |
| Breeding base fee | Breeding | create breeding attempt | SINK | kennel → system | computed debit | yes | `-`; post-base-fee balance | attempt/balance/ledger transaction | established | High |
| Brucellosis tests during breeding | Breeding/Health | create breeding attempt | SINK | kennel → system | running debit | yes, per test | `-`; sequential balance | same transaction; positive result may stop later breeding | intentional composite-flow variant | High |
| Player stud fee | Breeding/Stud | create breeding attempt | TRANSFER | dam kennel → stud kennel | two computed updates | two | payer `-`, payee `+`; each post-balance | same attempt transaction | established | High |
| Outside grooming | Grooming | accept listing | FAUCET | system → groomer | increment | yes | `+`; returned updated balance | listing/action/condition/balance/ledger transaction | intentional faucet | High |
| Club stewarding | Kennel services | claim stewarding | FAUCET | system → steward | increment | yes | `+`; returned updated balance | serializable transaction; uniqueness/claim limits | intentional faucet | High |
| Emergency veterinary treatment | Health/Care | emergency treatment | SINK | kennel → system | set computed debit | yes | `-`; post-treatment balance | event lock, balance, ledger, event update in transaction | established | High |
| Reproductive emergency treatment | Health/Care | authorize treatment | SINK | kennel → system | set computed debit | yes | `-`; post-treatment balance | conditional event lock + ledger link in transaction | established | High |
| Puppy rehome placement | Rehome | `rehomeOwnedDogs` | FAUCET | system → kennel | increment aggregate | yes, per dog paid | `+`; conceptual sequential balance | transfer/rehome/balance/ledger transaction | intentional faucet | High |
| Year 13 regular-show repair | Repair | year-13 repair service | REFUND / REPAIR | system → affected kennel | computed batch updates | yes, per refund | `+`; running reconstructed balance | transaction; explicit source-ledger metadata | legacy/repair | High |

`accountClosure.service.ts` did not contain a gameplay balance/ledger writer in the inspected current code. `dog.service.ts` and planner/read paths surfaced by broad text search were not balance mutations.

## 4. Production Ledger Writer Inventory

Meaningful production ledger writers are the operations above, located in kennel creation route/service, `betaEconomy`, show entry, health/infectious disease, market, foundation, breeding, grooming, kennel services, emergency-care services, rehome, and Year 13 repair. The active writer inventory contains **15 source locations / 20 operation variants** when single/bulk and composite-flow variants are counted separately.

All inspected ordinary writers set `kennelId`, `transactionType`, signed `amount`, `occurredAtEpoch`, and a feature-specific memo. Most set `balanceAfter`; links vary legitimately by domain: dog/show/entry, counterparty kennel, event ID in metadata, breeding attempt, service claim/listing, or source ledger transaction for repair.

## 5. Financial Flow Analysis

### Show Entry

Single entry validates affordability, debits the kennel, persists `ShowEntry`, and creates a negative `SHOW_ENTRY_FEE` row in one transaction. Bulk entry calculates the full quote, rejects a shortfall, writes final balance, creates entries/plan, then creates separate negative fee/travel/handler rows with a running conceptual balance. Unique entry constraints provide duplicate-entry protection; the bulk operation is atomic.

### Health

Phenotype and brucellosis flows debit only the testing kennel with negative `HEALTH_TEST_FEE` rows. Bulk paths prepare individual result/ledger rows and execute all selected eligible tests, balance debit, records, and ledger rows in one transaction. Single dog-route brucellosis is a route-orchestrated transaction: the route updates balance and the shared service writes screening/ledger evidence. No behavior defect was demonstrated, but its split writer shape differs from service-contained flows.

### Market

Player dog sale is a true two-party transfer: buyer receives a negative `DOG_PURCHASE` row and seller a positive `DOG_SALE` row, each with the other kennel as counterparty. Both balances, rows, ownership, listing transition, and related transfer effects occur in the transaction.

### Foundation

Foundation purchase intentionally has only the player debit `DOG_PURCHASE` row. The unsold system inventory is not a player kennel counterparty, so lack of a reciprocal ledger row is a legitimate system-sink variant.

### Breeding / Stud

Breeding base fee is a negative system sink. Optional brucellosis tests create separate negative health rows before the attempt; a positive result can stop the later breeding state while retaining the paid test history. A player stud fee is a paired transfer (`STUD_FEE_OUT` negative and `STUD_FEE_IN` positive) with both parties and attempt references. Return-service use has no separate payment in the inspected attempt flow.

### Grooming / Services

Outside grooming credits only the groomer with positive `GROOMING_INCOME`; current design funds it from the game, not the owner. Club stewarding similarly credits only the service provider with positive `STEWARDING_INCOME`. Both are intentional faucets, not incomplete player-to-player transfers. Self grooming is a zero-dollar state action and has no financial row.

### Emergency Care

Ordinary emergency care and reproductive emergency treatment each debit the affected kennel with negative `EMERGENCY_VET_CARE` history in the same transaction as the event decision. Reproductive treatment uses conditional event status/empty-ledger locking and links the created ledger ID back to the event, giving clear duplicate-payment protection. Ordinary emergency care conditionally advances pending event state before the debit/ledger path.

### Starter Funds / Top-Off

Starter funding is an explicit positive `STARTER_FUNDS` faucet at creation. Beta top-off is an explicit positive `REFUND`-typed faucet guarded by an enabled flag and low-balance threshold; it can apply again after later spending, so it is not a one-time idempotent grant.

### Refund / Repair

Year 13 repair is a non-normal historical refund path. It builds positive `REFUND` rows from debit-ledger evidence, records source IDs/type/year in metadata, and updates balances in the same transaction. It must not define ordinary gameplay writer shape.

## 6. Ledger Amount Sign Convention

**Strong consensus:** `amount` is signed from the perspective of `LedgerTransaction.kennelId`: debits/sinks are negative; credits/faucets/refunds are positive. Paired player transfers use one negative payer row and one positive payee row. No inspected ordinary writer contradicted this convention.

## 7. balanceAfter Semantics

**Strong consensus, with a bulk-flow qualification:** `balanceAfter` is the row kennel's post-effect balance. Single operations either compute prior balance ± amount or use the returned updated balance. Bulk health, brucellosis, show entry, and rehome use a running conceptual sequence while the database kennel is written once with the final aggregate balance. Thus a bulk row's `balanceAfter` represents the balance after that logical ledger component, but is not necessarily the physical database value immediately after a separate per-row balance update (because no such update occurs). No inspected writer omitted `balanceAfter`.

## 8. Atomicity Matrix

| Operation | Business state | Balance | Ledger | Classification |
| --- | --- | --- | --- | --- |
| Creation/top-off | kennel creation or threshold decision | same transaction | same transaction | ATOMIC |
| Show single/bulk | entry/plan | same transaction | same transaction | ATOMIC |
| Health single/bulk | test/screening result | same transaction | same transaction | ATOMIC |
| Player market sale | listing/ownership | same transaction | same transaction | ATOMIC |
| Foundation purchase | inventory/ownership | same transaction | same transaction | ATOMIC |
| Breeding/stud | attempt/contract state | same transaction | same transaction | ATOMIC |
| Grooming/stewarding | listing/action/claim | same transaction | same transaction | ATOMIC |
| Emergency treatment | event decision | same transaction | same transaction | ATOMIC |
| Rehome | dog/rehome/run state | same transaction | same transaction | ATOMIC |
| Year 13 repair | repair/refund state | same transaction | same transaction | ATOMIC, LEGACY/REPAIR |

## 9. Transfer Semantics

Player-to-player dog sales and player stud fees consistently create two linked, opposite-signed rows—one for each affected kennel—with `counterpartyKennelId`. System purchases/sinks have only payer history; game-funded rewards/faucets have only recipient history. This is a deliberate distinction, not a missing reciprocal row.

## 10. Idempotency / Duplicate-Payment Protection

- Show entry: unique entry constraints and transactional creation; bulk validates selected state.
- Health bulk: one transaction after execution-plan validation; focused scripts inspect bulk atomicity.
- Market: listing/ownership validation and transaction protect sale completion.
- Breeding/stud: contract/return-service conditional status transitions and attempt flow run in one transaction.
- Grooming: listing completion/weekly capacity state is authoritative; no independent payment source key was found.
- Stewarding: unique claim keys, capacity checks, serializable transaction and retry handling.
- Emergency care: pending-state conditional updates; reproductive treatment additionally locks on missing ledger ID and writes it back.
- Beta top-off: threshold/feature-flag guard; intentionally repeatable after later balance decline.
- Repair: source-ledger inspection/repair-specific construction; legacy only.

No universal ledger source-key/idempotency invariant was established.

## 11. Candidate Accounting Invariants

| Invariant | Status | Evidence | Exceptions | Confidence |
| --- | --- | --- | --- | --- |
| A. Every ordinary gameplay balance change has ledger history. | SUPPORTED | All inspected normal balance writers create one or more rows. | Legacy repair is also ledgered; no contrary writer found. | Medium |
| B. Amount is signed from the row kennel perspective. | SUPPORTED | All inspected debit, credit, faucet and transfer rows follow it. | None found. | High |
| C. `balanceAfter` equals actual balance immediately after mutation. | PARTIALLY SUPPORTED | Single flows do; bulk flows store sequential conceptual post-row balances after one final aggregate balance update. | Bulk health/brucellosis/show/rehome timing shape. | High |
| D. Balance, ledger and business state are in one Prisma transaction. | SUPPORTED | All inspected normal flows use the same transaction client. | Must be rechecked for any uninspected future writer. | High |
| E. Player-to-player transfers give both parties ledger rows. | SUPPORTED | Market sale and stud fee both create paired rows. | Only applies where both parties are player kennels. | High |
| F. Game-funded faucets create only recipient rows. | SUPPORTED | Starter, top-off, grooming, stewarding, rehome. | Transaction type varies by reason. | High |
| G. System sinks create only payer rows. | SUPPORTED | Entry, health, foundation, breeding, emergency care. | No system counterparty row. | High |
| H. Zero-dollar state changes have no financial row. | PARTIALLY SUPPORTED | Self grooming and declined reproductive treatment do not create money rows. | Inventory is not exhaustive for every zero-dollar action. | Medium |
| I. Type gives reason while references/metadata give context. | SUPPORTED | Enum type is paired with dog/show/counterparty/memo/metadata as applicable. | Context fields intentionally vary. | High |
| J. Repair writers are explicit exceptions. | SUPPORTED | Year 13 service marks repair/refund metadata and is not ordinary flow. | Additional historical scripts should remain separately audited. | High |

## 12. Legitimate Variants

- Single versus bulk operations: aggregate balance writes with sequential ledger snapshots are valid accounting representations.
- Player transfers require reciprocal rows; system sinks/faucets do not.
- Grooming/stewarding/rehome current payments are game-funded faucets.
- Foundation purchase is a system inventory sink, not a player market transfer.
- Brucellosis test charges inside breeding remain paid even if a positive result prevents the later breeding attempt.
- Emergency flows use stronger conditional event locks because treatment is retry/concurrency sensitive.

## 13. Unexplained Inconsistencies

- Single brucellosis route orchestration updates `Kennel.balance` in the route while shared screening logic writes its ledger row; most normal flows keep both in a service. The same transaction and sign/balance semantics are evident, but the reason for this split ownership was not established.
- `balanceAfter` has a strong logical meaning but no explicit repository-wide assertion/constraint establishes it against the final `Kennel.balance`, especially for aggregate bulk writes.
- No universal source key or common duplicate-payment contract spans all monetary operations.

These are evidence-backed architecture differences, not demonstrated financial bugs.

## 14. Repair / Legacy Writers

`year13RegularShowRepair.service.ts` is a legacy repair/refund exception. It is explicitly sourced from historic debit ledger rows and should not define new gameplay accounting. Account closure had no current gameplay balance writer. Test scripts were inspected as evidence only and were not treated as production writers.

## 15. Proposed Canonical Accounting Contract

| Proposed invariant | Classification | Basis |
| --- | --- | --- |
| Ordinary gameplay balance mutations pair durable ledger history with the business mutation in the same transaction. | STRONG CONSENSUS | Every inspected normal writer follows this shape. |
| Ledger amount is signed from the ledger-row kennel perspective. | ESTABLISHED FROM CURRENT BEHAVIOR | No inspected counterexample. |
| Player-to-player transfer writes paired opposite-signed history; system sinks/faucets write only affected player rows. | ESTABLISHED FROM CURRENT BEHAVIOR | Market/stud versus foundation/entry/reward flows. |
| `balanceAfter` is the logical post-effect balance for its ledger row. | STRONG CONSENSUS | Single physical updates and bulk running sequences agree semantically. |
| `balanceAfter` must always equal a separately observed immediate stored balance after each row. | INSUFFICIENT EVIDENCE | Aggregate bulk writes intentionally do not update balance per ledger row. |
| One universal retry/source-key mechanism applies to all money flows. | INSUFFICIENT EVIDENCE | Protection is feature-specific. |

## 16. ARCH-DEBT-002 Recommendation

**D. PARTIAL CANONICALIZATION POSSIBLE.** Strong evidence supports a future narrow contract around signed per-kennel ledger rows, transactional co-persistence with ordinary gameplay balance/business state, paired player transfers, and explicit system faucets/sinks. A universal writer/service, universal `balanceAfter` physical-timing assertion, and universal idempotency mechanism remain unsupported. Any future cleanup must preserve the documented bulk, system-counterparty, emergency-lock, and repair variants.
