import assert from "node:assert/strict";

import {
  CURRENT_GENETICS_VERSION,
  TRAIT_KEYS,
  TOTAL_LOCI,
  calculatePhenotypeFromGenotype,
  createFoundationDogProfile,
  decodeGenotype,
  deriveVisibleCategoriesFromTraits,
  encodeGenotype,
  inheritModelDGenotype,
  type CanonicalGenotype,
  type DogTraits,
} from "@showring/rules";
import { FINAL_GENETICS_CALIBRATION } from "../../../packages/rules/calibration/geneticsCalibration.constants";
import {
  BREED_BACKGROUND_RULES_VERSION,
  buildBreedGeneticBackgroundSnapshot,
  type BreedGeneticBackgroundCandidate,
} from "../server/services/breedGeneticBackground.service";
import { resolveFoundationPopulationContextFromSnapshot } from "../server/services/foundationPopulationContext.service";

const BREED = "GL";
const POPULATION_SIZE = 120;
const KENNELS = 10;
const LITTER_SIZE = 6;
const MATINGS = POPULATION_SIZE / LITTER_SIZE;
// One analytical generation spans the two game years needed for a new cohort
// to satisfy the production breeding-age gate at its next annual snapshot.
const GENERATION_HOURS = 730;
const CHECKPOINTS = new Set([0, 3, 5, 10, 20, 50]);
const TRAITS: DogTraits = Object.fromEntries(TRAIT_KEYS.map((trait) => [trait, 10])) as DogTraits;
const FOUNDATION_RATES = { none: 0, low: 0.04, moderate: 0.1 } as const;
type Intake = keyof typeof FOUNDATION_RATES;
type Policy = "NEUTRAL" | "MODERATE" | "STRONG" | "COMPLEMENTARY" | "POPULAR_SIRE" | "DIVERSITY";

type SimDog = {
  id: string; sex: "M" | "F"; family: string; ownerKennelId: string; litterId: string;
  birthEpoch: number; genotype: CanonicalGenotype; traits: DogTraits;
};

function rng(seed: string) {
  let value = 2166136261;
  for (const character of seed) { value ^= character.charCodeAt(0); value = Math.imul(value, 16777619); }
  return () => { value += 0x6D2B79F5; let next = value; next = Math.imul(next ^ (next >>> 15), next | 1); next ^= next + Math.imul(next ^ (next >>> 7), next | 61); return ((next ^ (next >>> 14)) >>> 0) / 4294967296; };
}
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const sd = (values: number[]) => { const center = mean(values); return Math.sqrt(mean(values.map((value) => (value - center) ** 2))); };
const percentile = (values: number[], q: number) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) * q)]!; };
const component = (value: number) => (Math.round(value / .5) * .5).toFixed(1);

function toCandidate(dog: SimDog): BreedGeneticBackgroundCandidate {
  return {
    id: dog.id, ownerKennelId: dog.ownerKennelId, litterId: dog.litterId, sex: dog.sex,
    birthEpoch: dog.birthEpoch, genotype: encodeGenotype(dog.genotype), geneticsVersion: CURRENT_GENETICS_VERSION,
    traitHead: dog.traits.head, traitForequarters: dog.traits.forequarters, traitHindquarters: dog.traits.hindquarters,
    traitGait: dog.traits.gait, traitCoat: dog.traits.coat, traitSize: dog.traits.size,
    traitTemperament: dog.traits.temperament, traitShowShine: dog.traits.show_shine,
    traitFeet: dog.traits.feet, traitTopline: dog.traits.topline,
  };
}

function initialPopulation() {
  return Array.from({ length: POPULATION_SIZE }, (_, index) => {
    const result = createFoundationDogProfile({ dogId: `g0-${index}`, regNumber: `${BREED}${String(index).padStart(9, "0")}`, breedCode2: BREED, birthEpoch: -GENERATION_HOURS, sex: index % 2 === 0 ? "M" : "F", callName: "Base", breedBaseline: { breedCode2: BREED, traitMeans: TRAITS }, random01: rng(`base-${index}`) });
    return { id: result.dog.dogId, sex: result.dog.sex, family: `base-${index}`, ownerKennelId: `kennel-${index % KENNELS}`, litterId: `base-litter-${Math.floor(index / 6)}`, birthEpoch: -GENERATION_HOURS, genotype: decodeGenotype(result.dog.genotype!), traits: result.dog.traits };
  });
}

function pick(pool: SimDog[], random01: () => number) { return pool[Math.floor(random01() * pool.length)]!; }
function select(pool: SimDog[], policy: Policy, sex: "M" | "F", index: number, random01: () => number) {
  const candidates = pool.filter((dog) => dog.sex === sex);
  const ranked = [...candidates].sort((left, right) => right.traits.head - left.traits.head || left.id.localeCompare(right.id));
  if (policy === "NEUTRAL") return pick(candidates, random01);
  if (policy === "MODERATE") return pick(ranked.slice(0, Math.min(24, ranked.length)), random01);
  if (policy === "STRONG") return ranked[index % Math.min(6, ranked.length)]!;
  if (policy === "POPULAR_SIRE" && sex === "M") return ranked[0]!;
  if (policy === "POPULAR_SIRE") return pick(ranked.slice(0, Math.min(24, ranked.length)), random01);
  if (policy === "COMPLEMENTARY") return sex === "M" ? ranked[index % Math.min(18, ranked.length)]! : [...ranked].reverse()[index % Math.min(18, ranked.length)]!;
  const unique = new Map<string, SimDog>(); for (const dog of ranked) if (!unique.has(dog.family)) unique.set(dog.family, dog);
  return [...unique.values()][index % unique.size]!;
}

function metrics(population: SimDog[]) {
  const loci = Array.from({ length: TOTAL_LOCI }, (_, locus) => {
    const alleles = population.flatMap((dog) => dog.genotype.loci[locus]); const bins = new Map<string, number>();
    alleles.forEach((allele) => bins.set(component(allele), (bins.get(component(allele)) ?? 0) + 1));
    const shares = [...bins.values()].map((count) => count / alleles.length); const dominant = Math.max(...shares);
    return { dominant, effective: 1 / shares.reduce((sum, share) => sum + share * share, 0), count: bins.size, fixed: dominant >= .98, near: dominant >= .9 && dominant < .98 };
  });
  const head = population.map((dog) => dog.traits.head); const visible = population.map((dog) => deriveVisibleCategoriesFromTraits(dog.traits).typeExpression);
  const allTraits = population.flatMap((dog) => TRAIT_KEYS.map((trait) => dog.traits[trait]));
  return { homozygosity: mean(population.flatMap((dog) => dog.genotype.loci.map(([a, b]) => a === b ? 1 : 0))), heterozygosity: 1 - mean(population.flatMap((dog) => dog.genotype.loci.map(([a, b]) => a === b ? 1 : 0))), fixed: loci.filter((locus) => locus.fixed).length, near: loci.filter((locus) => locus.near).length, effective: mean(loci.map((locus) => locus.effective)), components: mean(loci.map((locus) => locus.count)), dominant: mean(loci.map((locus) => locus.dominant)), head: { mean: mean(head), sd: sd(head), p5: percentile(head, .05), p95: percentile(head, .95) }, visible: { mean: mean(visible), sd: sd(visible), p5: percentile(visible, .05), p95: percentile(visible, .95) }, extremes: allTraits.filter((value) => value <= 5 || value >= 15).length / allTraits.length, nearIdealDogs: population.filter((dog) => TRAIT_KEYS.every((trait) => Math.abs(dog.traits[trait] - 10) <= .5)).length / population.length };
}

function run(policy: Policy, intake: Intake, generations: number) {
  let population = initialPopulation(); let prior: ReturnType<typeof buildBreedGeneticBackgroundSnapshot> | null = null; let mutationCount = 0;
  const checkpoints: Record<number, ReturnType<typeof metrics> & { snapshot: ReturnType<typeof buildBreedGeneticBackgroundSnapshot>; foundationHead: number; eliteHead: number; opportunityTargets: number }> = {};
  for (let generation = 0; generation <= generations; generation += 1) {
    const snapshotEpoch = generation * GENERATION_HOURS;
    const snapshot = buildBreedGeneticBackgroundSnapshot({ candidates: population.map(toCandidate), snapshotEpoch, priorSnapshot: prior });
    const context = resolveFoundationPopulationContextFromSnapshot({ breedCode2: BREED, snapshot: { id: `snapshot-${policy}-${intake}-${generation}`, gameYear: generation * 2 + 1, snapshotEpoch, backgroundRulesVersion: BREED_BACKGROUND_RULES_VERSION, ...snapshot } });
    const foundations = Array.from({ length: Math.round(POPULATION_SIZE * FOUNDATION_RATES[intake]) }, (_, index) => {
      const result = createFoundationDogProfile({ dogId: `f-${policy}-${intake}-${generation}-${index}`, regNumber: `${BREED}F${String(generation * 100 + index).padStart(8, "0")}`, breedCode2: BREED, birthEpoch: snapshotEpoch, callName: "Foundation", breedBaseline: { breedCode2: BREED, traitMeans: TRAITS }, populationContext: context, random01: rng(`foundation-${policy}-${intake}-${generation}-${index}`) });
      return { id: result.dog.dogId, sex: result.dog.sex, family: result.dog.dogId, ownerKennelId: `foundation-${index}`, litterId: result.dog.dogId, birthEpoch: snapshotEpoch, genotype: decodeGenotype(result.dog.genotype!), traits: result.dog.traits, targets: result.geneticsAnalysis.opportunityTargetCount };
    });
    if (CHECKPOINTS.has(generation)) {
      const sortedHead = [...population].sort((left, right) => right.traits.head - left.traits.head);
      checkpoints[generation] = { ...metrics(population), snapshot, foundationHead: foundations.length ? mean(foundations.map((dog) => dog.traits.head)) : Number.NaN, eliteHead: mean(sortedHead.slice(0, 12).map((dog) => dog.traits.head)), opportunityTargets: foundations.reduce((sum, dog) => sum + dog.targets, 0) };
    }
    if (generation === generations) break;
    const pool = [...population, ...foundations]; const random01 = rng(`breed-${policy}-${intake}-${generation}`); const next: SimDog[] = [];
    for (let mating = 0; mating < MATINGS; mating += 1) {
      const sire = select(pool, policy, "M", mating, random01); const dam = select(pool, policy, "F", mating, random01);
      for (let puppy = 0; puppy < LITTER_SIZE; puppy += 1) {
        const inherited = inheritModelDGenotype({ sireGenotype: sire.genotype, damGenotype: dam.genotype, random01, mutation: FINAL_GENETICS_CALIBRATION.mutation, breedBackground: { version: "breed-background-v1", coefficient: FINAL_GENETICS_CALIBRATION.breedBackgroundCoefficient, sourceStatus: "BASELINE" } });
        mutationCount += inherited.mutationCount;
        next.push({ id: `g${generation + 1}-${mating}-${puppy}`, sex: next.length % 2 === 0 ? "M" : "F", family: sire.family, ownerKennelId: `kennel-${mating % KENNELS}`, litterId: `g${generation + 1}-l${mating}`, birthEpoch: snapshotEpoch, genotype: inherited.genotype, traits: inherited.phenotype });
      }
    }
    prior = snapshot; population = next;
  }
  return { checkpoints, mutationCount };
}

function weightingInvariant() {
  const genotype = (allele: number): CanonicalGenotype => ({ geneticsVersion: CURRENT_GENETICS_VERSION, loci: Array.from({ length: TOTAL_LOCI }, () => [allele, allele] as const) });
  const records: SimDog[] = [
    ...Array.from({ length: 80 }, (_, index) => ({ id: `big-${index}`, sex: "M" as const, family: "big", ownerKennelId: "big", litterId: "big-litter", birthEpoch: -GENERATION_HOURS, genotype: genotype(2), traits: calculatePhenotypeFromGenotype(genotype(2)) })),
    ...Array.from({ length: 4 }, (_, kennel) => Array.from({ length: 5 }, (_, index) => ({ id: `small-${kennel}-${index}`, sex: "F" as const, family: `small-${kennel}`, ownerKennelId: `small-${kennel}`, litterId: `small-${kennel}-litter`, birthEpoch: -GENERATION_HOURS, genotype: genotype(-2), traits: calculatePhenotypeFromGenotype(genotype(-2)) }))).flat(),
  ];
  const snapshot = buildBreedGeneticBackgroundSnapshot({ candidates: records.map(toCandidate), snapshotEpoch: 0 });
  const locus = (snapshot.genotypeMetricsJson as { loci: Array<{ components: Array<{ component: string; share: number }> }> }).loci[0]!;
  assert.ok((locus.components.find((entry) => entry.component === "2.0")?.share ?? 0) < .25, "one kennel's 80-dog litter cannot dominate a hierarchical snapshot");
}

function siblingVariation() {
  const parents = initialPopulation().slice(0, 2);
  const random01 = rng("sibling-variation");
  const offspring = Array.from({ length: 24 }, () => inheritModelDGenotype({ sireGenotype: parents[0]!.genotype, damGenotype: parents[1]!.genotype, random01, mutation: FINAL_GENETICS_CALIBRATION.mutation }));
  return { uniqueGenotypes: new Set(offspring.map((child) => child.encodedGenotype)).size, headSd: sd(offspring.map((child) => child.phenotype.head)) };
}

function main() {
  weightingInvariant();
  const runs = {
    neutral: run("NEUTRAL", "none", 20), moderate: run("MODERATE", "low", 20), strongNone: run("STRONG", "none", 50), strongLow: run("STRONG", "low", 50), strongModerate: run("STRONG", "moderate", 20), complementary: run("COMPLEMENTARY", "low", 20), popularNone: run("POPULAR_SIRE", "none", 50), popularModerate: run("POPULAR_SIRE", "moderate", 50), diversity: run("DIVERSITY", "low", 50),
  };
  const g20 = (run: typeof runs.neutral) => run.checkpoints[20]!;
  const siblings = siblingVariation();
  assert.equal(runs.neutral.checkpoints[0]!.snapshot.sourceStatus, "LIVE", "120 dogs across 10 kennels satisfy the live snapshot threshold");
  assert.ok(g20(runs.strongNone).head.mean > g20(runs.neutral).head.mean + .5, "strong directional selection materially shifts hidden head direction");
  assert.ok(g20(runs.strongLow).head.mean > g20(runs.neutral).head.mean + .3, "low foundation intake retains most player direction");
  assert.ok(g20(runs.strongLow).foundationHead < g20(runs.strongLow).eliteHead, "foundations trail the scenario-defined elite player subset");
  assert.ok(g20(runs.popularModerate).heterozygosity > g20(runs.popularNone).heterozygosity, "moderate foundation intake improves popular-sire diversity recovery");
  assert.ok(g20(runs.diversity).fixed <= g20(runs.popularNone).fixed, "diversity stewardship avoids at least as much fixation as popular-sire concentration");
  assert.ok(g20(runs.complementary).head.sd > 0, "complementary pairings retain hidden-trait variation");
  assert.ok(runs.strongLow.mutationCount > 0, "canonical rare mutation remains present over long horizons");
  assert.ok(siblings.uniqueGenotypes > 1 && siblings.headSd > 0, "canonical sibling inheritance retains genotype and hidden-trait variation");
  const snapshotHead = ((g20(runs.strongLow).snapshot.phenotypeMetricsJson as Record<string, { mean: number }>).head).mean;
  assert.ok(Math.abs(snapshotHead - g20(runs.strongLow).head.mean) < .01, "the annual snapshot reflects the current balanced player population without extra generation lag");
  const small = buildBreedGeneticBackgroundSnapshot({ candidates: initialPopulation().slice(0, 40).map(toCandidate), snapshotEpoch: 0, priorSnapshot: runs.neutral.checkpoints[0]!.snapshot });
  assert.equal(small.sourceStatus, "RETAINED_BASELINE", "below-threshold populations retain a prior baseline rather than advancing LIVE truth");
  const retained = resolveFoundationPopulationContextFromSnapshot({ breedCode2: BREED, snapshot: { id: "retained", gameYear: 99, snapshotEpoch: 0, backgroundRulesVersion: BREED_BACKGROUND_RULES_VERSION, ...small } });
  assert.equal(retained.geneticDiversityContext.source.mode, "RETAINED_BASELINE", "foundation context consumes retained baseline semantics");
  console.log(JSON.stringify({ population: { dogs: POPULATION_SIZE, kennels: KENNELS, littersPerGeneration: MATINGS, puppiesPerLitter: LITTER_SIZE, analyticalGenerationHours: GENERATION_HOURS }, intake: FOUNDATION_RATES, checkpoints: [0, 3, 5, 10, 20, 50], siblings, summary: Object.fromEntries(Object.entries(runs).map(([name, result]) => [name, Object.fromEntries(Object.entries(result.checkpoints).map(([generation, value]) => [generation, { head: value.head, visible: value.visible, homozygosity: value.homozygosity, heterozygosity: value.heterozygosity, fixed: value.fixed, components: value.components, snapshot: value.snapshot.sourceStatus, foundationHead: value.foundationHead, eliteHead: value.eliteHead, opportunityTargets: value.opportunityTargets }]))])) }, null, 2));
  console.log("GEN-05 full production population-loop regression passed.");
}

main();
