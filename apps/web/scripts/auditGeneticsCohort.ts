// Internal developer audit only. This script is intentionally not reachable from an API or DTO.
// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";
import {
  CURRENT_GENETICS_VERSION,
  GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX,
  TRAIT_KEYS,
  TOTAL_ALLELE_VALUES,
  TOTAL_LOCI,
  calculatePhenotypeFromGenotype,
  decodeGenotype,
  type DogTraits,
} from "@showring/rules";
import {
  EFFECTIVELY_FIXED_COMPONENT_SHARE,
  NEAR_FIXED_COMPONENT_SHARE,
  alleleComponentBin,
} from "../server/services/breedGeneticBackground.service";

loadEnvConfig(process.cwd());

const TRAIT_COLUMNS = ["traitHead", "traitForequarters", "traitHindquarters", "traitGait", "traitCoat", "traitSize", "traitTemperament", "traitShowShine", "traitFeet", "traitTopline"] as const;
const NEAR_ZERO_BAND = 0.25;
const SCHEMA_VERSION = "genetics-cohort-audit-v1";

export type AuditOptions = {
  breed: string;
  cohort: string;
  nameContains?: string;
  origin?: "FOUNDATION" | "PLAYER_BRED";
  owner?: "player" | "system" | "any";
  dogIds?: string[];
  compare?: string;
  out?: string;
};

export type AuditDogInput = {
  id: string; regNumber: string; callName: string | null; registeredName: string | null;
  breedCode2: string; sex: "M" | "F"; originType: "FOUNDATION" | "PLAYER_BRED";
  ownerKennelId: string | null; ownerKennel: { id: string; name: string } | null;
  sireId: string | null; damId: string | null; litterId: string | null;
  birthEpoch: number; lifecycleState: string; genotype: string | null; geneticsVersion: string | null;
} & Record<(typeof TRAIT_COLUMNS)[number], { toString(): string }>;

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const populationSd = (values: number[]) => Math.sqrt(mean(values.map((value) => (value - mean(values)) ** 2)));
const percentile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  return sorted[lower]! + ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!) * (index - lower);
};
const summary = (values: number[]) => ({ count: values.length, mean: mean(values), sd: populationSd(values), min: Math.min(...values), max: Math.max(...values), p25: percentile(values, .25), p50: percentile(values, .5), p75: percentile(values, .75) });
const traitRecord = (dog: AuditDogInput): DogTraits => Object.fromEntries(TRAIT_KEYS.map((trait, index) => [trait, Number(dog[TRAIT_COLUMNS[index]!].toString())])) as DogTraits;
const round = (value: number) => Number(value.toFixed(6));

type ValidDog = AuditDogInput & { loci: readonly (readonly [number, number])[]; traits: DogTraits };

function distance(left: ValidDog, right: ValidDog) {
  return mean(left.loci.flatMap((locus, index) => locus.map((allele, alleleIndex) => Math.abs(allele - right.loci[index]![alleleIndex]!))));
}

function componentProfile(dog: ValidDog) {
  return dog.loci.map(([left, right]) => `${alleleComponentBin(left)}/${alleleComponentBin(right)}`).join("|");
}

function classify(dominantShare: number) {
  if (dominantShare >= EFFECTIVELY_FIXED_COMPONENT_SHARE) return "EFFECTIVELY_FIXED" as const;
  if (dominantShare >= NEAR_FIXED_COMPONENT_SHARE) return "NEAR_FIXED" as const;
  return dominantShare >= .5 ? "MONITOR" as const : "BROAD" as const;
}

export function buildGeneticsCohortAudit(input: { options: AuditOptions; dogs: AuditDogInput[] }) {
  const invalid: Array<{ dogId: string; registration: string; reasons: string[] }> = [];
  const valid: ValidDog[] = [];
  for (const dog of input.dogs) {
    const reasons: string[] = [];
    let loci: readonly (readonly [number, number])[] = [];
    if (dog.geneticsVersion !== CURRENT_GENETICS_VERSION) reasons.push(`unsupported geneticsVersion ${String(dog.geneticsVersion)}`);
    if (!dog.genotype) reasons.push("missing genotype");
    try { if (dog.genotype) loci = decodeGenotype(dog.genotype).loci; } catch { reasons.push("genotype failed canonical decode"); }
    if (loci.length !== TOTAL_LOCI) reasons.push(`expected ${TOTAL_LOCI} loci`);
    const alleles = loci.flat();
    if (alleles.length !== TOTAL_ALLELE_VALUES) reasons.push(`expected ${TOTAL_ALLELE_VALUES} allele values`);
    if (alleles.some((allele) => !Number.isFinite(allele) || Math.abs(allele) > GENOTYPE_ALLELE_EFFECT_ABSOLUTE_MAX)) reasons.push("non-finite or out-of-bounds allele");
    const traits = traitRecord(dog);
    if (!reasons.length) {
      const reconstructed = calculatePhenotypeFromGenotype({ geneticsVersion: CURRENT_GENETICS_VERSION, loci });
      for (const trait of TRAIT_KEYS) if (Math.abs(reconstructed[trait] - traits[trait]) > 1e-6) reasons.push(`persisted ${trait} differs from canonical phenotype`);
    }
    if (reasons.length) invalid.push({ dogId: dog.id, registration: dog.regNumber, reasons });
    else valid.push({ ...dog, loci, traits });
  }
  if (!valid.length) throw new Error("DATA INTEGRITY FAILURE: no valid genotypes remain for metrics.");

  const componentCarriers = new Map<string, { copies: number; dogs: Set<string>; male: Set<string>; female: Set<string> }>();
  for (const dog of valid) dog.loci.forEach((locus, locusIndex) => locus.forEach((allele) => {
    const key = `${locusIndex + 1}:${alleleComponentBin(allele)}`;
    const item = componentCarriers.get(key) ?? { copies: 0, dogs: new Set(), male: new Set(), female: new Set() };
    item.copies += 1; item.dogs.add(dog.id); (dog.sex === "M" ? item.male : item.female).add(dog.id); componentCarriers.set(key, item);
  }));
  const rareComponents = [...componentCarriers.entries()].flatMap(([key, item]) => {
    const [locus, component] = key.split(":");
    return item.dogs.size <= 2 || item.copies === 1 || !item.male.size || !item.female.size
      ? [{ locus: Number(locus), trait: TRAIT_KEYS[Math.floor((Number(locus) - 1) / 4)]!, component, copies: item.copies, dogCount: item.dogs.size, maleCarrierCount: item.male.size, femaleCarrierCount: item.female.size, carrierDogIds: [...item.dogs].sort() }]
      : [];
  });
  const singletonCountByDog = new Map(valid.map((dog) => [dog.id, 0]));
  rareComponents.filter((item) => item.dogCount === 1).forEach((item) => item.carrierDogIds.forEach((id) => singletonCountByDog.set(id, (singletonCountByDog.get(id) ?? 0) + 1)));

  const dogRows = valid.map((dog) => {
    const values = TRAIT_KEYS.map((trait) => dog.traits[trait]);
    const exact = dog.loci.filter(([left, right]) => left === right).length;
    const sameBin = dog.loci.filter(([left, right]) => alleleComponentBin(left) === alleleComponentBin(right)).length;
    return { dogId: dog.id, registration: dog.regNumber, callName: dog.callName, registeredName: dog.registeredName, breed: dog.breedCode2, sex: dog.sex, origin: dog.originType, kennel: dog.ownerKennel ? { id: dog.ownerKennel.id, name: dog.ownerKennel.name } : null, sireId: dog.sireId, damId: dog.damId, litterId: dog.litterId, birthEpoch: dog.birthEpoch, lifecycleState: dog.lifecycleState, genotypeVersion: dog.geneticsVersion, exactHomozygousLoci: exact, sameComponentBinLoci: sameBin, componentBinHeterozygousLoci: TOTAL_LOCI - sameBin, singletonComponentsCarried: singletonCountByDog.get(dog.id) ?? 0, hiddenTraits: dog.traits, hiddenTraitSd: populationSd(values), minHiddenTrait: Math.min(...values), maxHiddenTrait: Math.max(...values), maxAbsoluteDeviationFromIdeal: Math.max(...values.map((value) => Math.abs(value - 10))) };
  });
  const allAlleles = valid.flatMap((dog) => dog.loci.flat());
  const traitMetrics = Object.fromEntries(TRAIT_KEYS.map((trait) => [trait, summary(valid.map((dog) => dog.traits[trait]))]));
  const loci = Array.from({ length: TOTAL_LOCI }, (_, index) => {
    const alleles = valid.flatMap((dog) => dog.loci[index]!);
    const bins = new Map<string, number>(); alleles.forEach((allele) => bins.set(alleleComponentBin(allele), (bins.get(alleleComponentBin(allele)) ?? 0) + 1));
    const shares = [...bins.values()].map((count) => count / alleles.length);
    const dominantShare = Math.max(...shares);
    const exact = valid.filter((dog) => dog.loci[index]![0] === dog.loci[index]![1]).length;
    const sameBin = valid.filter((dog) => alleleComponentBin(dog.loci[index]![0]) === alleleComponentBin(dog.loci[index]![1])).length;
    return { locus: index + 1, trait: TRAIT_KEYS[Math.floor(index / 4)]!, alleleCount: alleles.length, ...summary(alleles), hasNegative: alleles.some((allele) => allele < 0), hasPositive: alleles.some((allele) => allele > 0), components: Object.fromEntries([...bins.entries()].sort(([left], [right]) => left.localeCompare(right))), representedComponentCount: bins.size, dominantComponentShare: dominantShare, effectiveComponentCount: 1 / shares.reduce((sum, share) => sum + share * share, 0), exactHomozygousDogCount: exact, sameBinHomozygousDogCount: sameBin, componentBinHeterozygousDogCount: valid.length - sameBin, classification: classify(dominantShare) };
  });
  const pairs = valid.flatMap((dog, index) => valid.slice(index + 1).map((other) => ({ leftDogId: dog.id, rightDogId: other.id, distance: distance(dog, other), sameSex: dog.sex === other.sex })));
  const pairDistances = pairs.map((pair) => pair.distance);
  const closest = [...pairs].sort((left, right) => left.distance - right.distance)[0]!;
  const mostDistinct = [...pairs].sort((left, right) => right.distance - left.distance)[0]!;
  const profileGroups = new Map<string, string[]>(); valid.forEach((dog) => { const profile = componentProfile(dog); profileGroups.set(profile, [...(profileGroups.get(profile) ?? []), dog.id]); });
  const phenotypeDistance = (left: ValidDog, right: ValidDog) => Math.sqrt(mean(TRAIT_KEYS.map((trait) => (left.traits[trait] - right.traits[trait]) ** 2)));
  const diagnosticPairs = pairs.map((pair) => {
    const left = valid.find((dog) => dog.id === pair.leftDogId)!; const right = valid.find((dog) => dog.id === pair.rightDogId)!;
    const overlap = left.loci.flatMap((locus, index) => locus.map((allele, alleleIndex) => alleleComponentBin(allele) === alleleComponentBin(right.loci[index]![alleleIndex]!))).filter(Boolean).length / TOTAL_ALLELE_VALUES;
    return { ...pair, phenotypeDistance: phenotypeDistance(left, right), componentSlotOverlap: overlap };
  });
  const idealRows = dogRows.map((dog) => ({ dog, mad: mean(TRAIT_KEYS.map((trait) => Math.abs(dog.hiddenTraits[trait] - 10))) })).sort((left, right) => left.mad - right.mad);
  const closestIdeal = idealRows[0]!;
  const sexes = (["M", "F"] as const).map((sex) => {
    const dogs = valid.filter((dog) => dog.sex === sex);
    const alleleValues = dogs.flatMap((dog) => dog.loci.flat());
    return { sex, dogCount: dogs.length, alleleSd: dogs.length ? populationSd(alleleValues) : null, meanSameBinLoci: dogs.length ? mean(dogRows.filter((dog) => dog.sex === sex).map((dog) => dog.sameComponentBinLoci)) : null, uniqueSexOnlyComponents: rareComponents.filter((component) => sex === "M" ? component.femaleCarrierCount === 0 : component.maleCarrierCount === 0).length };
  });
  const allTraitValues = valid.flatMap((dog) => TRAIT_KEYS.map((trait) => dog.traits[trait]));
  const metrics = {
    cohortDogCount: valid.length, sexCounts: Object.fromEntries(sexes.map((sex) => [sex.sex, sex.dogCount])),
    aggregateHiddenTraitSd: populationSd(allTraitValues), allele: { alleleCount: allAlleles.length, ...summary(allAlleles), negativePercent: allAlleles.filter((allele) => allele < 0).length / allAlleles.length * 100, positivePercent: allAlleles.filter((allele) => allele > 0).length / allAlleles.length * 100, nearZeroBand: NEAR_ZERO_BAND, nearZeroPercent: allAlleles.filter((allele) => Math.abs(allele) <= NEAR_ZERO_BAND).length / allAlleles.length * 100 },
    hiddenExtremes: { anyAtOrBelow5: dogRows.filter((dog) => dog.minHiddenTrait <= 5).length, anyAtOrAbove15: dogRows.filter((dog) => dog.maxHiddenTrait >= 15).length, anyAtOrBelow3: dogRows.filter((dog) => dog.minHiddenTrait <= 3).length, anyAtOrAbove17: dogRows.filter((dog) => dog.maxHiddenTrait >= 17).length, bothLowAndHigh: dogRows.filter((dog) => dog.minHiddenTrait <= 5 && dog.maxHiddenTrait >= 15).length },
    homozygosity: { exact: summary(dogRows.map((dog) => dog.exactHomozygousLoci)), sameBin: summary(dogRows.map((dog) => dog.sameComponentBinLoci)), heterozygousBin: summary(dogRows.map((dog) => dog.componentBinHeterozygousLoci)) },
    loci: { meanComponentCount: mean(loci.map((locus) => locus.representedComponentCount)), meanEffectiveComponentCount: mean(loci.map((locus) => locus.effectiveComponentCount)), meanDominantComponentShare: mean(loci.map((locus) => locus.dominantComponentShare)), nearFixedCount: loci.filter((locus) => locus.classification === "NEAR_FIXED").length, effectivelyFixedCount: loci.filter((locus) => locus.classification === "EFFECTIVELY_FIXED").length },
    pairwise: pairs.length ? { metric: "audit_only_mean_absolute_difference_across_80_stored_allele_slots", ...summary(pairDistances), closestPair: closest, mostDistinctPair: mostDistinct, sameSexMean: pairs.some((pair) => pair.sameSex) ? mean(pairs.filter((pair) => pair.sameSex).map((pair) => pair.distance)) : null, oppositeSexMean: pairs.some((pair) => !pair.sameSex) ? mean(pairs.filter((pair) => !pair.sameSex).map((pair) => pair.distance)) : null } : null,
    hiddenIdeal: { closestDogId: closestIdeal.dog.dogId, closestDogMad: closestIdeal.mad, closestDogMaxDeviation: closestIdeal.dog.maxAbsoluteDeviationFromIdeal, closestDogTraitsWithin1: TRAIT_KEYS.filter((trait) => Math.abs(closestIdeal.dog.hiddenTraits[trait] - 10) <= 1).length, closestDogTraitsWithin05: TRAIT_KEYS.filter((trait) => Math.abs(closestIdeal.dog.hiddenTraits[trait] - 10) <= .5).length, closestDogTraitsWithin01: TRAIT_KEYS.filter((trait) => Math.abs(closestIdeal.dog.hiddenTraits[trait] - 10) <= .1).length, allTraitsWithin1: dogRows.filter((dog) => TRAIT_KEYS.every((trait) => Math.abs(dog.hiddenTraits[trait] - 10) <= 1)).length, allTraitsWithin05: dogRows.filter((dog) => TRAIT_KEYS.every((trait) => Math.abs(dog.hiddenTraits[trait] - 10) <= .5)).length, allTraitsWithin01: dogRows.filter((dog) => TRAIT_KEYS.every((trait) => Math.abs(dog.hiddenTraits[trait] - 10) <= .1)).length },
  };
  const traitArchitecture = TRAIT_KEYS.map((trait, traitIndex) => { const traitLoci = loci.slice(traitIndex * 4, traitIndex * 4 + 4); return { trait, loci: traitLoci.map((locus) => locus.locus), alleleSd: populationSd(valid.flatMap((dog) => dog.loci.slice(traitIndex * 4, traitIndex * 4 + 4).flat())), meanComponentCount: mean(traitLoci.map((locus) => locus.representedComponentCount)), hiddenTraitSd: traitMetrics[trait].sd }; });
  return { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), breed: input.options.breed, cohortLabel: input.options.cohort, filters: { nameContains: input.options.nameContains ?? null, origin: input.options.origin ?? null, owner: input.options.owner ?? "any", dogIds: input.options.dogIds ?? null }, integrity: { status: invalid.length ? "DATA_INTEGRITY_FAILURE" : "VALID", invalidDogs: invalid }, dogIds: dogRows.map((dog) => dog.dogId), dogs: dogRows, traitMetrics, traitArchitecture, loci, rareComponents, sexMetrics: sexes, duplicates: { identicalGenotypes: [...new Map(valid.map((dog) => [dog.genotype!, valid.filter((other) => other.genotype === dog.genotype).map((other) => other.id)])).values()].filter((ids) => ids.length > 1), identicalComponentProfiles: [...profileGroups.values()].filter((ids) => ids.length > 1) }, diagnostics: { phenotypeSimilarGenotypeDifferent: [...diagnosticPairs].sort((left, right) => left.phenotypeDistance - right.phenotypeDistance || right.distance - left.distance).slice(0, 3), phenotypeDifferentComponentOverlap: [...diagnosticPairs].sort((left, right) => right.componentSlotOverlap - left.componentSlotOverlap || right.phenotypeDistance - left.phenotypeDistance).slice(0, 3) }, metrics, classification: invalid.length ? "DATA_INTEGRITY_FAILURE" : metrics.loci.effectivelyFixedCount ? "CONCENTRATING" : metrics.loci.nearFixedCount ? "ADEQUATE_BUT_MONITOR" : "BROAD" };
}

function parseArgs(argv: string[]): AuditOptions {
  const result: Partial<AuditOptions> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]!; const value = argv[index + 1];
    if (key === "--") continue;
    if (!key.startsWith("--")) throw new Error(`Unexpected argument ${key}`);
    if (!value) throw new Error(`Missing value for ${key}`);
    index += 1;
    if (key === "--breed") result.breed = value.toUpperCase(); else if (key === "--cohort") result.cohort = value;
    else if (key === "--name-contains") result.nameContains = value; else if (key === "--origin" && (value === "FOUNDATION" || value === "PLAYER_BRED")) result.origin = value;
    else if (key === "--owner" && (value === "player" || value === "system" || value === "any")) result.owner = value;
    else if (key === "--dog-ids") result.dogIds = value.split(",").map((id) => id.trim()).filter(Boolean);
    else if (key === "--compare") result.compare = value; else if (key === "--out") result.out = value; else throw new Error(`Unsupported option ${key}`);
  }
  if (!result.breed || !result.cohort) throw new Error("Usage: --breed <code> --cohort <label> [--name-contains <text>] [--origin FOUNDATION|PLAYER_BRED] [--owner player|system|any] [--dog-ids <ids>] [--compare <json>] [--out <json>]");
  return result as AuditOptions;
}

export function compareGeneticsCohortAudits(current: ReturnType<typeof buildGeneticsCohortAudit>, prior: ReturnType<typeof buildGeneticsCohortAudit>) {
  const fields = { cohortDogCount: current.metrics.cohortDogCount, alleleSd: current.metrics.allele.sd, aggregateHiddenTraitSd: current.metrics.aggregateHiddenTraitSd, meanHeterozygousBinLoci: current.metrics.homozygosity.heterozygousBin.mean, meanComponentCount: current.metrics.loci.meanComponentCount, meanDominantComponentShare: current.metrics.loci.meanDominantComponentShare, nearFixedCount: current.metrics.loci.nearFixedCount, effectivelyFixedCount: current.metrics.loci.effectivelyFixedCount, singletonComponentCount: current.rareComponents.filter((component) => component.copies === 1).length, medianPairwiseDistance: current.metrics.pairwise?.p50 ?? null };
  const previous = { cohortDogCount: prior.metrics.cohortDogCount, alleleSd: prior.metrics.allele.sd, aggregateHiddenTraitSd: prior.metrics.aggregateHiddenTraitSd, meanHeterozygousBinLoci: prior.metrics.homozygosity.heterozygousBin.mean, meanComponentCount: prior.metrics.loci.meanComponentCount, meanDominantComponentShare: prior.metrics.loci.meanDominantComponentShare, nearFixedCount: prior.metrics.loci.nearFixedCount, effectivelyFixedCount: prior.metrics.loci.effectivelyFixedCount, singletonComponentCount: prior.rareComponents.filter((component) => component.copies === 1).length, medianPairwiseDistance: prior.metrics.pairwise?.p50 ?? null };
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => { const old = previous[key as keyof typeof previous]; const numericOld = typeof old === "number" ? old : null; const delta = value === null || numericOld === null ? null : value - numericOld; const denominator = numericOld ?? 0; return [key, { prior: old, current: value, absoluteChange: delta, percentChange: delta === null || denominator === 0 ? null : delta / denominator * 100 }]; }));
}

function humanReport(audit: ReturnType<typeof buildGeneticsCohortAudit>) {
  const m = audit.metrics;
  const traits = audit.dogs.map((dog) => `| ${dog.dogId} | ${dog.registration} | ${dog.sex} | ${TRAIT_KEYS.map((trait) => round(dog.hiddenTraits[trait])).join(" | ")} | ${round(dog.hiddenTraitSd)} | ${dog.sameComponentBinLoci} | ${dog.componentBinHeterozygousLoci} |`).join("\n");
  const loci = audit.loci.map((locus) => `| ${locus.locus} | ${locus.trait} | ${round(locus.mean)} | ${round(locus.sd)} | ${round(locus.min)}..${round(locus.max)} | ${locus.representedComponentCount} | ${round(locus.dominantComponentShare)} | ${round(locus.effectiveComponentCount)} | ${locus.exactHomozygousDogCount}/${locus.sameBinHomozygousDogCount}/${locus.componentBinHeterozygousDogCount} | ${locus.classification} |`).join("\n");
  return ["# Genetics Cohort Audit", `Cohort: ${audit.cohortLabel} | breed: ${audit.breed} | filters: ${JSON.stringify(audit.filters)} | matched valid dogs: ${m.cohortDogCount}`, `Integrity: ${audit.integrity.status}; M/F: ${m.sexCounts.M}/${m.sexCounts.F}`, `Alleles: SD ${round(m.allele.sd)}, range ${round(m.allele.min)}..${round(m.allele.max)}, near-zero ±${m.allele.nearZeroBand}: ${round(m.allele.nearZeroPercent)}%`, `Loci: components ${round(m.loci.meanComponentCount)}, effective ${round(m.loci.meanEffectiveComponentCount)}, dominant share ${round(m.loci.meanDominantComponentShare)}, near/fixed ${m.loci.nearFixedCount}/${m.loci.effectivelyFixedCount}`, `Homozygosity: exact ${round(m.homozygosity.exact.mean)}, same-bin ${round(m.homozygosity.sameBin.mean)}, heterozygous-bin ${round(m.homozygosity.heterozygousBin.mean)}`, `Pairwise median: ${m.pairwise ? round(m.pairwise.p50) : "n/a"}; singleton copies: ${audit.rareComponents.filter((component) => component.copies === 1).length}`, `Classification: ${audit.classification}`, "\n## Dogs", "| ID | Registration | Sex | Head | Fore | Hind | Gait | Coat | Size | Temp | Shine | Feet | Topline | Trait SD | Same-bin | Bin-hetero |", "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|", traits, "\n## Loci", "| Locus | Trait | Mean | SD | Range | Bins | Dominant | Effective | Exact/Same/Hetero | Class |", "|---:|---|---:|---:|---|---:|---:|---:|---|---|", loci].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const where = { breedCode2: options.breed, ...(options.nameContains ? { registeredName: { contains: options.nameContains, mode: "insensitive" as const } } : {}), ...(options.origin ? { originType: options.origin } : {}), ...(options.owner === "player" ? { ownerKennelId: { not: null } } : options.owner === "system" ? { ownerKennelId: null } : {}), ...(options.dogIds?.length ? { id: { in: options.dogIds } } : {}) };
    const dogs = await prisma.dog.findMany({ where, orderBy: { id: "asc" }, select: { id: true, regNumber: true, callName: true, registeredName: true, breedCode2: true, sex: true, originType: true, ownerKennelId: true, ownerKennel: { select: { id: true, name: true } }, sireId: true, damId: true, litterId: true, birthEpoch: true, lifecycleState: true, genotype: true, geneticsVersion: true, traitHead: true, traitForequarters: true, traitHindquarters: true, traitGait: true, traitCoat: true, traitSize: true, traitTemperament: true, traitShowShine: true, traitFeet: true, traitTopline: true } });
    if (!dogs.length) throw new Error("No dogs matched the explicit cohort criteria.");
    if (new Set(dogs.map((dog) => dog.breedCode2)).size !== 1) throw new Error("Cohort criteria unexpectedly matched multiple breeds.");
    const audit = buildGeneticsCohortAudit({ options, dogs: dogs as AuditDogInput[] });
    const output = options.compare ? { ...audit, comparison: compareGeneticsCohortAudits(audit, JSON.parse(await (await import("node:fs/promises")).readFile(options.compare, "utf8"))) } : audit;
    console.log(humanReport(audit));
    if (options.out) await writeFile(options.out, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1]?.includes("auditGeneticsCohort")) void main();
