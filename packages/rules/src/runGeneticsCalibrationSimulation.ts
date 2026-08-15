import {
  DEFAULT_SCENARIO_OPTIONS,
  DEFAULT_POPULATION_GROWTH_SCHEDULE,
  FounderDistributionFamily,
  HISTORICAL_SUPERSEDED_MAD_BANDS,
  SimulationScenario,
  runComplementarityExperiment,
  runDiagnosticScenarioComparison,
  runNormalSelectionSimulation,
  runProducerConsistencyExperiment,
  runResetPopulationDiscovery,
  runCalibrationCandidateGrid,
  runScenarioSimulation,
  summarizeScenario,
  type SimulationConfig,
} from "../simulation/geneticsCalibration.simulation";

const generations = Number(process.argv[3] ?? "200");
const configuration: SimulationConfig = {
  seed: process.argv[2] === "compare" ? "genetics-calibration-diagnostic-v1" : (process.argv[2] ?? "genetics-calibration-diagnostic-v1"),
  generations,
  founderSireCount: 8,
  founderDamCount: 16,
  litterSize: 6,
  matingsPerGeneration: 16,
  retainedSireCount: 6,
  retainedDamCount: 12,
  founderAlleleEffectSpread: 1.2,
  mutation: { probability: 0.001, effectMagnitude: 0.005 },
  breedBackgroundCoefficient: 0,
};

if (process.argv[2] === "calibrate") {
  const candidates = [
    { id: "uniform-5.5-zero", founderDistribution: { family: FounderDistributionFamily.UNIFORM, spread: 5.5 }, mutation: { probability: 0, effectMagnitude: 0 }, breedBackgroundCoefficient: 0 },
    { id: "triangular-8-muted", founderDistribution: { family: FounderDistributionFamily.TRIANGULAR, spread: 8 }, mutation: { probability: 0.0005, effectMagnitude: 0.0025 }, breedBackgroundCoefficient: 0 },
    { id: "normal-like-14-current", founderDistribution: { family: FounderDistributionFamily.NORMAL_LIKE, spread: 14 }, mutation: { probability: 0.001, effectMagnitude: 0.005 }, breedBackgroundCoefficient: 0 },
    { id: "normal-like-14-background", founderDistribution: { family: FounderDistributionFamily.NORMAL_LIKE, spread: 14 }, mutation: { probability: 0.002, effectMagnitude: 0.01 }, breedBackgroundCoefficient: 0.02 },
  ] as const;
  const results = runCalibrationCandidateGrid({ baseConfig: { ...configuration, seed: "calibration-grid", founderAlleleEffectSpread: 5.5 }, candidates: [...candidates], seeds: ["calibration-a", "calibration-b", "calibration-c"] });
  console.log(JSON.stringify({ methodologyVersion: "genetics-calibration-v1", calibrationPass: "genetics-parameter-calibration-v1", seeds: ["calibration-a", "calibration-b", "calibration-c"], results: results.map((result) => ({ candidate: result.candidate, checkpoints: result.checkpointRanges, mutationPerThousandBirths: result.seedRuns.map((run) => run.mutationAudit.count * 1000 / run.cumulativeBirths), mutationSymmetry: result.seedRuns.map((run) => ({ positive: run.mutationAudit.positiveCount, negative: run.mutationAudit.negativeCount, meanSigned: run.mutationAudit.count ? run.mutationAudit.signedEffect / run.mutationAudit.count : 0 })), g0Clamp: result.seedRuns.map((run) => run.checkpoints[0].clampFrequency), g200: result.seedRuns.map((run) => ({ homozygosity: run.checkpoints.at(-1)?.diversity.meanHomozygosity, fixedLoci: run.checkpoints.at(-1)?.diversity.fixedLoci, exact10: run.checkpoints.at(-1)?.exact10.traitFrequency, nearPerfect: run.checkpoints.at(-1)?.nearPerfect["0.100"] })), warnings: result.warnings })) }, null, 2));
} else if (process.argv[2] === "discover") {
  const report = runResetPopulationDiscovery({
    baseConfig: { ...configuration, seed: "reset-population-discovery-v1", founderAlleleEffectSpread: 5.5 },
    candidateSpreads: [4, 5.5, 7.7],
    seeds: ["reset-discovery-a", "reset-discovery-b", "reset-discovery-c"],
    founderSampleCounts: { sires: 100, dams: 100 },
    growthSchedule: DEFAULT_POPULATION_GROWTH_SCHEDULE,
  });
  const summarizeRun = (run: typeof report.fixedScaleRuns[number]) => ({ profile: run.profile, checkpoints: run.result.checkpoints.map((checkpoint) => ({ generation: checkpoint.generation, meanMad: checkpoint.meanMad, medianMad: checkpoint.medianMad, bestMad: checkpoint.bestMad, clampFrequency: checkpoint.clampFrequency, homozygosity: checkpoint.diversity.meanHomozygosity, fixedLoci: checkpoint.diversity.fixedLoci })), cumulativeBirths: run.result.cumulativeBirths, progressionDeltas: run.progressionDeltas });
  console.log(JSON.stringify({
    methodologyVersion: report.methodologyVersion, discoveryPass: report.discoveryPass, geneticsVersion: report.geneticsVersion,
    mutation: report.mutation, breedBackgroundCoefficient: report.breedBackgroundCoefficient, growthSchedule: DEFAULT_POPULATION_GROWTH_SCHEDULE,
    founderCandidates: report.founderCandidates.map((candidate) => ({ spread: candidate.founderAlleleEffectSpread, meanG0Mad: candidate.meanG0Mad, medianG0Mad: candidate.medianG0Mad, betweenSeedMadStandardDeviation: candidate.betweenSeedMadStandardDeviation, clampFrequency: candidate.seedReports.map((seed) => seed.checkpoint.clampFrequency), alleleBoundFrequency: candidate.meanAlleleBoundFrequency, directionalBalance: { below: candidate.seedReports.map((seed) => Object.values(seed.checkpoint.perTrait).reduce((sum, trait) => sum + trait.below, 0)), above: candidate.seedReports.map((seed) => Object.values(seed.checkpoint.perTrait).reduce((sum, trait) => sum + trait.above, 0)) }, flags: candidate.flags })),
    primaryCandidateSpread: report.primaryCandidateSpread,
    fixedScaleRuns: report.fixedScaleRuns.map(summarizeRun), scheduledGrowthRun: summarizeRun(report.scheduledGrowthRun), candidateScheduledRuns: report.candidateScheduledRuns.map((run, index) => ({ founderSpread: report.founderCandidates[index].founderAlleleEffectSpread, ...summarizeRun(run) })),
    matureHighVolume: { cumulativeBirths: report.matureHighVolumeRun.cumulativeBirths, checkpoints: report.matureHighVolumeRun.checkpoints.map((checkpoint) => ({ generation: checkpoint.generation, meanMad: checkpoint.meanMad, bestMad: checkpoint.bestMad, fixedLoci: checkpoint.diversity.fixedLoci, exact10: checkpoint.exact10.traitFrequency, nearPerfect: checkpoint.nearPerfect["0.100"] })) },
    broaderFounderScenarioSmoke: Object.fromEntries(Object.entries(report.broaderFounderScenarioSmoke).map(([scenario, result]) => [scenario, { finalPopulationSize: result.finalPopulationSize, finalGeneration: result.checkpoints.at(-1)?.generation, cumulativeBirths: result.cumulativeBirths }])),
  }, null, 2));
} else if (process.argv[2] === "compare") {
  const scenarios = runDiagnosticScenarioComparison(configuration);
  const outcross20 = runScenarioSimulation({ ...configuration, scenario: SimulationScenario.NORMAL_SELECTION, scenarioOptions: { outcross: { generation: 20, alleleEffect: 0.75 } } });
  const outcross50 = runScenarioSimulation({ ...configuration, scenario: SimulationScenario.NORMAL_SELECTION, scenarioOptions: { outcross: { generation: 50, alleleEffect: 0.75 } } });
  console.log(JSON.stringify({
    methodologyVersion: "genetics-calibration-v1",
    historicalSupersededCheckpointGuidance: HISTORICAL_SUPERSEDED_MAD_BANDS,
    diagnosticConfiguration: configuration,
    scenarioDefaults: DEFAULT_SCENARIO_OPTIONS,
    scenarios: scenarios.map(summarizeScenario),
    producerConsistency: (() => {
      const result = runProducerConsistencyExperiment();
      return { phenotypeEqual: result.phenotypeEqual, genotypeEqual: result.genotypeEqual, heterozygous: { meanMad: result.first.meanOffspringMad, variance: result.first.offspringMadVariance, uniqueGenotypes: result.first.uniqueGenotypes }, homozygous: { meanMad: result.second.meanOffspringMad, variance: result.second.offspringMadVariance, uniqueGenotypes: result.second.uniqueGenotypes } };
    })(),
    complementarity: (() => {
      const result = runComplementarityExperiment();
      return { belowParentMad: result.belowParentMad, aboveParentMad: result.aboveParentMad, meanOffspringMad: result.litter.meanOffspringMad, uniqueGenotypes: result.litter.uniqueGenotypes, exactIdealCount: result.exactIdealCount, puppyCount: result.litter.puppyCount };
    })(),
    outcrossG20: summarizeScenario(outcross20),
    outcrossG50: summarizeScenario(outcross50),
  }, null, 2));
} else {
  console.log(JSON.stringify(runNormalSelectionSimulation(configuration), null, 2));
}
