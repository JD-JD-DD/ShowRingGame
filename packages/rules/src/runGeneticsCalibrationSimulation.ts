import {
  DEFAULT_SCENARIO_OPTIONS,
  LONG_HORIZON_MAD_TARGET_BANDS,
  SimulationScenario,
  runComplementarityExperiment,
  runDiagnosticScenarioComparison,
  runNormalSelectionSimulation,
  runProducerConsistencyExperiment,
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

if (process.argv[2] === "compare") {
  const scenarios = runDiagnosticScenarioComparison(configuration);
  const outcross20 = runScenarioSimulation({ ...configuration, scenario: SimulationScenario.NORMAL_SELECTION, scenarioOptions: { outcross: { generation: 20, alleleEffect: 0.75 } } });
  const outcross50 = runScenarioSimulation({ ...configuration, scenario: SimulationScenario.NORMAL_SELECTION, scenarioOptions: { outcross: { generation: 50, alleleEffect: 0.75 } } });
  console.log(JSON.stringify({
    methodologyVersion: "genetics-calibration-v1",
    targetBands: LONG_HORIZON_MAD_TARGET_BANDS,
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
