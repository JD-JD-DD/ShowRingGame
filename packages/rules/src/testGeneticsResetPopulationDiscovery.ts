import {
  DEFAULT_POPULATION_GROWTH_SCHEDULE,
  PopulationScale,
  SimulationScenario,
  discoverFounderDistributionCandidates,
  runPopulationScaleDiscovery,
  runNormalSelectionSimulation,
  runScenarioSimulation,
  type SimulationConfig,
} from "../simulation/geneticsCalibration.simulation";

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }

const base: SimulationConfig = {
  seed: "reset-discovery-test", generations: 200, founderSireCount: 8, founderDamCount: 16,
  litterSize: 6, matingsPerGeneration: 16, retainedSireCount: 6, retainedDamCount: 12,
  founderAlleleEffectSpread: 5.5, mutation: { probability: 0.001, effectMagnitude: 0.005 }, breedBackgroundCoefficient: 0,
};
const historicalFixture = runNormalSelectionSimulation({ ...base, seed: "genetics-calibration-diagnostic-v1", founderAlleleEffectSpread: 1.2, founderSireCount: 8, founderDamCount: 16, litterSize: 6, matingsPerGeneration: 16, retainedSireCount: 6, retainedDamCount: 12 });
assert(historicalFixture.checkpoints[0].meanMad === 1.5179246958333332 && historicalFixture.checkpoints.at(-1)?.meanMad === 0.3493545083333333, "historical diagnostic fixture must retain its documented G0/G200 regression values");
const candidates = discoverFounderDistributionCandidates({ spreads: [4, 5.5, 7.7], seeds: ["seed-a", "seed-b", "seed-c"], founderSireCount: 60, founderDamCount: 60 });
assert(candidates[0].meanG0Mad > 4.3 && candidates[0].meanG0Mad < 5.5, "first genotype-first candidate must naturally land near G0 MAD 5");
assert(candidates[1].meanG0Mad > 5.3 && candidates[1].meanG0Mad < 6.3, "second genotype-first candidate must naturally land near G0 MAD 6");
assert(candidates[2].meanG0Mad > 6.5 && candidates[2].meanG0Mad < 7.5, "third genotype-first candidate must naturally land near G0 MAD 7");
assert(candidates.every((candidate) => candidate.seedReports.every((report) => Object.values(report.checkpoint.perTrait).every((trait) => trait.below > 0 && trait.above > 0))), "symmetric founders must retain both directional phenotype sides");
assert(candidates.every((candidate) => candidate.seedReports.every((report) => report.checkpoint.diversity.meanUniqueAlleles > 100)), "founder candidates must retain substantial exact allele diversity");

const early = runPopulationScaleDiscovery(base, PopulationScale.EARLY);
const growing = runPopulationScaleDiscovery(base, PopulationScale.GROWING);
const mature = runPopulationScaleDiscovery(base, PopulationScale.MATURE);
const scheduled = runPopulationScaleDiscovery(base, "SCHEDULED", DEFAULT_POPULATION_GROWTH_SCHEDULE);
assert(early.result.checkpoints.at(-1)?.generation === 200 && growing.result.checkpoints.at(-1)?.generation === 200 && mature.result.checkpoints.at(-1)?.generation === 200 && scheduled.result.checkpoints.at(-1)?.generation === 200, "all fixed and scheduled population profiles must reach G200");
assert(early.result.cumulativeBirths < growing.result.cumulativeBirths && growing.result.cumulativeBirths < mature.result.cumulativeBirths, "selection opportunity must grow through EARLY, GROWING, and MATURE profiles");
assert(scheduled.result.contributionAudits[0].births < scheduled.result.contributionAudits[40].births && scheduled.result.contributionAudits[40].births < scheduled.result.contributionAudits[100].births, "growth schedule must alter only explicit population opportunity at configured transitions");
assert(early.progressionDeltas.length === 6 && scheduled.progressionDeltas.length === 6, "all checkpoint progression deltas must be reported");
assert(JSON.stringify(mature) === JSON.stringify(runPopulationScaleDiscovery(base, PopulationScale.MATURE)), "population-scale discovery must be deterministic");
const broadSmoke = runScenarioSimulation({ ...base, generations: 5, scenario: SimulationScenario.POPULAR_SIRE });
assert(broadSmoke.finalPopulationSize > 0, "existing scenarios must remain compatible with broad founders");

console.log("GEN-06C reset-population discovery tests passed");
