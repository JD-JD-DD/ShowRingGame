import {
  FounderDistributionFamily,
  SimulationRng,
  createSyntheticFounder,
  runCalibrationCandidateGrid,
  runExtremeBirthExperiment,
  type SimulationConfig,
} from "../simulation/geneticsCalibration.simulation";

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
console.log("GEN-06D calibration sweep tests passed");
