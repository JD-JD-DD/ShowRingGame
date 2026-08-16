import assert from "node:assert/strict";

import {
  BREED_WEIGHTED_JUDGING_SCORING_VERSION,
  combineBreedAndJudgeConformationWeights,
  judgeBreedBlock,
  type Dog,
  type Judge,
} from "@showring/rules";

import {
  createBreedJudgingResultAudit,
  getJudgingAuditForResult,
  readPersistedJudgingAudit,
  validateBreedWeightedResultAudit,
} from "../server/services/judgingAudit.service";

const dog: Dog = {
  dogId: "dog-1", regNumber: "SRG-1", breedCode2: "AA", birthEpoch: 0, sex: "M", status: "ALIVE",
  litterId: null, litterOrder: null, sireId: null, damId: null,
  traits: { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 },
};
const judge: Judge = {
  judgeId: "judge-1", name: "Judge", style: "BALANCED",
  categoryWeights: { TYPE_EXPRESSION: .9, STRUCTURE_BALANCE: 1, MOVEMENT: 1.2, COAT_PRESENTATION: 1, TEMPERAMENT_RING_BEHAVIOR: 1, CONDITIONING_HANDLING: 1.1 },
};
const effective = combineBreedAndJudgeConformationWeights({
  breedWeights: { TYPE_EXPRESSION: .2, STRUCTURE_BALANCE: .2, MOVEMENT: .2, COAT_PRESENTATION: .2, TEMPERAMENT_RING_BEHAVIOR: .2 },
  judgeWeights: { TYPE_EXPRESSION: judge.categoryWeights.TYPE_EXPRESSION, STRUCTURE_BALANCE: judge.categoryWeights.STRUCTURE_BALANCE, MOVEMENT: judge.categoryWeights.MOVEMENT, COAT_PRESENTATION: judge.categoryWeights.COAT_PRESENTATION, TEMPERAMENT_RING_BEHAVIOR: judge.categoryWeights.TEMPERAMENT_RING_BEHAVIOR },
});

async function main() {
  const result = judgeBreedBlock({ entries: [{ showEntryId: "entry-1", dog }], judge, conformationCategoryWeights: effective, random01: () => .5 }).results[0];
  const originalScores = { baseScore: result.baseScore, finalScore: result.finalScore, finalRank: result.finalRank };
  const audit = createBreedJudgingResultAudit({ effectiveConformationWeights: effective, judge, result });
  validateBreedWeightedResultAudit({ scoringVersion: BREED_WEIGHTED_JUDGING_SCORING_VERSION, breedJudgingProfileId: "profile-v1", breedJudgingRulesVersion: "breed-judging-v1", audit });
  assert.deepEqual({ baseScore: result.baseScore, finalScore: result.finalScore, finalRank: result.finalRank }, originalScores, "audit creation does not change JUDGE-04 outcome");
  assert.equal(Object.values(audit.effectiveCategoryWeights).slice(0, 5).reduce((sum, value) => sum + value, 0), 5, "stored conformation effective weights retain fixed budget");
  assert.equal(audit.effectiveCategoryWeights.CONDITIONING_HANDLING, 1.1, "stored conditioning weight remains judge-specific and independent");
  assert.deepEqual(audit.realizedRandomness, { dogDayAdjustment: 0, ringRandomnessAdjustment: 0, tieBreakRoll: .5 }, "audit preserves realized values from the existing non-seeded RNG path without changing it");
  assert.deepEqual(readPersistedJudgingAudit({ scoringVersion: "judging-v1", breedJudgingProfileId: null, breedJudgingRulesVersion: null, breedJudgingAudit: null }), { kind: "LEGACY" }, "legacy result remains unknown rather than being backfilled");
  const stored = { scoringVersion: BREED_WEIGHTED_JUDGING_SCORING_VERSION, breedJudgingProfileId: "profile-v1", breedJudgingRulesVersion: "breed-judging-v1", breedJudgingAudit: audit };
  const persisted = readPersistedJudgingAudit(stored);
  assert.equal(persisted.kind, "BREED_WEIGHTED_V1", "new result has complete immutable audit identity");
  const futureVersion = readPersistedJudgingAudit({ ...stored, breedJudgingProfileId: "profile-v2", breedJudgingRulesVersion: "breed-judging-v2" });
  assert.equal(futureVersion.kind, "BREED_WEIGHTED_V1", "future profile versions use the same immutable audit contract");
  if (futureVersion.kind === "BREED_WEIGHTED_V1") assert.equal(futureVersion.rulesVersion, "breed-judging-v2", "new fixture result records v2 without rewriting v1");
  if (persisted.kind === "BREED_WEIGHTED_V1") {
    const beforeProfileEdit = structuredClone(persisted.audit);
    judge.categoryWeights.MOVEMENT = .75;
    assert.deepEqual(persisted.audit, beforeProfileEdit, "later mutable judge changes cannot alter persisted audit meaning");
    assert.equal(persisted.rulesVersion, "breed-judging-v1", "profile version snapshot remains stable");
  }
  const readViaHelper = await getJudgingAuditForResult({ client: { showResult: { findUnique: async () => stored } } as never, resultId: "result-v1" });
  assert.deepEqual(readViaHelper, persisted, "internal reader uses the persisted snapshot without resolving current profile data");
  await assert.rejects(() => getJudgingAuditForResult({ client: { showResult: { findUnique: async () => null } } as never, resultId: "missing" }), /not found/, "internal reader reports missing result");
  assert.throws(() => validateBreedWeightedResultAudit({ scoringVersion: BREED_WEIGHTED_JUDGING_SCORING_VERSION, breedJudgingProfileId: "profile-v1", breedJudgingRulesVersion: "breed-judging-v1", audit: { ...audit, effectiveCategoryWeights: { ...audit.effectiveCategoryWeights, MOVEMENT: 99 } } }), /total/, "invalid effective-budget audit is rejected before persistence");
  console.log("Judging audit versioning checks passed.");
}

void main();
