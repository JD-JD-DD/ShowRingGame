import assert from "node:assert/strict";
import { TOTAL_LOCI, TRAIT_KEYS, createFoundationDogProfile, type DogTraits, type FoundationPopulationContextInput } from "./index";

const N = 10_000;
const traits: DogTraits = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
type Shape = { components: Array<{ component: string; share: number }>; classification?: "DIVERSE" | "NEAR_FIXED" | "EFFECTIVELY_FIXED"; below?: number; above?: number };
function context(shape: Shape, override?: Shape): FoundationPopulationContextInput {
  const source = { mode: "LIVE" as const, snapshotId: "test", gameYear: 1, snapshotEpoch: 1, rulesVersion: "breed-background-v1", sourceFingerprint: "test", eligibleDogCount: 50, kennelCount: 5 };
  return { phenotypeContext: { source, traits: Object.fromEntries(TRAIT_KEYS.map((trait, index) => { const current = index === 0 && override ? override : shape; return [trait, { center: 10, variance: 1, meanAbsoluteDeviation: 1, min: 0, max: 20, belowCount: 1, exactCount: 0, aboveCount: 1, belowCenter: 9, aboveCenter: 11, belowShare: current.below ?? .45, aboveShare: current.above ?? .45, nearIdealShare: .1 }]; })) }, geneticDiversityContext: { source, payloadVersion: "breed-background-payload-v2", componentBinWidth: .5, overallMeanHomozygosity: 0, fixedLocusCount: 0, nearFixedLocusCount: 0, loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => { const current = locus === 0 && override ? override : shape; const dominantShare = Math.max(...current.components.map(component => component.share)); return { locus, classification: current.classification ?? "DIVERSE", components: current.components, dominantShare, effectiveComponentCount: 1 / current.components.reduce((sum, component) => sum + component.share * component.share, 0), homozygosity: 0 }; }) } };
}
function measure(name: string, populationContext: FoundationPopulationContextInput) {
  let targetOne = 0, targetOneObserved = 0, targetOneZero = 0, targetZero = 0, targetZeroObserved = 0; const observed = [0, 0, 0, 0];
  for (let index = 0; index < N; index += 1) { const result = createFoundationDogProfile({ dogId: `${name}-${index}`, regNumber: `AB${index}`.padEnd(11, "0"), breedCode2: "AB", birthEpoch: 1, callName: "Calibration", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext, random01: rng(70_000 + index) }); const count = result.geneticsAnalysis.observedOpportunityCount; observed[Math.min(3, count)] += 1; if (result.geneticsAnalysis.opportunityTargetCount === 1) { targetOne += 1; if (count === 0) targetOneZero += 1; else targetOneObserved += 1; } if (result.geneticsAnalysis.opportunityTargetCount === 0) { targetZero += 1; if (count > 0) targetZeroObserved += 1; } }
  return { name, observed: observed.map(value => value / N), targetOne, targetOneObserved, targetOneZero, targetOneRealization: targetOneObserved / targetOne, targetZeroAccidental: targetZeroObserved / targetZero };
}
const broad: Shape = { components: [{ component: "-1.0", share: .25 }, { component: "-0.5", share: .25 }, { component: "0.5", share: .25 }, { component: "1.0", share: .25 }] };
const low = measure("LOW", context(broad, { components: [{ component: "-1.0", share: .8 }, { component: "0.0", share: .15 }, { component: "1.0", share: .05 }] }));
const healthy = measure("HEALTHY", context(broad));
const bottleneck = measure("BOTTLENECK", context({ classification: "EFFECTIVELY_FIXED", components: [{ component: "-1.0", share: .99 }, { component: "1.0", share: .01 }], below: .9, above: .05 }));
const worst = measure("WORST", context({ classification: "NEAR_FIXED", components: [{ component: "-1.0", share: .9 }, { component: "1.0", share: .1 }], below: .9, above: .05 }));
assert.ok(low.observed[1] >= .12 && low.observed[1] <= .18 && low.observed[3] <= .005, "targeted low-frequency realization must enter the one-opportunity band without 3+ inflation");
assert.ok(low.targetOneZero > 0 && low.targetOneObserved > 0, "targeted low-frequency realization remains non-guaranteed");
assert.equal(healthy.observed.slice(1).reduce((sum, value) => sum + value, 0), 0, "healthy context remains opportunity-free");
assert.ok(bottleneck.observed[3] <= .005 && worst.observed[3] <= .005, "bottleneck and worst-case 3+ safety remains intact");
console.log(JSON.stringify({ methodologyVersion: "gen-09c4-targeted-diploid-calibration-v1", candidateSweep: [{ mix: .6, predictedObservedOne: .105 }, { mix: .65, predictedObservedOne: .113 }, { mix: .7, predictedObservedOne: .122 }, { mix: .75, predictedObservedOne: .13 }], selectedMix: .7, low, healthy, bottleneck, worst }));
