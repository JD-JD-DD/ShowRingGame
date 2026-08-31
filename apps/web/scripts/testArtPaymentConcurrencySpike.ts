import assert from "node:assert/strict";

/**
 * ART-06 spike only: model the serialized database claim boundary required by
 * ART-08. This is intentionally not connected to PayPal, Prisma, or runtime
 * application code.
 */
class SerializedUnitClaimBoundary {
  private readonly finalizedAttemptIds = new Set<string>();

  constructor(private fundedUnits: number, private readonly totalUnits = 10) {}

  finalize(attemptId: string, requestedUnits: number): "claimed" | "already-finalized" | "unavailable" {
    if (this.finalizedAttemptIds.has(attemptId)) return "already-finalized";
    if (requestedUnits > this.totalUnits - this.fundedUnits) return "unavailable";

    this.finalizedAttemptIds.add(attemptId);
    this.fundedUnits += requestedUnits;
    return "claimed";
  }

  snapshot() {
    return { fundedUnits: this.fundedUnits, finalizedAttemptCount: this.finalizedAttemptIds.size };
  }
}

function main() {
  const finalUnit = new SerializedUnitClaimBoundary(9);
  assert.equal(finalUnit.finalize("attempt-a", 1), "claimed");
  assert.equal(finalUnit.finalize("attempt-b", 1), "unavailable");
  assert.deepEqual(finalUnit.snapshot(), { fundedUnits: 10, finalizedAttemptCount: 1 });

  const multiUnit = new SerializedUnitClaimBoundary(7);
  assert.equal(multiUnit.finalize("attempt-a", 3), "claimed");
  assert.equal(multiUnit.finalize("attempt-b", 2), "unavailable");
  assert.deepEqual(multiUnit.snapshot(), { fundedUnits: 10, finalizedAttemptCount: 1 });

  const duplicate = new SerializedUnitClaimBoundary(9);
  assert.equal(duplicate.finalize("attempt-a", 1), "claimed");
  assert.equal(duplicate.finalize("attempt-a", 1), "already-finalized");
  assert.deepEqual(duplicate.snapshot(), { fundedUnits: 10, finalizedAttemptCount: 1 });

  console.log("ART-06 serialized finite-unit claim spike checks passed.");
}

main();
