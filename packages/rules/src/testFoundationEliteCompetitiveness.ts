import assert from "node:assert/strict";

import {
  TOTAL_LOCI,
  TRAIT_KEYS,
  combineBreedAndJudgeConformationWeights,
  createFoundationDogProfile,
  createJudge,
  createResetFoundationPopulationContext,
  deriveBreedConformationCategoryWeights,
  judgeBreedEntries,
  type Dog,
  type DogTraits,
  type FoundationPopulationContextInput,
  type JudgeStyle,
} from "./index";
import { classifyFoundationDiamondDiagnostic, type FoundationDiamondDiagnosticClass } from "./foundationDiamondDiagnostics";

const SEEDS = [101, 202, 303] as const;
const PER_SEED = 3_000;
const VARIANCE_SEEDS = [701, 702] as const;
const JUDGE_STYLES: JudgeStyle[] = ["BALANCED", "TYPE_FOCUSED", "STRUCTURE_FOCUSED", "MOVEMENT_FOCUSED", "PRESENTATION_FOCUSED", "TEMPERAMENT_FOCUSED"];
const traits: DogTraits = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x1_0000_0000; };
const source = { mode: "LIVE" as const, snapshotId: "gen-09g-diagnostic", gameYear: 16, snapshotEpoch: 6_000, rulesVersion: "breed-background-v1", sourceFingerprint: "gen-09g-diagnostic", eligibleDogCount: 50, kennelCount: 5 };
type Scenario = "MATURE_REFINED" | "SKEWED_MATURE" | "BROAD_YOUNG" | "BOTTLENECK" | "RESET_FALLBACK";

function populationContext(scenario: Exclude<Scenario, "RESET_FALLBACK">): FoundationPopulationContextInput {
  const skewed = scenario === "SKEWED_MATURE", broad = scenario === "BROAD_YOUNG";
  const phenotype = skewed ? { center: 11.2, belowCenter: 10.2, aboveCenter: 12.2, belowShare: .15, aboveShare: .85, min: 7.2, max: 15.2, variance: 1 } : { center: 10, belowCenter: 9, aboveCenter: 11, belowShare: .5, aboveShare: .5, min: broad ? 3 : 7, max: broad ? 17 : 13, variance: broad ? 9 : .5 };
  const healthy = [{ component: "-1.0", share: .25 }, { component: "-.5", share: .25 }, { component: ".5", share: .25 }, { component: "1.0", share: .25 }];
  const bottleneck = [{ component: "-1.0", share: .92 }, { component: "1.0", share: .08 }];
  return {
    phenotypeContext: { source, traits: Object.fromEntries(TRAIT_KEYS.map(trait => [trait, { ...phenotype, meanAbsoluteDeviation: Math.sqrt(phenotype.variance), belowCount: 25, exactCount: 0, aboveCount: 25, nearIdealShare: .1 }])) },
    geneticDiversityContext: { source, payloadVersion: "breed-background-payload-v2", componentBinWidth: .5, overallMeanHomozygosity: .25, fixedLocusCount: 0, nearFixedLocusCount: 0, loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => {
      const scarce = scenario === "BOTTLENECK" && locus < 4, components = scarce ? bottleneck : healthy;
      return { locus, components, dominantShare: Math.max(...components.map(component => component.share)), effectiveComponentCount: 1 / components.reduce((sum, component) => sum + component.share ** 2, 0), homozygosity: .25, classification: scarce ? "NEAR_FIXED" as const : "DIVERSE" as const };
    }) },
  };
}

function makeDog(id: string, dogTraits: DogTraits): Dog {
  return { dogId: id, regNumber: id, breedCode2: "DG", birthEpoch: 0, sex: "M", status: "ALIVE", litterId: null, litterOrder: null, sireId: null, damId: null, traits: dogTraits, presentation: { conditioningSnapshot: 8 } };
}

function eliteComparators(scenario: Scenario): Dog[] {
  const offset = scenario === "SKEWED_MATURE" ? .45 : scenario === "BROAD_YOUNG" || scenario === "RESET_FALLBACK" ? .75 : .35;
  return [
    makeDog(`elite-a-${scenario}`, Object.fromEntries(TRAIT_KEYS.map((trait, index) => [trait, 10 + (index % 2 === 0 ? offset : -offset)])) as DogTraits),
    makeDog(`elite-b-${scenario}`, Object.fromEntries(TRAIT_KEYS.map((trait, index) => [trait, 10 + (index % 3 === 0 ? -offset * .8 : offset * .8)])) as DogTraits),
  ];
}

const breedWeights = deriveBreedConformationCategoryWeights({ head: .12, forequarters: .12, hindquarters: .12, gait: .14, coat: .08, size: .08, temperament: .08, show_shine: .08, feet: .08, topline: .10 });
const judges = JUDGE_STYLES.map((style, index) => createJudge({ judgeId: `judge-${style}`, name: style, style, random01: rng(10_000 + index) }));

function run(scenario: Scenario) {
  const context = scenario === "RESET_FALLBACK" ? createResetFoundationPopulationContext() : populationContext(scenario);
  const classCounts = new Map<FoundationDiamondDiagnosticClass, number>();
  const classWins = new Map<FoundationDiamondDiagnosticClass, number>();
  const selection = Array.from({ length: 3 }, () => ({ dogs: 0, wins: 0 }));
  const seedWins = new Map<number, number>(), seedComparisons = new Map<number, number>();
  let comparisons = 0, wins = 0, uniqueWins = 0, rareVariance = 0, judgeFit = 0, broadElite = 0;
  for (const seed of SEEDS) for (let index = 0; index < PER_SEED; index += 1) {
    const generated = createFoundationDogProfile({ dogId: `${scenario}-${seed}-${index}`, regNumber: `EG${seed}${index}`.padEnd(11, "0"), breedCode2: "DG", birthEpoch: 0, callName: "Diagnostic", breedBaseline: { breedCode2: "DG", traitMeans: traits }, populationContext: context, random01: rng(seed * 1_000_003 + index) });
    const foundation = { ...generated.dog, presentation: { conditioningSnapshot: 8 } };
    const classification = classifyFoundationDiamondDiagnostic({ traits: foundation.traits, populationContext: context, observedOpportunityCount: generated.geneticsAnalysis.observedOpportunityCount });
    const target = generated.geneticsAnalysis.opportunityTargetCount;
    classCounts.set(classification, (classCounts.get(classification) ?? 0) + 1); selection[target]!.dogs += 1;
    const stylesWon = new Set<string>(); let dogWins = 0;
    for (const judge of judges) {
      const weights = combineBreedAndJudgeConformationWeights({ breedWeights, judgeWeights: { TYPE_EXPRESSION: judge.categoryWeights.TYPE_EXPRESSION, STRUCTURE_BALANCE: judge.categoryWeights.STRUCTURE_BALANCE, MOVEMENT: judge.categoryWeights.MOVEMENT, COAT_PRESENTATION: judge.categoryWeights.COAT_PRESENTATION, TEMPERAMENT_RING_BEHAVIOR: judge.categoryWeights.TEMPERAMENT_RING_BEHAVIOR } });
      for (const elite of eliteComparators(scenario)) for (const varianceSeed of VARIANCE_SEEDS) {
        const result = judgeBreedEntries({ entries: [{ showEntryId: "foundation", dog: foundation }, { showEntryId: "elite", dog: elite, isChampion: true }], judge, conformationCategoryWeights: weights, random01: rng(seed * 10_000_019 + index * 101 + varianceSeed + judges.indexOf(judge)) });
        comparisons += 1; seedComparisons.set(seed, (seedComparisons.get(seed) ?? 0) + 1);
        if (result[0]!.showEntryId === "foundation") { wins += 1; dogWins += 1; stylesWon.add(judge.style); classWins.set(classification, (classWins.get(classification) ?? 0) + 1); selection[target]!.wins += 1; seedWins.set(seed, (seedWins.get(seed) ?? 0) + 1); }
      }
    }
    if (dogWins > 0) uniqueWins += 1;
    const dogRate = dogWins / (judges.length * eliteComparators(scenario).length * VARIANCE_SEEDS.length);
    if (dogWins > 0 && dogRate < .05) rareVariance += 1;
    else if (dogWins > 0 && stylesWon.size <= 1) judgeFit += 1;
    else if (dogRate >= .2 && stylesWon.size >= 3) broadElite += 1;
  }
  const totalDogs = SEEDS.length * PER_SEED;
  const rate = (value: number) => value / totalDogs;
  return { scenario, totalDogs, judges: judges.length, eliteComparators: 2, varianceRealizations: VARIANCE_SEEDS.length, comparisons, winRate: wins / comparisons, seedWinRates: SEEDS.map(seed => (seedWins.get(seed) ?? 0) / (seedComparisons.get(seed) ?? 1)), wilson95: (() => { const p = wins / comparisons, z = 1.96, d = 1 + z ** 2 / comparisons, c = (p + z ** 2 / (2 * comparisons)) / d, m = z / d * Math.sqrt(p * (1 - p) / comparisons + z ** 2 / (4 * comparisons ** 2)); return [c - m, c + m]; })(), uniqueWinRate: rate(uniqueWins), rareVarianceUpsetRate: rate(rareVariance), judgeFitUpsetRate: rate(judgeFit), broadEliteCompetitivenessRate: rate(broadElite), byClass: Object.fromEntries(["ORDINARY_NEITHER", "HIDDEN_GENETIC", "DIRECTIONAL_PHENOTYPE", "COMBINED", "REPAIR_RISK"].map(key => [key, { populationShare: (classCounts.get(key as FoundationDiamondDiagnosticClass) ?? 0) / totalDogs, winRate: (classWins.get(key as FoundationDiamondDiagnosticClass) ?? 0) / Math.max(1, (classCounts.get(key as FoundationDiamondDiagnosticClass) ?? 0) * judges.length * 2 * VARIANCE_SEEDS.length) }])), bySelection: selection.map(value => ({ populationShare: value.dogs / totalDogs, winRate: value.wins / Math.max(1, value.dogs * judges.length * 2 * VARIANCE_SEEDS.length) })) };
}

const reports = (["MATURE_REFINED", "SKEWED_MATURE", "BROAD_YOUNG", "BOTTLENECK", "RESET_FALLBACK"] as const).map(run);
const mature = reports[0]!;
assert.ok(mature.winRate > 0, "exceptional foundation wins remain possible");
assert.ok(mature.winRate < .05, "mature imports remain a rare-event tail rather than competitive parity");
assert.ok(mature.byClass.ORDINARY_NEITHER.winRate < .05, "ordinary imports do not routinely defeat mature elite comparators");
assert.ok(reports.every(report => report.broadEliteCompetitivenessRate < .01), "no scenario creates routine broadly elite foundation stock");
console.log(JSON.stringify({ methodologyVersion: "gen-09g-elite-competitiveness-v1", conditioning: "equal neutral conditioningSnapshot=8 for every dog", reports }));
