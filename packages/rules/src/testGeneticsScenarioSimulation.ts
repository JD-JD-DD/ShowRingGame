import {
  SimulationScenario,
  SimulationRng,
  createSimulationOutcrossDonor,
  createSyntheticFounder,
  getSimulationDogMad,
  runComplementarityExperiment,
  runProducerConsistencyExperiment,
  runScenarioSimulation,
  type ScenarioSimulationConfig,
} from "../simulation/geneticsCalibration.simulation";

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }

const base: Omit<ScenarioSimulationConfig, "scenario"> = {
  seed: "scenario-test-v1", generations: 30, founderSireCount: 6, founderDamCount: 10,
  litterSize: 4, matingsPerGeneration: 8, retainedSireCount: 4, retainedDamCount: 6,
  founderAlleleEffectSpread: 0.8, mutation: { probability: 0, effectMagnitude: 0 }, breedBackgroundCoefficient: 0,
};
const normal = runScenarioSimulation({ ...base, scenario: SimulationScenario.NORMAL_SELECTION });
const highVolumeConfig: ScenarioSimulationConfig = { ...base, scenario: SimulationScenario.AGGRESSIVE_HIGH_VOLUME, scenarioOptions: { matingsPerGeneration: 24, litterSize: 8 } };
const highVolume = runScenarioSimulation(highVolumeConfig);
assert(highVolume.contributionAudits[0].births > normal.contributionAudits[0].births * 4, "high volume must materially increase births");
assert(highVolume.finalPopulationSize === 24 * 8, "high volume final cohort must follow configured birth volume");
assert(JSON.stringify(highVolume) === JSON.stringify(runScenarioSimulation(highVolumeConfig)), "high volume must be deterministic");

const popular = runScenarioSimulation({ ...base, scenario: SimulationScenario.POPULAR_SIRE, scenarioOptions: { popularSireCount: 1, popularSireMatingShare: 0.75 } });
assert(popular.contributionAudits.every((audit) => audit.maxSireContributionShare >= 0.75), "popular sire must supply configured mating share");
assert(popular.contributionAudits[0].uniqueSiresUsed < normal.contributionAudits[0].uniqueSiresUsed, "popular sire must reduce sire usage");

const bottleneck = runScenarioSimulation({ ...base, scenario: SimulationScenario.BOTTLENECK, scenarioOptions: { bottleneckStartGeneration: 10, bottleneckDuration: 3, bottleneckSireCount: 1, bottleneckDamCount: 2, bottleneckFamilyCount: 1 } });
const bottleneckAudits = bottleneck.contributionAudits.filter((audit) => audit.generation >= 10 && audit.generation < 13);
assert(bottleneckAudits.every((audit) => audit.uniqueSiresUsed === 1 && audit.uniqueDamsUsed <= 2 && audit.representedFamilies === 1), "bottleneck contributor restrictions must be enforced");
assert(bottleneck.finalPopulationSize === base.litterSize * base.matingsPerGeneration, "population must numerically recover after bottleneck");

const diversity = runScenarioSimulation({ ...base, scenario: SimulationScenario.DIVERSITY_PRESERVING });
assert(diversity.contributionAudits[0].representedFamilies >= normal.contributionAudits[0].representedFamilies, "diversity selection must retain available family representation");
assert(JSON.stringify(diversity) === JSON.stringify(runScenarioSimulation({ ...base, scenario: SimulationScenario.DIVERSITY_PRESERVING })), "diversity scenario must be deterministic");

const producer = runProducerConsistencyExperiment();
assert(producer.phenotypeEqual && !producer.genotypeEqual, "producer fixture must be phenotype-equal but genotype-distinct");
assert(producer.first.offspringMadVariance !== producer.second.offspringMadVariance, "producer distributions must emerge differently from ordinary inheritance");
const complementarity = runComplementarityExperiment();
assert(complementarity.litter.meanOffspringMad < complementarity.belowParentMad, "opposite-side parents should center offspring nearer ideal");
assert(complementarity.litter.uniqueGenotypes > 1 && complementarity.exactIdealCount < complementarity.litter.puppyCount, "complementarity must remain variable and cannot force exact ideal");

const outcross = runScenarioSimulation({ ...base, scenario: SimulationScenario.NORMAL_SELECTION, scenarioOptions: { outcross: { generation: 20, alleleEffect: 0.75 } } });
assert(outcross.contributionAudits.find((audit) => audit.generation === 20)?.outcrossDonorId === "outcross-g20", "outcross donor must enter through one ordinary mating");
assert(outcross.contributionAudits.find((audit) => audit.generation === 21)?.outcrossDonorId === undefined, "outcross donor must receive no automatic later retention");
const outcross50 = runScenarioSimulation({ ...base, scenario: SimulationScenario.NORMAL_SELECTION, scenarioOptions: { outcross: { generation: 25, alleleEffect: 0.75 } } });
assert(outcross50.contributionAudits.find((audit) => audit.generation === 25)?.outcrossDonorId === "outcross-g25", "later outcross intervention must be measurable");
const donor = createSimulationOutcrossDonor("donor", 0, "M", 0.75);
const ordinaryFounder = createSyntheticFounder(new SimulationRng("ordinary"), "ordinary", 0, "M", 0.2);
assert(getSimulationDogMad(donor) > getSimulationDogMad(ordinaryFounder), "synthetic outcross donor must not be automatically phenotype-superior");
assert(JSON.stringify(donor.genotype.loci) !== JSON.stringify(ordinaryFounder.genotype.loci), "synthetic outcross donor must be genetically distinct");

console.log("GEN-06 scenario simulation tests passed");
