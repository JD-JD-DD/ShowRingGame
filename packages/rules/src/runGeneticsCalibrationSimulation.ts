import { runNormalSelectionSimulation, type SimulationConfig } from "../simulation/geneticsCalibration.simulation";

const generations = Number(process.argv[3] ?? "200");
const configuration: SimulationConfig = {
  seed: process.argv[2] ?? "genetics-calibration-diagnostic-v1",
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

console.log(JSON.stringify(runNormalSelectionSimulation(configuration), null, 2));
