import assert from "node:assert/strict";

import {
  TOTAL_LOCI,
  TRAIT_KEYS,
  createFoundationDogProfile,
  decodeGenotype,
  isOrdinaryFoundationPhenotypePlausible,
  type DogTraits,
  type FoundationPopulationContextInput,
} from "./index";

const SEEDS = [101, 202, 303] as const;
const PER_SEED = 3_000;
const traits: DogTraits = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
type Shape = { components: Array<{ component: string; share: number }>; classification?: "DIVERSE" | "NEAR_FIXED" | "EFFECTIVELY_FIXED"; below?: number; above?: number };
const source = { mode: "LIVE" as const, snapshotId: "diagnostic", gameYear: 16, snapshotEpoch: 6000, rulesVersion: "breed-background-v1", sourceFingerprint: "diagnostic", eligibleDogCount: 50, kennelCount: 5 };

function context(shape: Shape, overrides: Partial<Record<number, Shape>> = {}): FoundationPopulationContextInput {
  const at = (locus: number) => overrides[locus] ?? shape;
  return {
    phenotypeContext: { source, traits: Object.fromEntries(TRAIT_KEYS.map((trait, index) => { const current = at(index * 4); return [trait, { center: 10, variance: 4, meanAbsoluteDeviation: 2, min: 5, max: 15, belowCount: 25, exactCount: 0, aboveCount: 25, belowCenter: 8, aboveCenter: 12, belowShare: current.below ?? .5, aboveShare: current.above ?? .5, nearIdealShare: .1 }]; })) },
    geneticDiversityContext: { source, payloadVersion: "breed-background-payload-v2", componentBinWidth: .5, overallMeanHomozygosity: .25, fixedLocusCount: 0, nearFixedLocusCount: 0, loci: Array.from({ length: TOTAL_LOCI }, (_, locus) => { const current = at(locus), dominantShare = Math.max(...current.components.map(component => component.share)); return { locus, components: current.components, dominantShare, effectiveComponentCount: 1 / current.components.reduce((sum, component) => sum + component.share * component.share, 0), homozygosity: .25, classification: current.classification ?? "DIVERSE" }; }) },
  };
}

function run(name: string, populationContext: FoundationPopulationContextInput) {
  const targets = [0, 0, 0], realized = [0, 0, 0, 0], realizedByTarget = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
  let targetedDogs = 0, targetedRealized = 0, plausible = 0, ordinaryOpportunityDogs = 0, conspicuousOpportunityDogs = 0, clampTraits = 0, traitTotal = 0;
  const alternativeBinCopies: number[] = [], alternativeCopiesByTarget = [0, 0, 0];
  const firstAttemptByTarget = [0, 0, 0], attemptsByTarget = [0, 0, 0], retryCapByTarget = [0, 0, 0], emergencyByTarget = [0, 0, 0];
  for (const seed of SEEDS) for (let index = 0; index < PER_SEED; index += 1) {
    const result = createFoundationDogProfile({ dogId: `${name}-${seed}-${index}`, regNumber: `OD${seed}${index}`.padEnd(11, "0"), breedCode2: "OD", birthEpoch: 1, callName: "Diagnostic", breedBaseline: { breedCode2: "OD", traitMeans: traits }, populationContext, random01: rng(seed * 1_000_003 + index) });
    const target = result.geneticsAnalysis.opportunityTargetCount, observed = Math.min(3, result.geneticsAnalysis.observedOpportunityCount);
    targets[target] += 1; realized[observed] += 1; realizedByTarget[target]![observed] += 1;
    attemptsByTarget[target] += result.plausibilityDiagnostics.candidateAttempts;
    if (result.plausibilityDiagnostics.candidateAttempts === 1) firstAttemptByTarget[target] += 1;
    if (result.plausibilityDiagnostics.candidateAttempts === 12) retryCapByTarget[target] += 1;
    if (result.plausibilityDiagnostics.usedEmergencyFallback) emergencyByTarget[target] += 1;
    if (target > 0) { targetedDogs += 1; if (result.geneticsAnalysis.targetedOpportunityIdentities.some(targeted => result.geneticsAnalysis.observedOpportunityIdentities.some(observation => observation.locus === targeted.locus))) targetedRealized += 1; }
    if (isOrdinaryFoundationPhenotypePlausible({ traits: result.dog.traits, populationContext })) plausible += 1;
    const outside = TRAIT_KEYS.filter(trait => result.dog.traits[trait] < 5 || result.dog.traits[trait] > 15).length;
    if (observed > 0 && outside < 2) ordinaryOpportunityDogs += 1;
    if (observed > 0 && (result.dog.traits.head < 5 || result.dog.traits.head > 15)) conspicuousOpportunityDogs += 1;
    const decoded = decodeGenotype(result.dog.genotype!), alternativeCopies = decoded.loci[0]!.filter(value => Math.round(value / .5) * .5 === 1).length; alternativeBinCopies.push(alternativeCopies); alternativeCopiesByTarget[target] += alternativeCopies;
    TRAIT_KEYS.forEach(trait => { traitTotal += 1; if (result.dog.traits[trait] <= 0 || result.dog.traits[trait] >= 20) clampTraits += 1; });
  }
  const total = SEEDS.length * PER_SEED;
  return { name, seeds: SEEDS, perSeed: PER_SEED, selection: targets.map(value => value / total), realized: realized.map(value => value / total), realizedBySelection: realizedByTarget.map(values => values.map(value => value / total)), targetedRealization: targetedDogs === 0 ? 0 : targetedRealized / targetedDogs, zeroIncidental: realizedByTarget[0]!.slice(1).reduce((sum, value) => sum + value, 0) / Math.max(1, targets[0]), zeroThreePlus: realizedByTarget[0]![3] / Math.max(1, targets[0]), opportunityPhenotypicallyOrdinary: ordinaryOpportunityDogs / Math.max(1, realized.slice(1).reduce((sum, value) => sum + value, 0)), opportunityHeadConspicuous: conspicuousOpportunityDogs / Math.max(1, realized.slice(1).reduce((sum, value) => sum + value, 0)), plausibilityPass: plausible / total, clampRate: clampTraits / traitTotal, plausibilityBySelection: targets.map((count, target) => ({ firstAttemptAcceptance: firstAttemptByTarget[target]! / Math.max(1, count), meanCandidateAttempts: attemptsByTarget[target]! / Math.max(1, count), retryCapHitRate: retryCapByTarget[target]! / Math.max(1, count), emergencyFallbackRate: emergencyByTarget[target]! / Math.max(1, count) })), locus0AlternativeCopiesPerDog: alternativeBinCopies.reduce((sum, value) => sum + value, 0) / total, locus0AlternativeCopiesBySelection: alternativeCopiesByTarget.map((value, target) => value / Math.max(1, targets[target]!)) };
}

const healthy: Shape = { components: [{ component: "-1.0", share: .25 }, { component: "-.5", share: .25 }, { component: ".5", share: .25 }, { component: "1.0", share: .25 }] };
const nearFixed: Shape = { classification: "NEAR_FIXED", components: [{ component: "-1.0", share: .92 }, { component: "1.0", share: .08 }], below: .8, above: .15 };
const effectivelyFixed: Shape = { classification: "EFFECTIVELY_FIXED", components: [{ component: "-1.0", share: .99 }, { component: "1.0", share: .01 }], below: .8, above: .15 };
const reports = [
  run("HEALTHY", context(healthy)),
  run("ONE_NEAR_FIXED", context(healthy, { 0: nearFixed })),
  run("SEVERAL_NEAR_FIXED", context(healthy, { 0: nearFixed, 1: nearFixed, 2: nearFixed, 3: nearFixed })),
  run("ONE_EFFECTIVELY_FIXED", context(healthy, { 0: effectivelyFixed })),
  run("MULTIPLE_SCARCITY", context(nearFixed)),
  run("DIRECTIONALLY_SKEWED", context(healthy, { 0: { ...healthy, below: .85, above: .1 } })),
];
assert.ok(reports.every(report => report.plausibilityPass === 1 && report.clampRate < .001), "all opportunity candidates retain GEN-09C phenotype plausibility with near-zero clamps");
assert.ok(reports.slice(1).every(report => report.selection[0]! >= .80 && report.selection[0]! <= .86 && report.selection[1]! >= .12 && report.selection[1]! <= .18 && report.selection[2]! >= .01 && report.selection[2]! <= .03), "eligible contexts retain the locked selection budget");
assert.equal(reports[0]!.realized.slice(1).reduce((sum, value) => sum + value, 0), 0, "healthy context has no scarcity realization");
assert.ok(reports[1]!.targetedRealization > reports[1]!.zeroIncidental * 2 && reports[3]!.targetedRealization > reports[3]!.zeroIncidental * 2, "selected single-locus scarcity bias materially exceeds incidental realization without becoming deterministic");
assert.ok(reports[1]!.locus0AlternativeCopiesBySelection[1]! > reports[1]!.locus0AlternativeCopiesBySelection[0]!, "selected opportunities increase alternative-component supply without guaranteeing it");
assert.ok(reports[4]!.realized[3]! <= .025 && reports[4]!.zeroThreePlus <= .015, "multiple-scarcity repair outcomes remain rare, including zero-opportunity dogs");
console.log(JSON.stringify({ methodologyVersion: "gen-09d-opportunity-calibration-v1", reports }));
