import assert from "node:assert/strict";

import {
  TOTAL_LOCI,
  TRAIT_KEYS,
  createFoundationDogProfile,
  isOrdinaryFoundationPhenotypePlausible,
  type DogTraits,
  type FoundationPopulationContextInput,
} from "./index";

const SEEDS = [101, 202, 303] as const;
const PER_SEED = 3_000;
const traits: DogTraits = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x1_0000_0000; };
const source = { mode: "LIVE" as const, snapshotId: "gen-09f-diagnostic", gameYear: 16, snapshotEpoch: 6_000, rulesVersion: "breed-background-v1", sourceFingerprint: "gen-09f-diagnostic", eligibleDogCount: 50, kennelCount: 5 };

type GeneticShape = "HEALTHY" | "NEAR_FIXED" | "EFFECTIVELY_FIXED" | "MULTIPLE_SCARCITY";
type PopulationDirection = "BALANCED" | "ABOVE" | "BELOW";

function context(geneticShape: GeneticShape, direction: PopulationDirection): FoundationPopulationContextInput {
  const phenotype = direction === "ABOVE"
    ? { center: 11.2, belowCenter: 10.2, aboveCenter: 12.2, belowShare: .15, aboveShare: .85, min: 7.2, max: 15.2 }
    : direction === "BELOW"
      ? { center: 8.8, belowCenter: 7.8, aboveCenter: 9.8, belowShare: .85, aboveShare: .15, min: 4.8, max: 12.8 }
      : { center: 10, belowCenter: 9, aboveCenter: 11, belowShare: .5, aboveShare: .5, min: 6, max: 14 };
  const healthyComponents = [{ component: "-1.0", share: .25 }, { component: "-.5", share: .25 }, { component: ".5", share: .25 }, { component: "1.0", share: .25 }];
  const scarce = (locus: number) => geneticShape === "MULTIPLE_SCARCITY" || (geneticShape !== "HEALTHY" && locus === 0);
  return {
    phenotypeContext: { source, traits: Object.fromEntries(TRAIT_KEYS.map(trait => [trait, { ...phenotype, variance: 1, meanAbsoluteDeviation: 1, belowCount: 25, exactCount: 0, aboveCount: 25, nearIdealShare: .1 }])) },
    geneticDiversityContext: { source, payloadVersion: "breed-background-payload-v2", componentBinWidth: .5, overallMeanHomozygosity: .25, fixedLocusCount: 0, nearFixedLocusCount: 0, loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => {
      const components = scarce(locus) ? geneticShape === "EFFECTIVELY_FIXED" ? [{ component: "-1.0", share: .99 }, { component: "1.0", share: .01 }] : [{ component: "-1.0", share: .92 }, { component: "1.0", share: .08 }] : healthyComponents;
      const classification = scarce(locus) ? geneticShape === "EFFECTIVELY_FIXED" ? "EFFECTIVELY_FIXED" as const : "NEAR_FIXED" as const : "DIVERSE" as const;
      return { locus, components, dominantShare: Math.max(...components.map(component => component.share)), effectiveComponentCount: 1 / components.reduce((sum, component) => sum + component.share ** 2, 0), homozygosity: .25, classification };
    }) },
  };
}

/** GEN-09F diagnostic only: a rare-side, clean-profile phenotype—not a persisted dog property. */
function directionalDiamond(input: { traits: DogTraits; populationContext: FoundationPopulationContextInput }): boolean {
  if (!isOrdinaryFoundationPhenotypePlausible(input)) return false;
  const qualifying = TRAIT_KEYS.filter(trait => {
    const profile = input.populationContext.phenotypeContext.traits?.[trait];
    if (!profile) return false;
    const majorityAbove = profile.aboveShare >= .75 && profile.belowShare <= .25;
    const majorityBelow = profile.belowShare >= .75 && profile.aboveShare <= .25;
    if (!majorityAbove && !majorityBelow) return false;
    const value = input.traits[trait], scale = Math.max(1, Math.sqrt(profile.variance));
    const majorityCenter = majorityAbove ? profile.aboveCenter : profile.belowCenter;
    return (majorityAbove ? value < 10 : value > 10) && Math.abs(value - (majorityCenter ?? profile.center)) >= 3 * scale;
  });
  if (qualifying.length !== 1) return false;
  return TRAIT_KEYS.filter(trait => trait !== qualifying[0]).every(trait => {
    const profile = input.populationContext.phenotypeContext.traits?.[trait]!;
    return Math.abs(input.traits[trait] - profile.center) <= 2 * Math.max(1, Math.sqrt(profile.variance));
  });
}

function ordinaryPhenotype(input: { traits: DogTraits; populationContext: FoundationPopulationContextInput }): boolean {
  return isOrdinaryFoundationPhenotypePlausible(input) && TRAIT_KEYS.filter(trait => input.traits[trait] < 5 || input.traits[trait] > 15).length < 2;
}

function run(name: string, populationContext: FoundationPopulationContextInput) {
  const counts = { neither: 0, hiddenOnly: 0, directionalOnly: 0, both: 0, repairRisk: 0, other: 0 };
  const bySelection = Array.from({ length: 3 }, () => ({ selected: 0, realized: 0, hidden: 0, directional: 0, both: 0, repairRisk: 0 }));
  let directionalWithoutTargeting = 0, realized = 0, directional = 0, both = 0, emergency = 0;
  for (const seed of SEEDS) for (let index = 0; index < PER_SEED; index += 1) {
    const result = createFoundationDogProfile({ dogId: `${name}-${seed}-${index}`, regNumber: `DF${seed}${index}`.padEnd(11, "0"), breedCode2: "DF", birthEpoch: 1, callName: "Diagnostic", breedBaseline: { breedCode2: "DF", traitMeans: traits }, populationContext, random01: rng(seed * 1_000_003 + index) });
    const target = result.geneticsAnalysis.opportunityTargetCount, observed = result.geneticsAnalysis.observedOpportunityCount;
    const genetic = observed > 0 && observed < 3;
    const visible = directionalDiamond({ traits: result.dog.traits, populationContext });
    const hidden = genetic && ordinaryPhenotype({ traits: result.dog.traits, populationContext }) && !visible;
    bySelection[target]!.selected += 1;
    if (genetic) { bySelection[target]!.realized += 1; realized += 1; }
    if (hidden) bySelection[target]!.hidden += 1;
    if (visible) { bySelection[target]!.directional += 1; directional += 1; if (target === 0) directionalWithoutTargeting += 1; }
    if (genetic && visible) { bySelection[target]!.both += 1; both += 1; }
    if (observed >= 3) { bySelection[target]!.repairRisk += 1; counts.repairRisk += 1; }
    else if (hidden) counts.hiddenOnly += 1;
    else if (genetic && visible) counts.both += 1;
    else if (visible) counts.directionalOnly += 1;
    else if (!genetic) counts.neither += 1;
    else counts.other += 1;
    if (result.plausibilityDiagnostics.usedEmergencyFallback) emergency += 1;
  }
  const total = SEEDS.length * PER_SEED;
  return { name, seeds: SEEDS, perSeed: PER_SEED, matrix: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value / total])), selected: bySelection.map(value => value.selected / total), bySelection: bySelection.map(value => ({ selected: value.selected / total, realized: value.realized / Math.max(1, value.selected), hiddenGeneticDiamond: value.hidden / Math.max(1, value.selected), directionalDiamond: value.directional / Math.max(1, value.selected), both: value.both / Math.max(1, value.selected), repairRisk: value.repairRisk / Math.max(1, value.selected) })), realizedGeneticOpportunity: realized / total, directionalDiamond: directional / total, either: (counts.hiddenOnly + counts.directionalOnly + counts.both) / total, both: both / total, directionalWithoutTargeting: directionalWithoutTargeting / Math.max(1, bySelection[0]!.selected), emergencyFallbackRate: emergency / total };
}

const above = context("HEALTHY", "ABOVE"), below = context("HEALTHY", "BELOW");
const sameValue: DogTraits = { ...traits, gait: 8.6 };
const multiExtreme: DogTraits = { head: 2, forequarters: 18, hindquarters: 2.4, gait: 19.6, coat: .8, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
assert.equal(directionalDiamond({ traits: sameValue, populationContext: above }), true, "8.6 is a clean opposite-side diamond against an above-ideal population");
assert.equal(directionalDiamond({ traits: sameValue, populationContext: below }), false, "the same value is not a directional diamond in a below-ideal population");
assert.equal(directionalDiamond({ traits: multiExtreme, populationContext: above }), false, "multi-trait extreme profiles are never desirable directional diamonds");

const reports = [
  run("HEALTHY_BALANCED", context("HEALTHY", "BALANCED")),
  run("ABOVE_BOTTLENECK", above),
  run("BELOW_BOTTLENECK", below),
  run("ONE_NEAR_FIXED", context("NEAR_FIXED", "BALANCED")),
  run("ONE_EFFECTIVELY_FIXED", context("EFFECTIVELY_FIXED", "BALANCED")),
  run("SEVERAL_SCARCITY", context("MULTIPLE_SCARCITY", "BALANCED")),
  run("COMBINED", context("NEAR_FIXED", "ABOVE")),
];
const report = (name: string) => reports.find(value => value.name === name)!;
console.log(JSON.stringify({ methodologyVersion: "gen-09f-hidden-and-directional-diamond-diagnostics-v1", reports }));
assert.equal(report("HEALTHY_BALANCED").directionalDiamond, 0, "balanced populations do not manufacture directional diamonds");
assert.ok(report("ABOVE_BOTTLENECK").directionalDiamond > 0 && report("BELOW_BOTTLENECK").directionalDiamond > 0, "opposite-side diamonds occur in directional bottlenecks");
assert.ok(report("ONE_NEAR_FIXED").matrix.hiddenOnly > 0 && report("ONE_EFFECTIVELY_FIXED").matrix.hiddenOnly > 0, "ordinary phenotypes can retain realized hidden scarcity opportunities");
assert.ok(report("COMBINED").matrix.directionalOnly > 0 && report("COMBINED").matrix.both > 0, "directional-only and combined diamonds both emerge without forcing coincidence");
assert.ok(reports.every(value => value.emergencyFallbackRate < .001 && value.matrix.repairRisk <= .025), "plausibility and repair-risk safety remain intact");
const severalScarcity = report("SEVERAL_SCARCITY");
assert.ok(severalScarcity.selected[0] >= .80 && severalScarcity.selected[0] <= .86 && severalScarcity.selected[1] >= .12 && severalScarcity.selected[1] <= .18 && severalScarcity.selected[2] >= .01 && severalScarcity.selected[2] <= .03, "contexts with at least two eligible loci retain the locked 83% / 15% / 2% selection budget");
