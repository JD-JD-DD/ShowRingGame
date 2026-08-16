import assert from "node:assert/strict";

import {
  CURRENT_GENETICS_VERSION,
  TOTAL_LOCI,
  classifyFoundationOpportunities,
  createFoundationDogProfile,
  decodeGenotype,
  type CanonicalGenotype,
  type DogTraits,
  type FoundationPopulationContextInput,
} from "./index";

const traits: DogTraits = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const random = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
const genotype = (first: readonly [number, number]): CanonicalGenotype => ({ geneticsVersion: CURRENT_GENETICS_VERSION, loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => locus === 0 ? first : [0, 0] as const) });

function context(args: { below?: number; above?: number; components?: Array<{ component: string; share: number }>; classification?: "DIVERSE" | "NEAR_FIXED" | "EFFECTIVELY_FIXED"; mode?: "LIVE" | "RETAINED_BASELINE"; singleLocus?: boolean } = {}): FoundationPopulationContextInput {
  const components = args.components ?? [{ component: "-1.0", share: 0.95 }, { component: "1.0", share: 0.05 }];
  return {
    mode: args.mode ?? "LIVE",
    phenotype: Object.fromEntries(Object.keys(traits).map(trait => [trait, { belowShare: args.below ?? 0.9, aboveShare: args.above ?? 0.05, nearIdealShare: 0.05 }])),
    genotype: { loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => ({ locus, classification: args.singleLocus && locus !== 0 ? "DIVERSE" : args.classification ?? "DIVERSE", components: args.singleLocus && locus !== 0 ? [{ component: "0.0", share: 1 }] : components })) },
  };
}

const multiReason = context({ classification: "NEAR_FIXED" });
const observed = classifyFoundationOpportunities({ populationContext: multiReason, genotype: genotype([1, 1]) });
assert.equal(observed.length, 1, "one locus with several scarcity reasons must remain one observed identity");
assert.deepEqual(observed[0]!.reasons, ["LOW_FREQUENCY_COMPONENT", "NEAR_FIXED_LOCUS_DIVERSITY", "OPPOSITE_DIRECTION_SCARCITY"], "the one identity retains every applicable reason");

const mirroredPositive = classifyFoundationOpportunities({ populationContext: context({ below: 0.9, above: 0.05 }), genotype: genotype([1, 1]) });
const mirroredNegative = classifyFoundationOpportunities({ populationContext: context({ below: 0.05, above: 0.9, components: [{ component: "-1.0", share: 0.05 }, { component: "1.0", share: 0.95 }] }), genotype: genotype([-1, -1]) });
assert.equal(mirroredPositive[0]!.reasons.includes("OPPOSITE_DIRECTION_SCARCITY"), true, "below-heavy evidence makes positive components eligible");
assert.equal(mirroredNegative[0]!.reasons.includes("OPPOSITE_DIRECTION_SCARCITY"), true, "mirrored above-heavy evidence makes negative components eligible");

const targetTwo = createFoundationDogProfile({ dogId: "two", regNumber: "AB000000201", breedCode2: "AB", birthEpoch: 1, callName: "Two", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext: context({ classification: "EFFECTIVELY_FIXED" }), random01: () => 0 });
assert.equal(targetTwo.geneticsAnalysis.opportunityTargetCount, 2, "the 2% target draw remains observable internally");
assert.equal(new Set(targetTwo.geneticsAnalysis.targetedOpportunityIdentities.map(identity => identity.locus)).size, 2, "target two must select distinct locus identities");
assert.ok(targetTwo.geneticsAnalysis.observedOpportunityCount <= TOTAL_LOCI, "observed opportunity count is bounded by de-duplicated loci");

const fixed = context({ classification: "EFFECTIVELY_FIXED", singleLocus: true });
const generated = Array.from({ length: 128 }, (_, index) => createFoundationDogProfile({ dogId: `fixed-${index}`, regNumber: `AB00000${300 + index}`, breedCode2: "AB", birthEpoch: 1, callName: "Fixed", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext: fixed, random01: random(index + 1) })).filter(result => result.geneticsAnalysis.targetedOpportunityIdentities.some(identity => identity.locus === 0));
assert.ok(generated.some(result => result.geneticsAnalysis.observedOpportunityCount > 0), "weak fixed-locus targeting can realize alternative material");
assert.ok(generated.some(result => result.geneticsAnalysis.observedOpportunityCount === 0), "weak fixed-locus targeting does not guarantee alternative material");

const targetedTrials = (populationContext: FoundationPopulationContextInput, seedOffset: number) => Array.from({ length: 128 }, (_, index) => createFoundationDogProfile({ dogId: `trial-${seedOffset}-${index}`, regNumber: `AB${seedOffset}${index}`.padEnd(11, "0"), breedCode2: "AB", birthEpoch: 1, callName: "Trial", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext, random01: random(seedOffset + index) })).filter(result => result.geneticsAnalysis.targetedOpportunityIdentities.some(identity => identity.locus === 0));
const lowFrequencyTrials = targetedTrials(context({ singleLocus: true, below: 0.5, above: 0.5, components: [{ component: "-1.0", share: 0.8 }, { component: "0.0", share: 0.15 }, { component: "1.0", share: 0.05 }] }), 1000);
assert.ok(lowFrequencyTrials.every(result => result.geneticsAnalysis.targetedOpportunityIdentities[0]!.reasons.includes("LOW_FREQUENCY_COMPONENT")), "represented low-frequency components are independently eligible");
assert.ok(lowFrequencyTrials.some(result => result.geneticsAnalysis.observedOpportunityCount === 0), "low-frequency targeting does not guarantee a conspicuous diploid result");
const directionalTrials = targetedTrials(context({ singleLocus: true, below: 0.9, above: 0.05, components: [{ component: "-1.0", share: 0.75 }, { component: "1.0", share: 0.25 }] }), 2000);
assert.ok(directionalTrials.every(result => result.geneticsAnalysis.targetedOpportunityIdentities[0]!.reasons.includes("OPPOSITE_DIRECTION_SCARCITY")), "directional scarcity is eligible from below/above evidence");
assert.ok(directionalTrials.some(result => result.geneticsAnalysis.observedOpportunityCount === 0), "directional targeting does not guarantee a conspicuous diploid result");

const resetA = createFoundationDogProfile({ dogId: "reset", regNumber: "AB000000401", breedCode2: "AB", birthEpoch: 1, callName: "Reset", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext: { mode: "RESET_FALLBACK", genotype: null }, random01: random(77) });
const resetB = createFoundationDogProfile({ dogId: "reset", regNumber: "AB000000401", breedCode2: "AB", birthEpoch: 1, callName: "Reset", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext: { mode: "RESET_FALLBACK", genotype: null }, random01: random(77) });
assert.equal(resetA.dog.genotype, resetB.dog.genotype, "reset fallback remains deterministic");
assert.deepEqual(resetA.geneticsAnalysis, { eligibleScarcityIdentities: [], opportunityTargetCount: 0, targetedOpportunityIdentities: [], observedOpportunityIdentities: [], observedOpportunityCount: 0 }, "reset fallback has no population-derived opportunity work");

const componentContext = (component: string) => context({ below: 0.5, above: 0.5, components: [{ component, share: 0.8 }, { component: component === "-2.0" ? "-1.5" : "1.5", share: 0.2 }] });
const meanHead = (populationContext: FoundationPopulationContextInput) => Array.from({ length: 80 }, (_, index) => createFoundationDogProfile({ dogId: `quality-${index}`, regNumber: `AB00000${500 + index}`, breedCode2: "AB", birthEpoch: 1, callName: "Quality", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext, random01: random(index + 900) }).dog.traits.head).reduce((sum, value) => sum + value, 0) / 80;
const roughMean = meanHead(componentContext("-2.0"));
const refinedMean = meanHead(componentContext("2.0"));
assert.ok(refinedMean > roughMean, "contemporary component evidence changes foundation phenotype through genotype sampling");
const distinct = Array.from({ length: 16 }, (_, index) => createFoundationDogProfile({ dogId: `distinct-${index}`, regNumber: `AB0000007${index}`, breedCode2: "AB", birthEpoch: 1, callName: "Distinct", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext: componentContext("2.0"), random01: random(700 + index) }));
assert.ok(distinct.some(result => decodeGenotype(result.dog.genotype!).loci.flat().some(allele => !["1.5", "2.0"].includes((Math.round(allele / 0.5) * 0.5).toFixed(1)))), "foundation sampling retains broad independent variation rather than copying population components");

const allLoci = (allele: number): CanonicalGenotype => ({ geneticsVersion: CURRENT_GENETICS_VERSION, loci: Array.from({ length: TOTAL_LOCI }, () => [allele, allele] as const) });
const ordinaryOneSided = context({ below: .9, above: .05, components: [{ component: "-1.0", share: .75 }, { component: "1.0", share: .25 }] });
const ordinaryOneSidedDog = classifyFoundationOpportunities({ populationContext: ordinaryOneSided, genotype: allLoci(1) });
assert.equal(ordinaryOneSidedDog.length, 0, "ordinary opposite-side components remain scarcity-eligible without becoming conspicuous opportunities");
const conspicuousDirectional = classifyFoundationOpportunities({ populationContext: context({ below: .9, above: .05, components: [{ component: "-1.0", share: .95 }, { component: "1.0", share: .05 }] }), genotype: genotype([1, 1]) });
assert.equal(conspicuousDirectional[0]!.reasons.includes("OPPOSITE_DIRECTION_SCARCITY"), true, "a rare diploid opposite-side component is conspicuous");
const ordinaryFixed = classifyFoundationOpportunities({ populationContext: context({ classification: "EFFECTIVELY_FIXED", components: [{ component: "-1.0", share: .99 }, { component: "1.0", share: .01 }] }), genotype: genotype([-1, -1]) });
assert.equal(ordinaryFixed.length, 0, "the dominant fixed component is not diversity restoration");
const bottleneckContext = context({ classification: "EFFECTIVELY_FIXED", components: [{ component: "-1.0", share: .99 }, { component: "1.0", share: .01 }] });
assert.equal(classifyFoundationOpportunities({ populationContext: bottleneckContext, genotype: allLoci(-1) }).length, 0, "an ordinary common-component bottleneck dog is not automatically a 3+ opportunity dog");
const bottleneckGenerated = createFoundationDogProfile({ dogId: "bottleneck", regNumber: "AB000000801", breedCode2: "AB", birthEpoch: 1, callName: "Bottleneck", breedBaseline: { breedCode2: "AB", traitMeans: traits }, populationContext: bottleneckContext, random01: random(801) });
assert.equal(bottleneckGenerated.geneticsAnalysis.eligibleScarcityIdentities.length, TOTAL_LOCI, "many bottleneck loci remain scarcity-eligible for targeting analysis");
const exceptionalThree: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => locus < 3 ? [1, 1] as const : [-1, -1] as const) };
assert.equal(classifyFoundationOpportunities({ populationContext: context({ classification: "NEAR_FIXED", components: [{ component: "-1.0", share: .95 }, { component: "1.0", share: .05 }] }), genotype: exceptionalThree }).length, 3, "genuine three-identity outcomes remain visible and are not capped");

console.log("GEN-09C opportunity analysis tests passed");
