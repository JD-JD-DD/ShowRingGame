import {
  FounderDistributionFamily,
  SimulationRng,
  createSyntheticFounder,
  runCalibrationCandidateGrid,
  runExtremeBirthExperiment,
  summarizeFinalistValidation,
  type SimulationConfig,
} from "../simulation/geneticsCalibration.simulation";
import { FINAL_GENETICS_CALIBRATION, FINAL_GENETICS_CHECKPOINT_BANDS } from "../calibration/geneticsCalibration.constants";

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
const base: SimulationConfig = { seed: "calibration-test", generations: 20, founderSireCount: 8, founderDamCount: 16, litterSize: 6, matingsPerGeneration: 16, retainedSireCount: 6, retainedDamCount: 12, founderAlleleEffectSpread: 5.5, mutation: { probability: 0.001, effectMagnitude: 0.005 }, breedBackgroundCoefficient: 0 };
const results = runCalibrationCandidateGrid({ baseConfig: base, seeds: ["a", "b"], candidates: [
  { id: "uniform", founderDistribution: { family: FounderDistributionFamily.UNIFORM, spread: 5.5 }, mutation: { probability: 0, effectMagnitude: 0 }, breedBackgroundCoefficient: 0 },
  { id: "normal", founderDistribution: { family: FounderDistributionFamily.NORMAL_LIKE, spread: 14 }, mutation: { probability: 0.001, effectMagnitude: 0.005 }, breedBackgroundCoefficient: 0.02 },
] });
assert(results.length === 2 && results.every((result) => result.seedRuns.length === 2), "candidate grid must preserve every explicit candidate and seed");
assert(results[0].seedRuns.every((run) => run.mutationAudit.count === 0), "mutation-zero baseline must remain mutation-free");
assert(results[1].seedRuns.every((run) => run.mutationAudit.positiveCount + run.mutationAudit.negativeCount <= run.mutationAudit.count), "mutation audit must account symmetrically for signed changes");
assert(JSON.stringify(results) === JSON.stringify(runCalibrationCandidateGrid({ baseConfig: base, seeds: ["a", "b"], candidates: [
  { id: "uniform", founderDistribution: { family: FounderDistributionFamily.UNIFORM, spread: 5.5 }, mutation: { probability: 0, effectMagnitude: 0 }, breedBackgroundCoefficient: 0 },
  { id: "normal", founderDistribution: { family: FounderDistributionFamily.NORMAL_LIKE, spread: 14 }, mutation: { probability: 0.001, effectMagnitude: 0.005 }, breedBackgroundCoefficient: 0.02 },
] })), "bounded calibration grid must be deterministic");
const sire = createSyntheticFounder(new SimulationRng("extreme-sire"), "sire", 0, "M", 14, { family: FounderDistributionFamily.NORMAL_LIKE, spread: 14 });
const dam = createSyntheticFounder(new SimulationRng("extreme-dam"), "dam", 0, "F", 14, { family: FounderDistributionFamily.NORMAL_LIKE, spread: 14 });
const extreme = runExtremeBirthExperiment({ seed: "extreme", sire, dam, births: 100, mutation: { probability: 0.001, effectMagnitude: 0.005 } });
assert(extreme.births === 100 && Number.isFinite(extreme.bestMad), "extreme-birth experiment must remain separate and deterministic");
const finalSummary = summarizeFinalistValidation(results[0].candidate, results[0].seedRuns);
assert(finalSummary.g0.length === 2 && finalSummary.g0.every((report) => report.populationSize === 16), "finalist validation must retain detailed genotype-first G0 saturation evidence");
assert(finalSummary.checkpoints["20"].mean > 0, "finalist validation must summarize scheduled checkpoint evidence");
assert(FINAL_GENETICS_CALIBRATION.breedBackgroundCoefficient === 0, "selected GEN-06 calibration must retain the evaluated zero background coefficient");
assert(FINAL_GENETICS_CHECKPOINT_BANDS.G200[0] < FINAL_GENETICS_CHECKPOINT_BANDS.G200[1], "checkpoint guidance must be a non-runtime range");
console.log("GEN-06E calibration sweep tests passed");
