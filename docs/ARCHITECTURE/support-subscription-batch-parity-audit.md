# Support Subscription Batch Parity Audit

## 1. Purpose

This read-only audit investigates ARCH-DEBT-005 before canonicalization. It compares the individual Support lifecycle resolver with Community’s no-N+1 supporter-badge batch consumer. No Support, Community, provider, database, or test behavior was changed.

## 2. Authority Model

- **Support lifecycle authority:** `supportSubscription.service:getCanonicalSupportSubscription`.
- **Community role:** `communitySupporterBadge.service:getCommunitySupporterBadgePresentations` batch-loads data and enriches Community authors.
- **Badge helper:** `getSupporterBadgePresentation` is presentation-only. It receives tier/status, paid-through date, and `Kennel.showSupporterBadge`; it does not select or mutate a subscription.

## 3. Canonical Resolver Decision Tree

`getCanonicalSupportSubscription({ userId, database })`:

1. Reads the newest live `SupportSubscriptionChange` for that user (`PENDING_APPROVAL`, `TARGET_ACTIVE_CANCELLATION_PENDING`, or `CLEANUP_FAILED`), ordered by `requestedAt DESC`, including source and target subscriptions.
2. When a live change exists, selects the target only if `targetActivatedAt` is set and target status is `ACTIVE`; otherwise selects the source.
3. When no live change exists, loads PAYPAL rows in `PENDING`, `ACTIVE`, `PAYMENT_RETRY`, or `CANCELLATION_SCHEDULED` status. It selects the row only when exactly one exists; zero or multiple rows return `null`.
4. For a selected `CANCELLATION_SCHEDULED` row whose paid-through time is absent or no longer future, it finalizes locally: closes open tier periods at paid-through, marks the row `ENDED`, and returns `null`.
5. Otherwise returns the selected row unchanged. The elapsed-cancellation branch is a local database mutation, not a provider call.

## 4. Community Batch Resolver Decision Tree

`getCommunitySupporterBadgePresentations(userIds)`:

1. Removes null/undefined IDs and deduplicates remaining user IDs.
2. In parallel, reads Kennel badge preferences, eligible PAYPAL subscription rows in the same four current statuses, and live change rows in the same three live-change statuses ordered by `requestedAt DESC`.
3. For each user, takes the first change in the globally descending change result; because rows are ordered descending, this is that user’s newest live change.
4. With a change, selects target only when `targetActivatedAt` and ACTIVE target are present; otherwise selects source.
5. Without a change, selects the user’s subscription only when exactly one eligible row exists; otherwise selects `null`.
6. Passes selected tier/status/paid-through and the Kennel preference to `getSupporterBadgePresentation`, storing `{ tier }` only for a visible badge and `null` otherwise.

The batch path never calls the provider and does not finalize elapsed cancellation state.

## 5. Parity Matrix

| Scenario | Canonical resolver result | Batch resolver result | Same subscription? | Same effective tier? | Same active/former interpretation? | Same paid-through interpretation? | Classification | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| One ACTIVE row | row | same row | Yes | Yes | Yes | Yes | EQUIVALENT | High |
| Pending support row | PENDING row | same row | Yes | Yes | Yes; badge helper hides it | Yes | EQUIVALENT | High |
| Pending upgrade, target not activated | source row | same source row | Yes | Yes | Yes | Yes | EQUIVALENT | High |
| Completed upgrade | no live change; exactly-one current row rule | same rule | Yes | Yes | Yes | Yes | EQUIVALENT | High |
| Scheduled downgrade awaiting provider effect | source row | same source row | Yes | Yes | Yes | Yes | EQUIVALENT | High |
| Downgrade effective / completed | no live change; current row holds provider-confirmed tier | same rule | Yes | Yes | Yes | Yes | EQUIVALENT | High |
| Cancellation requested, paid-through future | scheduled-cancellation row | same row | Yes | Yes | Yes; badge visible if enabled | Yes | EQUIVALENT | High |
| Scheduled cancellation at/after paid-through boundary | finalizes row to ENDED and returns `null` | shared predicate selects no current row read-only | Yes | N/A | Yes; no current subscription | Both treat paid-through as elapsed | EQUIVALENT | High |
| Former supporter / only ENDED history | `null` | no eligible row, `null` badge | Yes | N/A | Yes; account history is separate | N/A | INTENTIONAL PRESENTATION VARIANT | High |
| PAYMENT_RETRY / suspended-provider mapping | retry row | same row | Yes | Yes | Yes; badge helper displays it if enabled | Yes | EQUIVALENT | High |
| Unsupported/ended provider state | no current eligible row | same status filter excludes it | Yes | N/A | Yes | N/A | EQUIVALENT | High |
| Multiple current eligible rows | `null` | `null` | Yes | N/A | Yes | N/A | EQUIVALENT | High |
| Multiple historical rows only | `null` | `null` | Yes | N/A | Yes | N/A | INTENTIONAL PRESENTATION VARIANT | High |
| Multiple live change rows | newest requested live change | first matching item after same descending batch ordering | Yes | Yes | Yes | Yes | EQUIVALENT | Medium |

## 6. Subscription Record Selection

Both implementations use the same PAYPAL provider/status eligibility set and deliberately decline to choose among multiple ordinary current rows. Neither treats newest subscription creation as a tie-breaker. Both use the newest live change by `requestedAt`, and both use the same target-activated/ACTIVE condition for replacement selection.

Multiple SupportSubscription rows are expected historically through provider replacement and tier-change workflows. Historical rows do not participate in either current selector unless their status remains in the current set. The only proven winner difference is the canonical resolver’s elapsed-cancellation finalization described below.

## 7. Tier Change Semantics

For immediate replacement upgrades, both retain source recognition until an ACTIVE target has `targetActivatedAt`; then both recognize target. For scheduled downgrades, both retain source until provider confirmation changes the current row/change lifecycle. Completed/abandoned change rows are excluded from both live-change selections. The code comparison supports equal effective tier selection for these states.

`CLEANUP_FAILED` remains live in both selectors, so both continue the same source/target precedence during unresolved upgrade cleanup. Existing lifecycle regression tests cover this durable blocker, though they do not directly call both selectors with one shared fixture.

## 8. Cancellation / Paid-Through Semantics

Before paid-through expiry, both select `CANCELLATION_SCHEDULED`; the badge helper shows the current tier only when preference is enabled and end time is strictly in the future.

At the exact boundary and afterward, canonical resolution calls `finalizeElapsedCancellation`, closes the tier period, marks the subscription ENDED, and returns `null`. Community does not mutate and still selects the stored scheduled-cancellation row if no other read has finalized it. It sends that row to the badge helper, which hides the badge because the end is not future.

Thus Community’s cosmetic output is equivalent at expiry, but its selected subscription is not semantically identical to canonical current state. This is not a provider discrepancy: canonical finalization is explicitly local/provider-independent.

## 9. Former Supporter / Historical Reads

The canonical resolver returns `null` for former supporters. Community produces no badge for them. Account Support status intentionally performs a separate latest-historical-row query only after canonical resolution is null, so it can thank a former supporter and display previous level/history. That is an intentional historical presentation variant, not a current-state selector conflict.

## 10. Badge Presentation Boundary

Community does not update subscription data, call PayPal, or infer tier from `Kennel.showSupporterBadge`. It supplies the selected subscription data to `getSupporterBadgePresentation`; the helper alone determines cosmetic visibility and returns the selected tier unchanged. Badge preference cannot affect Support lifecycle truth, and badges confer no gameplay effect.

## 11. Performance / Batching Contract

The required Community shape remains:

`base Community authors → stable deduplicated user IDs → one batched Support query + one batched change query + one batched Kennel preference query → per-user lookup → shared badge helper → Map`.

Future remediation must preserve this shape. Calling the canonical async resolver once per author would reintroduce N+1 reads. If later safe, the narrow architecture is a shared pure selector over already-loaded per-user records, not repeated single-user queries.

## 12. Regression Coverage

| Test | Scenario | Canonical only | Batch only | Parity asserted? |
| --- | --- | --- | --- | --- |
| `testSupportLifecycleRegression.ts` | live changes, active replacement, ambiguity, cancellation finalization, retry | Yes | No | No |
| `testSupportPaidThroughExpiration.ts` | before/at/after expiry and local finalization | Yes | No | No |
| `testSupportCancellation.ts`, `testSupportScheduledDowngrade.ts`, `testSupportTierChanges.ts` | cancellation and tier-change workflows | Yes | No | No |
| `testSupportFormerSupporter.ts` | former-supporter history presentation | Yes | No | No |
| `testSupportPaymentRecovery.ts`, `testSupportPaymentRetryLifecycle.ts`, `testSupportReconciliation.ts` | provider/retry/reconciliation lifecycle | Yes | No | No |
| `testCommunitySupporterBadgeMap.ts` | dedupe, batch reads, helper use, no provider coupling | No | Yes | No |
| `testSupporterBadgePresentation.ts`, Community identity/public badge tests | cosmetic visibility and preference | No | Yes | No |
| `testCommunityReadPerformance.ts` | Community no-N+1/read performance pattern | No | Yes | No |

## 13. Confirmed Invariants

- Support lifecycle, not Community or badge preference, determines current entitlement.
- Both selectors use the same eligible PAYPAL status set and live-change status set.
- Both reject ambiguous multiple current subscription rows rather than selecting arbitrarily.
- Both select an upgrade target only after it is both activated and ACTIVE.
- Community delegates cosmetic status/tier visibility to the shared badge presentation helper.
- Community batching is required and must not be replaced with per-author canonical resolver calls.
- Canonical elapsed-cancellation finalization is local, idempotent lifecycle work; Community is read-only.

## 14. Divergences / Unknowns

### Resolved divergence: elapsed scheduled cancellation

The Support-domain pure predicate `isCurrentSupportSubscriptionAt` now expresses the canonical read rule for already-loaded rows. Canonical resolution retains ownership of persisted finalization; Community applies the same predicate after its existing batched source/target selection and treats elapsed scheduled cancellation as no current subscription without mutation.

The batch query architecture, change precedence, badge helper, and provider isolation remain unchanged. No source evidence establishes another selection divergence for active, live-change, retry, former-history, or multiple-row selection. Exact parity under multiple malformed live changes remains source-supported but lacks an executable shared-fixture test, so confidence is Medium.

## 15. ARCH-DEBT-005 Recommendation

**D. NO CANONICALIZATION REQUIRED.** The proven elapsed-cancellation selection divergence is resolved by one shared pure Support predicate. Community remains a batched presentation implementation, does not call the canonical resolver per user, and does not own cancellation finalization.

### Explicit Answers

1. Yes for the audited states: elapsed scheduled cancellation is now treated as no current subscription by both paths.
2. Yes for every state where both select a current row; neither has a current tier after expiry.
3. Yes while paid-through is future.
4. Yes at/after expiry: canonical returns null after finalization and batch returns no current selection read-only.
5. Yes: pending upgrades keep source until activated ACTIVE target.
6. Yes: scheduled downgrades retain source until provider-confirmed lifecycle transition.
7. Yes in output: former supporters have no current selection/badge; account history is intentionally separate.
8. No: both return null for multiple ordinary current rows; both use newest live change ordering. The elapsed-cancellation case remains the distinct difference.
9. No: preference is read only after/supporting selection and only controls cosmetic visibility.
10. No: Community delegates tier/status visibility to `getSupporterBadgePresentation`.
11. Yes: batching is a performance implementation of the shared current-state read semantics; persisted finalization remains Support lifecycle work.
12. Yes: a future shared-fixture parity test can compare a pure batched selector with canonical semantics while preserving batched I/O.
