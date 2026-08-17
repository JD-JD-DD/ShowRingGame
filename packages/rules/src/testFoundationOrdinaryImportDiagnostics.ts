import assert from "node:assert/strict";

import {
  CURRENT_GENETICS_VERSION,
  TOTAL_LOCI,
  TRAIT_KEYS,
  calculatePhenotypeFromGenotype,
  createFoundationDogProfile,
  createResetFoundationPopulationContext,
  decodeGenotype,
  deriveVisibleCategoriesFromTraits,
  type CanonicalGenotype,
  type DogTraits,
  type FoundationPopulationContextInput,
} from "./index";

const SAMPLE_SIZE = 10_000;
const traits: DogTraits = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const summary = (values: number[]) => { const mean = values.reduce((sum, value) => sum + value, 0) / values.length; return { mean, standardDeviation: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length), min: Math.min(...values), median: median(values), max: Math.max(...values) }; };
const source = (mode: "LIVE" | "RETAINED_BASELINE") => ({ mode, snapshotId: "diagnostic", gameYear: 16, snapshotEpoch: 6000, rulesVersion: "breed-background-v1", sourceFingerprint: "diagnostic", eligibleDogCount: 50, kennelCount: 5 });

function context(args: { center: number; variance: number; belowShare: number; aboveShare: number; mode?: "LIVE" | "RETAINED_BASELINE" }): FoundationPopulationContextInput {
  const provenance = source(args.mode ?? "LIVE");
  const components = [{ component: "-1.0", share: .5 }, { component: "1.0", share: .5 }];
  return {
    phenotypeContext: { source: provenance, traits: Object.fromEntries(TRAIT_KEYS.map(trait => [trait, { center: args.center, variance: args.variance, meanAbsoluteDeviation: Math.sqrt(args.variance), min: args.center - 4, max: args.center + 4, belowCount: 25, exactCount: 0, aboveCount: 25, belowCenter: args.center - 1, aboveCenter: args.center + 1, belowShare: args.belowShare, aboveShare: args.aboveShare, nearIdealShare: .1 }])) },
    geneticDiversityContext: { source: provenance, payloadVersion: "breed-background-payload-v2", componentBinWidth: .5, overallMeanHomozygosity: .25, fixedLocusCount: 0, nearFixedLocusCount: 0, loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => ({ locus, components, dominantShare: .5, effectiveComponentCount: 2, homozygosity: .25, classification: "DIVERSE" })) },
  };
}

function report(name: string, populationContext: FoundationPopulationContextInput) {
  const dogs = Array.from({ length: SAMPLE_SIZE }, (_, index) => createFoundationDogProfile({ dogId: `${name}-${index}`, regNumber: `OI${index}`.padEnd(11, "0"), breedCode2: "OI", birthEpoch: 1, callName: "Ordinary", breedBaseline: { breedCode2: "OI", traitMeans: traits }, populationContext, random01: rng(index + 101) }));
  const traitValues = Object.fromEntries(TRAIT_KEYS.map(trait => [trait, dogs.map(dog => dog.dog.traits[trait])])) as Record<keyof DogTraits, number[]>;
  const allTraits = dogs.flatMap(dog => TRAIT_KEYS.map(trait => dog.dog.traits[trait]));
  const categories = dogs.map(dog => Object.values(deriveVisibleCategoriesFromTraits(dog.dog.traits)).slice(0, 5));
  const center = populationContext.phenotypeContext.traits?.head?.center ?? 10;
  const binsByLocus = Array.from({ length: TOTAL_LOCI }, () => new Set<string>());
  dogs.forEach(dog => decodeGenotype(dog.dog.genotype!).loci.forEach((alleles, locus) => alleles.forEach(allele => binsByLocus[locus]!.add((Math.round(allele / .5) * .5).toFixed(1)))));
  return {
    name,
    phenotype: Object.fromEntries(TRAIT_KEYS.map(trait => [trait, summary(traitValues[trait])])),
    meanAbsoluteDistanceFromContextCenter: allTraits.reduce((sum, value) => sum + Math.abs(value - center), 0) / allTraits.length,
    meanAbsoluteDistanceFromIdeal: allTraits.reduce((sum, value) => sum + Math.abs(value - 10), 0) / allTraits.length,
    belowIdealShare: allTraits.filter(value => value < 10).length / allTraits.length,
    aboveIdealShare: allTraits.filter(value => value > 10).length / allTraits.length,
    phenotypeClampRate: allTraits.filter(value => value <= 0 || value >= 20).length / allTraits.length,
    anyBelow3: dogs.filter(dog => TRAIT_KEYS.some(trait => dog.dog.traits[trait] < 3)).length / dogs.length,
    anyAbove17: dogs.filter(dog => TRAIT_KEYS.some(trait => dog.dog.traits[trait] > 17)).length / dogs.length,
    twoOrMoreOutside5To15: dogs.filter(dog => TRAIT_KEYS.filter(trait => dog.dog.traits[trait] < 5 || dog.dog.traits[trait] > 15).length >= 2).length / dogs.length,
    visibleCategories: Object.fromEntries(["typeExpression", "structureBalance", "movement", "coatPresentation", "temperamentRingBehavior"].map((category, index) => [category, summary(categories.map(values => values[index]!))])),
    multipleExtremeVisibleCategories: categories.filter(values => values.filter(value => value < 5 || value > 15).length >= 2).length / dogs.length,
    meanAlleleBinsPerLocus: binsByLocus.reduce((sum, bins) => sum + bins.size, 0) / TOTAL_LOCI,
    genotypeAmbiguity: new Set(dogs.map(dog => dog.dog.genotype)).size > SAMPLE_SIZE * .99,
  };
}

function resetReference() {
  const values = Array.from({ length: SAMPLE_SIZE }, (_, dog) => {
    const random01 = rng(dog + 101);
    const genotype: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci: Array.from({ length: TOTAL_LOCI }, () => [0, 0].map(() => Math.round(Array.from({ length: 6 }, () => random01() * 2 - 1).reduce((sum, value) => sum + value, 0) / 6 * 14 * 1_000_000) / 1_000_000) as [number, number]) };
    return calculatePhenotypeFromGenotype(genotype);
  });
  return { twoOrMoreOutside5To15: values.filter(dog => TRAIT_KEYS.filter(trait => dog[trait] < 5 || dog[trait] > 15).length >= 2).length / SAMPLE_SIZE, clampRate: values.flatMap(dog => TRAIT_KEYS.map(trait => dog[trait])).filter(value => value <= 0 || value >= 20).length / (SAMPLE_SIZE * TRAIT_KEYS.length) };
}

const live = report("LIVE", context({ center: 10, variance: 4, belowShare: .5, aboveShare: .5 }));
const skewed = report("SKEWED", context({ center: 8.5, variance: 4, belowShare: .8, aboveShare: .2 },));
const fallback = report("FALLBACK", createResetFoundationPopulationContext());
const priorReset = resetReference();
assert.ok(live.twoOrMoreOutside5To15 < priorReset.twoOrMoreOutside5To15, "ordinary imports sharply reduce multi-trait extremes from reset founders");
assert.ok(fallback.phenotypeClampRate < priorReset.clampRate, "no-context ordinary imports are safer than reset founders");
assert.ok(live.belowIdealShare > .05 && live.aboveIdealShare > .05 && skewed.aboveIdealShare > .01, "ordinary imports retain both directional sides");
assert.equal(live.genotypeAmbiguity, true, "accepted ordinary imports retain distinct hidden genotypes");
console.log(JSON.stringify({ methodologyVersion: "gen-09c-ordinary-import-diagnostics-v1", sampleSize: SAMPLE_SIZE, calibration: { alleleSpread: 3.5, maxCandidateAttempts: 12, emergencyAlleleBound: .5 }, priorReset, live, skewed, fallback }));
