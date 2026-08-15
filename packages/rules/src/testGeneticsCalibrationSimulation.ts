import {
  CURRENT_GENETICS_VERSION,
  TOTAL_ALLELE_VALUES,
  TOTAL_LOCI,
  calculatePhenotypeFromGenotype,
  type CanonicalGenotype,
} from "../src/index";
import {
  SimulationRng,
  calculateCheckpointMetrics,
  createSyntheticFounder,
  runNormalSelectionSimulation,
  type SimulationConfig,
  type SimulationDog,
} from "../simulation/geneticsCalibration.simulation";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const config: SimulationConfig = {
  seed: "simulation-test-seed",
  generations: 20,
  founderSireCount: 4,
  founderDamCount: 6,
  litterSize: 4,
  matingsPerGeneration: 6,
  retainedSireCount: 3,
  retainedDamCount: 4,
  founderAlleleEffectSpread: 0.8,
  mutation: { probability: 0.01, effectMagnitude: 0.001 },
  breedBackgroundCoefficient: 0,
};

const sameSeedA = new SimulationRng("repeatable");
const sameSeedB = new SimulationRng("repeatable");
assert(Array.from({ length: 12 }, () => sameSeedA.next()).join(",") === Array.from({ length: 12 }, () => sameSeedB.next()).join(","), "simulation RNG must be seed-deterministic");

const founderA = createSyntheticFounder(new SimulationRng("founder"), "founder-a", 0, "M", 0.8);
const founderB = createSyntheticFounder(new SimulationRng("founder"), "founder-a", 0, "M", 0.8);
assert(JSON.stringify(founderA) === JSON.stringify(founderB), "synthetic founders must be reproducible");
assert(founderA.genotype.loci.length === TOTAL_LOCI && founderA.genotype.loci.flat().length === TOTAL_ALLELE_VALUES, "founders must have a canonical 40/80 genotype");
assert(founderA.genotype.loci.flat().every((allele) => Math.abs(allele) <= 0.8 && Math.abs(Math.round(allele * 1_000_000) - allele * 1_000_000) < 1e-7), "founder alleles must be bounded six-decimal values");
assert(founderA.genotype.loci.flat().some((allele) => allele < 0) && founderA.genotype.loci.flat().some((allele) => allele > 0), "founder allele effects must support both signs");

const resultA = runNormalSelectionSimulation(config);
const resultB = runNormalSelectionSimulation(config);
assert(JSON.stringify(resultA) === JSON.stringify(resultB), "whole simulation must be deterministic for a fixed seed");
assert(JSON.stringify(resultA) !== JSON.stringify(runNormalSelectionSimulation({ ...config, seed: "different-seed" })), "different seed must produce a distinct run");
assert(resultA.finalPopulationSize === config.litterSize * config.matingsPerGeneration, "only the current offspring cohort should be retained");
assert(resultA.checkpoints.map((checkpoint) => checkpoint.generation).join(",") === "0,3,10,20", "expected checkpoints must be recorded");
assert(resultA.checkpoints.every((checkpoint) => checkpoint.bestMad <= checkpoint.medianMad && checkpoint.medianMad <= checkpoint.worstMad), "MAD summaries must maintain best-to-worst ordering");
assert(resultA.checkpoints.every((checkpoint) => checkpoint.diversity.meanHomozygosity >= 0 && checkpoint.diversity.meanHomozygosity <= 1), "diversity metrics must be bounded");

const neutralGenotype: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci: Array.from({ length: TOTAL_LOCI }, () => [0, 0] as const) };
const neutralDog: SimulationDog = { id: "neutral", generation: 0, sex: "M", genotype: neutralGenotype, phenotype: calculatePhenotypeFromGenotype(neutralGenotype), familyId: "neutral" };
const directionalMetrics = calculateCheckpointMetrics([neutralDog, founderA], 0, 0);
assert(directionalMetrics.bestMad === 0 && directionalMetrics.worstMad > 0, "metrics must distinguish an ideal dog from a non-ideal dog");
assert(directionalMetrics.exact10.dogsAllTen === 1, "exact-ten accounting must include the ideal dog");

const g200 = runNormalSelectionSimulation({ ...config, generations: 200, mutation: { probability: 0, effectMagnitude: 0 } });
assert(g200.checkpoints.at(-1)?.generation === 200, "G200 run must reach and report generation 200");

console.log("GEN-06 genetics calibration simulation tests passed");
