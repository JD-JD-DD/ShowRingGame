import { CURRENT_BREED_RELEASE, CURRENT_GENETICS_VERSION, DAM_MAX_BREED_AGE_HOURS, MIN_BREED_AGE_HOURS, TRAIT_IDEAL, TRAIT_KEYS, decodeGenotype } from "@showring/rules";
import { db } from "@/lib/db";
import { toRulesDogTraits, type PersistedDogTraitRecord } from "@/server/services/phenotypePersistence.service";

export const BREED_BACKGROUND_RULES_VERSION = "breed-background-v1";
const MIN_DOGS = 50;
const MIN_KENNELS = 5;

type Candidate = PersistedDogTraitRecord & { id: string; ownerKennelId: string | null; litterId: string | null; sex: "M" | "F"; birthEpoch: number; genotype: string | null; geneticsVersion: string | null };

/** Stable biological eligibility only; temporary breeding logistics are intentionally ignored. */
export function isBreedBackgroundReferenceDog(dog: Candidate, snapshotEpoch: number): boolean {
  const age = Math.max(0, snapshotEpoch - dog.birthEpoch);
  return dog.ownerKennelId !== null && age >= MIN_BREED_AGE_HOURS && (dog.sex !== "F" || age <= DAM_MAX_BREED_AGE_HOURS);
}

function hash(value: string): string { let h = 2166136261; for (const c of value) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
function mean(values: number[], weights?: number[]) { const total = weights ? weights.reduce((a,b)=>a+b,0) : values.length; return values.reduce((a,v,i)=>a+v*(weights?.[i] ?? 1),0) / total; }
function concentration(groups: string[]) { const counts = new Map<string,number>(); groups.forEach(g=>counts.set(g,(counts.get(g)??0)+1)); const shares=[...counts.values()].map(v=>v/groups.length); return { counts: Object.fromEntries([...counts].sort()), maxShare: Math.max(...shares), herfindahl: shares.reduce((a,v)=>a+v*v,0) }; }

export async function createBreedGeneticBackgroundSnapshots(args: { gameYear: number; snapshotEpoch: number }) {
  const breeds = await db.breed.findMany({ where: { isActive: true, releaseVersion: { lte: CURRENT_BREED_RELEASE } }, orderBy: { code2: "asc" }, select: { code2: true } });
  const reports = [];
  for (const breed of breeds) {
    const existing = await db.breedGeneticBackgroundSnapshot.findUnique({ where: { breedCode2_gameYear_backgroundRulesVersion: { breedCode2: breed.code2, gameYear: args.gameYear, backgroundRulesVersion: BREED_BACKGROUND_RULES_VERSION } } });
    const rows = await db.dog.findMany({ where: { breedCode2: breed.code2, lifecycleState: "ALIVE", originType: "PLAYER_BRED", isFoundation: false, ownerKennelId: { not: null } }, orderBy: [{ ownerKennelId: "asc" }, { litterId: "asc" }, { id: "asc" }], select: { id:true, ownerKennelId:true, litterId:true, sex:true, birthEpoch:true, genotype:true, geneticsVersion:true, traitHead:true, traitForequarters:true, traitHindquarters:true, traitGait:true, traitCoat:true, traitSize:true, traitTemperament:true, traitShowShine:true, traitFeet:true, traitTopline:true } });
    const eligible = rows.filter(row => isBreedBackgroundReferenceDog(row, args.snapshotEpoch));
    const usable: Array<Candidate & { decoded: ReturnType<typeof decodeGenotype> }> = []; let invalidGenotype = 0;
    for (const row of eligible) { try { if (row.geneticsVersion !== CURRENT_GENETICS_VERSION || !row.genotype) throw new Error(); usable.push({ ...row, decoded: decodeGenotype(row.genotype) }); } catch { invalidGenotype += 1; } }
    const kennels = new Set(usable.map(d=>d.ownerKennelId!)); const cohorts = usable.map(d=>d.litterId ?? `root:${d.id}`); const qualifies = usable.length >= MIN_DOGS && kennels.size >= MIN_KENNELS;
    const fingerprint = hash(JSON.stringify(usable.map(d=>[d.id,d.ownerKennelId,d.litterId,d.genotype,TRAIT_KEYS.map(t=>toRulesDogTraits(d)[t])] )));
    if (existing) { if (existing.sourceFingerprint !== fingerprint) throw new Error(`GEN-05 source conflict for ${breed.code2} year ${args.gameYear}.`); reports.push({ breedCode2: breed.code2, status: "EXISTING" }); continue; }
    const prior = await db.breedGeneticBackgroundSnapshot.findFirst({ where: { breedCode2: breed.code2 }, orderBy: [{ gameYear:"desc" }, { createdAt:"desc" }] });
    const kennelGroups = usable.map(d=>d.ownerKennelId!); const cohortGroups = cohorts;
    const kennelSizes = new Map<string,number>(); kennelGroups.forEach(k=>kennelSizes.set(k,(kennelSizes.get(k)??0)+1));
    const cohortSizes = new Map<string,number>(); const kennelCohorts = new Map<string,Set<string>>(); usable.forEach((d,i)=>{const key=`${d.ownerKennelId}:${cohorts[i]}`;cohortSizes.set(key,(cohortSizes.get(key)??0)+1); const set=kennelCohorts.get(d.ownerKennelId!)??new Set<string>();set.add(key);kennelCohorts.set(d.ownerKennelId!,set)});
    const weights = usable.map((d,i)=>{const kennel=d.ownerKennelId!;const key=`${kennel}:${cohorts[i]}`;return 1 / kennels.size / kennelCohorts.get(kennel)!.size / cohortSizes.get(key)!}); const normalizer=weights.reduce((a,b)=>a+b,0); weights.forEach((w,i)=>weights[i]=w/normalizer);
    const phenotypeMetrics = Object.fromEntries(TRAIT_KEYS.map(trait=>{ const values=usable.map(d=>toRulesDogTraits(d)[trait]); const m=mean(values,weights); const below=values.filter(v=>v<TRAIT_IDEAL);const above=values.filter(v=>v>TRAIT_IDEAL); return [trait,{ count:values.length, mean:m, min:Math.min(...values), max:Math.max(...values), variance:mean(values.map(v=>(v-m)**2),weights), meanAbsoluteDeviation:mean(values.map(v=>Math.abs(v-TRAIT_IDEAL)),weights), belowCount:below.length, exactCount:values.filter(v=>v===TRAIT_IDEAL).length, aboveCount:above.length, belowMean:below.length?mean(below):null, aboveMean:above.length?mean(above):null }]; }));
    const genotypeMetrics = { overallMeanHomozygosity: mean(Array.from({length:40},(_,locus)=>mean(usable.map(d=>d.decoded.loci[locus][0]===d.decoded.loci[locus][1]?1:0),weights))), locusCount:40 };
    await db.breedGeneticBackgroundSnapshot.create({ data: { breedCode2:breed.code2, gameYear:args.gameYear, backgroundRulesVersion:BREED_BACKGROUND_RULES_VERSION, geneticsVersion:CURRENT_GENETICS_VERSION, snapshotEpoch:args.snapshotEpoch, sourceStatus:qualifies?"LIVE":prior?"RETAINED_BASELINE":"BASELINE", priorSnapshotId:prior?.id ?? null, sourceFingerprint:fingerprint, eligibleDogCount:eligible.length, usableDogCount:usable.length, kennelCount:kennels.size, litterCount:new Set(cohorts).size, qualifiesForLiveUpdate:qualifies, exclusionMetricsJson:{ invalidGenotype }, rawConcentrationJson:{ kennels:concentration(kennelGroups), litters:concentration(cohortGroups) }, weightingAuditJson:{ version:"hierarchical-kennel-litter-v1", effectiveWeightSum:weights.reduce((a,b)=>a+b,0), kennelRawCounts:Object.fromEntries(kennelSizes) }, phenotypeMetricsJson: qualifies ? phenotypeMetrics : prior?.phenotypeMetricsJson ?? { status:"NO_SUFFICIENT_POPULATION_EVIDENCE" }, genotypeMetricsJson: qualifies ? genotypeMetrics : prior?.genotypeMetricsJson ?? { status:"NO_SUFFICIENT_POPULATION_EVIDENCE" } } });
    reports.push({ breedCode2: breed.code2, status: qualifies ? "LIVE" : prior ? "RETAINED_BASELINE" : "BASELINE" });
  }
  return reports;
}
