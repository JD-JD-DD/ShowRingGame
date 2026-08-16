import assert from "node:assert/strict";

import {
  CURRENT_GENETICS_VERSION,
  TOTAL_LOCI,
  TRAIT_KEYS,
  createFoundationDogProfile,
  decodeGenotype,
  type DogTraits,
  type FoundationPopulationContextInput,
  type OpportunityReason,
} from "./index";

/** GEN-09D: deterministic, in-memory validation of the canonical production generator. */
const METHODOLOGY_VERSION = "gen-09d-foundation-validation-v1";
// One 10,000-dog seed per context is the practical deterministic minimum under
// the repository command-time ceiling; the report records this limitation.
const SEEDS = [101] as const;
const PER_SEED = 10_000;
const traits: DogTraits = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const reasons: OpportunityReason[] = ["OPPOSITE_DIRECTION_SCARCITY", "LOW_FREQUENCY_COMPONENT", "NEAR_FIXED_LOCUS_DIVERSITY", "EFFECTIVELY_FIXED_LOCUS_DIVERSITY"];
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
const percentile = (values: number[], q: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * q))]!;
const distribution = (values: number[]) => { const ordered = [...values].sort((a, b) => a - b); return { p10: percentile(ordered, .1), p25: percentile(ordered, .25), median: percentile(ordered, .5), p75: percentile(ordered, .75), p90: percentile(ordered, .9) }; };
const percent = (value: number, total: number) => Number((100 * value / total).toFixed(3));
const mad = (dog: DogTraits) => TRAIT_KEYS.reduce((sum, trait) => sum + Math.abs(dog[trait] - 10), 0) / TRAIT_KEYS.length;

type Shape = { components: Array<{ component: string; share: number }>; classification?: "DIVERSE" | "NEAR_FIXED" | "EFFECTIVELY_FIXED"; below?: number; above?: number };
function liveContext(shape: Shape, overrides: Partial<Record<number, Shape>> = {}, mode: "LIVE" | "RETAINED_BASELINE" = "LIVE"): FoundationPopulationContextInput {
  const at = (locus: number) => overrides[locus] ?? shape;
  return {
    mode,
    phenotype: Object.fromEntries(TRAIT_KEYS.map((trait, index) => { const current = at(index * 4); return [trait, { belowShare: current.below ?? .45, aboveShare: current.above ?? .45, nearIdealShare: .1 }]; })),
    genotype: { payloadVersion: "breed-background-payload-v2", loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => { const current = at(locus); return { locus, classification: current.classification ?? "DIVERSE", components: current.components }; }) },
  };
}
const healthy = liveContext({ components: [{ component: "-1.0", share: .25 }, { component: "-0.5", share: .25 }, { component: "0.5", share: .25 }, { component: "1.0", share: .25 }] });
const below = liveContext({ components: [{ component: "-1.0", share: .25 }, { component: "-0.5", share: .25 }, { component: "0.5", share: .25 }, { component: "1.0", share: .25 }] }, { 0: { components: [{ component: "-1.0", share: .75 }, { component: "1.0", share: .25 }], below: .9, above: .05 } });
const above = liveContext({ components: [{ component: "-1.0", share: .25 }, { component: "-0.5", share: .25 }, { component: "0.5", share: .25 }, { component: "1.0", share: .25 }] }, { 0: { components: [{ component: "-1.0", share: .25 }, { component: "1.0", share: .75 }], below: .05, above: .9 } });
const lowFrequency = liveContext({ components: [{ component: "-1.0", share: .25 }, { component: "-0.5", share: .25 }, { component: "0.5", share: .25 }, { component: "1.0", share: .25 }] }, { 0: { components: [{ component: "-1.0", share: .8 }, { component: "0.0", share: .15 }, { component: "1.0", share: .05 }] } });
const nearFixed = liveContext({ components: [{ component: "-1.0", share: .25 }, { component: "-0.5", share: .25 }, { component: "0.5", share: .25 }, { component: "1.0", share: .25 }] }, { 0: { classification: "NEAR_FIXED", components: [{ component: "-1.0", share: .95 }, { component: "1.0", share: .05 }] } });
const effectivelyFixed = liveContext({ components: [{ component: "-1.0", share: .25 }, { component: "-0.5", share: .25 }, { component: "0.5", share: .25 }, { component: "1.0", share: .25 }] }, { 0: { classification: "EFFECTIVELY_FIXED", components: [{ component: "-1.0", share: .99 }, { component: "1.0", share: .01 }] } });
const bottleneck = liveContext({ classification: "EFFECTIVELY_FIXED", components: [{ component: "-1.0", share: .99 }, { component: "1.0", share: .01 }], below: .9, above: .05 });
const worst = liveContext({ classification: "NEAR_FIXED", components: [{ component: "-1.0", share: .9 }, { component: "1.0", share: .1 }], below: .9, above: .05 });
const rough = liveContext({ components: [{ component: "-2.0", share: .55 }, { component: "-1.5", share: .45 }], below: .75, above: .2 });
const refined = liveContext({ components: [{ component: "-0.5", share: .5 }, { component: "0.5", share: .5 }], below: .45, above: .45 });
const reset: FoundationPopulationContextInput = { mode: "RESET_FALLBACK", genotype: null, phenotype: null };
const retained = liveContext({ components: [{ component: "-0.5", share: .5 }, { component: "0.5", share: .5 }] }, {}, "RETAINED_BASELINE");

function run(name: string, populationContext: FoundationPopulationContextInput) {
  const targets = [0, 0, 0], observed = [0, 0, 0, 0], reasonCounts = Object.fromEntries(reasons.map(reason => [reason, 0])) as Record<OpportunityReason, number>;
  const mads: number[] = [], byObserved = [[], [], []] as number[][]; let multiReasonIdentityCount = 0, rawReasonCount = 0, targetOneRealized = 0, targetTwoOne = 0, targetTwoTwo = 0, accidental = 0, positiveAtLocus0 = 0, negativeAtLocus0 = 0, commonAtLocus0 = 0, lowAtLocus0 = 0, genotypeNonPopulationBins = 0;
  const populationBins = new Set((((populationContext.genotype as { loci?: Array<{ components: Array<{ component: string }> }> })?.loci?.flatMap(locus => locus.components.map(component => component.component))) ?? []));
  for (const seed of SEEDS) for (let index = 0; index < PER_SEED; index += 1) {
    const result = createFoundationDogProfile({ dogId: `${name}-${seed}-${index}`, regNumber: `AB${seed}${index}`.padEnd(11, "0"), breedCode2: "AB", birthEpoch: 1, callName: "Validation", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext, random01: rng(seed * 1_000_003 + index) });
    const analysis = result.geneticsAnalysis, count = analysis.observedOpportunityCount, value = mad(result.dog.traits); targets[analysis.opportunityTargetCount] += 1; observed[Math.min(3, count)] += 1; mads.push(value); if (count <= 2) byObserved[count]!.push(value);
    if (analysis.opportunityTargetCount === 1 && count >= 1) targetOneRealized += 1; if (analysis.opportunityTargetCount === 2 && count >= 1) targetTwoOne += 1; if (analysis.opportunityTargetCount === 2 && count >= 2) targetTwoTwo += 1; if (analysis.opportunityTargetCount === 0 && count >= 1) accidental += 1;
    for (const identity of analysis.observedOpportunityIdentities) { rawReasonCount += identity.reasons.length; if (identity.reasons.length > 1) multiReasonIdentityCount += 1; identity.reasons.forEach(reason => reasonCounts[reason] += 1); }
    const alleles = decodeGenotype(result.dog.genotype!).loci[0]!; positiveAtLocus0 += alleles.filter(value => value > 0).length; negativeAtLocus0 += alleles.filter(value => value < 0).length; commonAtLocus0 += alleles.filter(value => Math.round(value / .5) * .5 === -1).length; lowAtLocus0 += alleles.filter(value => Math.round(value / .5) * .5 === 1).length;
    genotypeNonPopulationBins += decodeGenotype(result.dog.genotype!).loci.flat().filter(value => !populationBins.has((Math.round(value / .5) * .5).toFixed(1))).length;
  }
  const total = SEEDS.length * PER_SEED, one = observed[1]!, two = observed[2]!, three = observed[3]!;
  return { name, mode: populationContext.mode, batchSize: total, seeds: SEEDS, targetCounts: targets, observedOpportunityCounts: observed, targetPercents: targets.map(value => percent(value, total)), observedPercents: observed.map(value => percent(value, total)), targetRealization: { target1Observed1Plus: percent(targetOneRealized, targets[1]!), target2Observed1Plus: percent(targetTwoOne, targets[2]!), target2Observed2Plus: percent(targetTwoTwo, targets[2]!), accidentalTarget0: percent(accidental, targets[0]!) }, reasonCounts, multiReasonIdentityCount, rawReasonCount, uniqueObservedOpportunityIdentityCount: one + two * 2 + three * 3, madDistribution: distribution(mads), madByObserved: byObserved.map(values => values.length ? distribution(values) : null), directionalMetrics: { positiveAlleleRateLocus0: percent(positiveAtLocus0, total * 2), negativeAlleleRateLocus0: percent(negativeAtLocus0, total * 2) }, componentMetrics: { locus0CommonNegativeRate: percent(commonAtLocus0, total * 2), locus0LowPositiveRate: percent(lowAtLocus0, total * 2), independentAlleleRate: percent(genotypeNonPopulationBins, total * TOTAL_LOCI * 2) }, gateResults: { observedOneBand: one / total >= .12 && one / total <= .18 ? "PASS" : "FAIL", observedTwoBand: two / total >= .01 && two / total <= .035 ? "PASS" : "FAIL", observedThreePlus: three / total <= .005 ? "PASS" : "FAIL", ordinaryMajority: observed[0]! / total > .5 ? "PASS" : "FAIL" } };
}

const contexts = [["RESET_FALLBACK", reset], ["HEALTHY_DIVERSITY", healthy], ["ONE_SIDED_BELOW", below], ["ONE_SIDED_ABOVE", above], ["LOW_FREQUENCY_COMPONENT", lowFrequency], ["NEAR_FIXED", nearFixed], ["EFFECTIVELY_FIXED", effectivelyFixed], ["BOTTLENECK", bottleneck], ["WORST_CASE_MULTI_SHORTAGE", worst], ["ROUGH", rough], ["REFINED", refined], ["RETAINED_BASELINE", retained]] as const;
const reports = contexts.map(([name, context]) => run(name, context));
const repeat = run("HEALTHY_DIVERSITY", healthy);
assert.deepEqual(reports[1], repeat, "same context and seeds must reproduce an identical aggregate report");
assert.ok(reports[0]!.targetCounts[1] === 0 && reports[0]!.targetCounts[2] === 0 && reports[0]!.observedOpportunityCounts.slice(1).every(value => value === 0), "reset fallback must have no population opportunity activity");
const report = { methodologyVersion: METHODOLOGY_VERSION, seeds: SEEDS, perSeedBatchSize: PER_SEED, sampleLimitation: "One 10,000-dog deterministic seed per context: 3x10,000 across all contexts exceeded the 30-second execution ceiling.", activeCalibration: "FOUNDATION_OPPORTUNITY_TARGETS (canonical generator export)", lowDataRouting: { "49 dogs/5 kennels": "RESET_FALLBACK or valid RETAINED_BASELINE only", "50 dogs/4 kennels": "RESET_FALLBACK or valid RETAINED_BASELINE only", "legacy/non-v2": "RESET_FALLBACK", "no snapshot": "RESET_FALLBACK" }, contexts: reports, comparison: { mirroredDirectionalAbsoluteDifference: Math.abs(reports[2]!.directionalMetrics.positiveAlleleRateLocus0 - reports[3]!.directionalMetrics.negativeAlleleRateLocus0), refinedMedianMinusRoughMedian: reports[10]!.madDistribution.median - reports[9]!.madDistribution.median, bottleneckObservedOnePlusMinusHealthy: (100 - reports[7]!.observedPercents[0]!) - (100 - reports[1]!.observedPercents[0]!) }, overallGate: reports.every(context => Object.values(context.gateResults).every(value => value === "PASS")) ? "PASS" : "FAIL" };
console.log(JSON.stringify(report));
