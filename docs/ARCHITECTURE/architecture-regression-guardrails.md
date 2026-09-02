# Architecture Regression Guardrails

## 1. Purpose

These focused regressions protect high-confidence architecture invariants. They complement feature and gameplay tests, remain deliberately small, and do not attempt to mechanically enforce every architecture pattern.

The [Codex Development Protocol](codex-development-protocol.md) requires meaningful changes to identify and run relevant guardrails where practical.

## 2. Guardrail Standard

A guardrail protects at least one authority boundary, hidden-data boundary, historical invariant, cross-domain prohibition, transaction invariant, idempotency invariant, or canonical semantic contract.

## 3. Guardrail Registry

| ID | Invariant | Authority/source | Regression script(s) | Technique | Failure means | Status |
| --- | --- | --- | --- | --- | --- | --- |
| ARCH-GUARD-001 | Show-entry mutations revalidate current server state; judging retains its event-time recheck. | ADR-0003; show-entry/judging services | `testArchitectureShowEntryAuthority.ts` | structural source assertions | planner/client state could become the sole entry gate | ACTIVE |
| ARCH-GUARD-002 | Support is cosmetic and cannot become a gameplay input. | Master File; ADR-0005 | `testArchitectureSupportIsolation.ts` | production import-boundary assertions | Support lifecycle/provider/badge code enters gameplay authority | ACTIVE |
| ARCH-GUARD-003 | Published show history remains durable event-time truth. | ADR-0002; ADR-0006 | `testGrandChampionHistoricalImmutability.ts`, `testFinalizerConcurrencySafety.ts` | source + persistence-key assertions | published history could be reread/rebuilt as mutable work or duplicated | ACTIVE |
| ARCH-GUARD-004 | Representative ordinary money flows co-persist signed ledger history and logical post-effect balances. | Economy/Ledger invariant audit | `testArchitectureLedgerInvariants.ts`, `testBulkBrucellosisExecution.ts` | representative source/persistence-shape assertions | a transfer, sink, health debit, or faucet loses its documented ledger contract | ACTIVE |
| ARCH-GUARD-005 | High-risk show finalization remains idempotent without requiring one global mechanism. | cross-cutting patterns; ADR-0002 | `testFinalizerConcurrencySafety.ts`, `testJudgingPublicationClaim.ts` | unique-key and publication-claim assertions | reruns/concurrency could create duplicate irreversible finalization effects | ACTIVE |
| ARCH-GUARD-006 | Player-facing Dog DTOs expose derived categories, never raw genetic/trait fields. | Master File; data ownership; read-model audit | `testArchitectureHiddenDogData.ts`, `testPhenotypeHealthTruthBatching.ts` | DTO-boundary source assertions | hidden genetic/trait data could cross a production player DTO boundary | ACTIVE |
| ARCH-GUARD-007 | Community Support presentation shares current-state semantics while retaining batched, provider-isolated reads. | ADR-0005; Support parity audit | `testSupportPaidThroughExpiration.ts`, `testCommunitySupporterBadgeMap.ts`, `testCommunityReadPerformance.ts` | pure semantic + batching/source assertions | badge output could drift from Support semantics or regress to N+1/provider coupling | ACTIVE |
| ARCH-GUARD-008 | Canonical lifecycle and game-year constants remain consumed by their protected paths. | canonical rules; Stage 10 closeout | `testReproductiveEmergencyEligibility.ts`, `testGameTimeFormat.ts` | focused rule-consumer regressions | same-rule literals or divergent duration semantics could return | ACTIVE |

## 4. Existing Guardrails Adopted

- `testFinalizerConcurrencySafety.ts` and `testJudgingPublicationClaim.ts` protect durable publication/finalization identity and rerun safety.
- `testGrandChampionHistoricalImmutability.ts` protects completed show-credit history from normal mutable rewrites.
- `testBulkBrucellosisExecution.ts` protects Health transaction, debit, ledger, and bulk persistence shape.
- `testSupportPaidThroughExpiration.ts`, `testCommunitySupporterBadgeMap.ts`, and `testCommunityReadPerformance.ts` protect the Support current-state and no-N+1 Community boundary.
- `testReproductiveEmergencyEligibility.ts` and `testGameTimeFormat.ts` protect the Stage 10 canonical duration consumers.

## 5. New Guardrails Added in Stage 11

- `testArchitectureShowEntryAuthority.ts`: server mutation and bulk revalidation, separate judging-time disposition.
- `testArchitectureSupportIsolation.ts`: Support dependency prohibition in representative gameplay authorities and the permitted Community presentation boundary.
- `testArchitectureLedgerInvariants.ts`: representative transfer, sink, health debit, and faucet ledger shapes.
- `testArchitectureHiddenDogData.ts`: owned-roster, profile, and Market player DTO boundaries.
- `testArchitectureGuardrails.ts`: runs the four deterministic new guardrails without replacing their individual commands.

## 6. Deliberately Not Automated

- A universal Economy writer, universal idempotency mechanism, and universal `balanceAfter` assertion are not established architecture.
- A universal Dog/Show read service is not required; direct Server Component Prisma reads, services, mappers, and narrow helpers remain valid variants.
- Title legacy reconciliation, completion metadata, historical current-name presentation, and producer suffix scope require design/migration decisions.
- A universal localization/accessibility framework is not established.

These are documentation/design boundaries, not mechanically testable universal contracts.

## 7. Running Guardrails

From `apps/web`:

```powershell
pnpm run test:architecture-guardrails
```

The aggregate runs only the new deterministic guardrails. Run adopted scripts individually when changing their owning domain; they may rely on their own focused fixtures or database harnesses.
