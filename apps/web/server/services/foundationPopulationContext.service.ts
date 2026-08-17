import {
  CURRENT_GENETICS_VERSION,
  FINAL_GENETICS_CALIBRATION,
  TRAIT_KEYS,
  type FoundationContextSource,
  type FoundationGeneticDiversityContext,
  type FoundationLocusDiversityContext,
  type FoundationPhenotypeContext,
  type FoundationPhenotypeTraitContext,
  createResetFoundationPopulationContext,
} from "@showring/rules";
import { db } from "@/lib/db";
import { BREED_BACKGROUND_PAYLOAD_VERSION } from "@/server/services/breedGeneticBackground.service";

export type FoundationPopulationContext = {
  breedCode2: string;
  phenotypeContext: FoundationPhenotypeContext;
  geneticDiversityContext: FoundationGeneticDiversityContext;
  resetCalibration: typeof FINAL_GENETICS_CALIBRATION;
};

function isEnriched(payload: unknown): boolean {
  return typeof payload === "object" && payload !== null && (payload as { payloadVersion?: unknown }).payloadVersion === BREED_BACKGROUND_PAYLOAD_VERSION;
}

function isFiniteNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

function mapPhenotypeContext(source: FoundationContextSource, payload: unknown): FoundationPhenotypeContext {
  if (source.mode === "RESET_FALLBACK" || typeof payload !== "object" || payload === null) return { source, traits: null };
  const traits: Partial<Record<(typeof TRAIT_KEYS)[number], FoundationPhenotypeTraitContext>> = {};
  for (const trait of TRAIT_KEYS) {
    const value = (payload as Record<string, unknown>)[trait];
    if (typeof value !== "object" || value === null) continue;
    const metric = value as Record<string, unknown>;
    if (["mean", "variance", "meanAbsoluteDeviation", "min", "max", "belowCount", "exactCount", "aboveCount", "belowShare", "aboveShare", "nearIdealShare"].every(key => isFiniteNumber(metric[key])) && (metric.belowMean === null || isFiniteNumber(metric.belowMean)) && (metric.aboveMean === null || isFiniteNumber(metric.aboveMean))) {
      traits[trait] = { center: metric.mean as number, variance: metric.variance as number, meanAbsoluteDeviation: metric.meanAbsoluteDeviation as number, min: metric.min as number, max: metric.max as number, belowCount: metric.belowCount as number, exactCount: metric.exactCount as number, aboveCount: metric.aboveCount as number, belowCenter: metric.belowMean as number | null, aboveCenter: metric.aboveMean as number | null, belowShare: metric.belowShare as number, aboveShare: metric.aboveShare as number, nearIdealShare: metric.nearIdealShare as number };
    }
  }
  return { source, traits: Object.keys(traits).length === 0 ? null : traits };
}

function mapGeneticDiversityContext(source: FoundationContextSource, payload: unknown): FoundationGeneticDiversityContext {
  if (source.mode === "RESET_FALLBACK" || typeof payload !== "object" || payload === null) return { source, payloadVersion: null, componentBinWidth: null, overallMeanHomozygosity: null, fixedLocusCount: null, nearFixedLocusCount: null, loci: null };
  const metrics = payload as Record<string, unknown>;
  const loci = Array.isArray(metrics.loci) ? metrics.loci.flatMap((value): FoundationLocusDiversityContext[] => {
    if (typeof value !== "object" || value === null) return [];
    const locus = value as Record<string, unknown>;
    const components = Array.isArray(locus.components) ? locus.components.flatMap(component => typeof component === "object" && component !== null && isFiniteNumber((component as Record<string, unknown>).share) && isFiniteNumber(Number((component as Record<string, unknown>).component)) ? [{ component: String((component as Record<string, unknown>).component), share: (component as Record<string, unknown>).share as number }] : []) : [];
    return Number.isInteger(locus.locus) && isFiniteNumber(locus.dominantShare) && isFiniteNumber(locus.effectiveComponentCount) && isFiniteNumber(locus.homozygosity) && (locus.classification === "DIVERSE" || locus.classification === "NEAR_FIXED" || locus.classification === "EFFECTIVELY_FIXED") && components.length > 0 ? [{ locus: locus.locus as number, components, dominantShare: locus.dominantShare as number, effectiveComponentCount: locus.effectiveComponentCount as number, homozygosity: locus.homozygosity as number, classification: locus.classification }] : [];
  }) : null;
  return { source, payloadVersion: typeof metrics.payloadVersion === "string" ? metrics.payloadVersion : null, componentBinWidth: isFiniteNumber(metrics.componentBinWidth) ? metrics.componentBinWidth : null, overallMeanHomozygosity: isFiniteNumber(metrics.overallMeanHomozygosity) ? metrics.overallMeanHomozygosity : null, fixedLocusCount: isFiniteNumber(metrics.fixedLocusCount) ? metrics.fixedLocusCount : null, nearFixedLocusCount: isFiniteNumber(metrics.nearFixedLocusCount) ? metrics.nearFixedLocusCount : null, loci: loci?.length ? loci : null };
}


/** Stable snapshot reader only; it never scans living dogs or alters generation. */
export async function resolveFoundationPopulationContext(breedCode2: string): Promise<FoundationPopulationContext> {
  const snapshot = await db.breedGeneticBackgroundSnapshot.findFirst({ where: { breedCode2, geneticsVersion: CURRENT_GENETICS_VERSION, sourceStatus: { in: ["LIVE", "RETAINED_BASELINE"] } }, orderBy: [{ gameYear: "desc" }, { createdAt: "desc" }] });
  if (snapshot && isEnriched(snapshot.genotypeMetricsJson) && (snapshot.sourceStatus === "LIVE" ? snapshot.qualifiesForLiveUpdate && snapshot.usableDogCount >= 50 && snapshot.kennelCount >= 5 : true)) {
    const source: FoundationContextSource = { mode: snapshot.sourceStatus as "LIVE" | "RETAINED_BASELINE", snapshotId: snapshot.id, gameYear: snapshot.gameYear, snapshotEpoch: snapshot.snapshotEpoch, rulesVersion: snapshot.backgroundRulesVersion, sourceFingerprint: snapshot.sourceFingerprint, eligibleDogCount: snapshot.usableDogCount, kennelCount: snapshot.kennelCount };
    return { breedCode2, phenotypeContext: mapPhenotypeContext(source, snapshot.phenotypeMetricsJson), geneticDiversityContext: mapGeneticDiversityContext(source, snapshot.genotypeMetricsJson), resetCalibration: FINAL_GENETICS_CALIBRATION };
  }
  return { breedCode2, ...createResetFoundationPopulationContext(), resetCalibration: FINAL_GENETICS_CALIBRATION };
}

export const foundationPopulationContextMapping = { mapPhenotypeContext, mapGeneticDiversityContext };
