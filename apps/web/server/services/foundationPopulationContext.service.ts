import { CURRENT_GENETICS_VERSION, FINAL_GENETICS_CALIBRATION } from "@showring/rules";
import { db } from "@/lib/db";
import { BREED_BACKGROUND_PAYLOAD_VERSION } from "@/server/services/breedGeneticBackground.service";

export type FoundationPopulationContext = {
  breedCode2: string;
  mode: "LIVE" | "RETAINED_BASELINE" | "RESET_FALLBACK";
  source: { snapshotId: string | null; gameYear: number | null; snapshotEpoch: number | null; rulesVersion: string | null; sourceFingerprint: string | null; eligibleDogCount: number; kennelCount: number };
  phenotype: unknown | null;
  genotype: unknown | null;
  resetCalibration: typeof FINAL_GENETICS_CALIBRATION;
};

function isEnriched(payload: unknown): boolean {
  return typeof payload === "object" && payload !== null && (payload as { payloadVersion?: unknown }).payloadVersion === BREED_BACKGROUND_PAYLOAD_VERSION;
}

/** Stable snapshot reader only; it never scans living dogs or alters generation. */
export async function resolveFoundationPopulationContext(breedCode2: string): Promise<FoundationPopulationContext> {
  const snapshot = await db.breedGeneticBackgroundSnapshot.findFirst({ where: { breedCode2, geneticsVersion: CURRENT_GENETICS_VERSION, sourceStatus: { in: ["LIVE", "RETAINED_BASELINE"] } }, orderBy: [{ gameYear: "desc" }, { createdAt: "desc" }] });
  if (snapshot && isEnriched(snapshot.genotypeMetricsJson) && (snapshot.sourceStatus === "LIVE" ? snapshot.qualifiesForLiveUpdate && snapshot.usableDogCount >= 50 && snapshot.kennelCount >= 5 : true)) {
    return { breedCode2, mode: snapshot.sourceStatus as "LIVE" | "RETAINED_BASELINE", source: { snapshotId: snapshot.id, gameYear: snapshot.gameYear, snapshotEpoch: snapshot.snapshotEpoch, rulesVersion: snapshot.backgroundRulesVersion, sourceFingerprint: snapshot.sourceFingerprint, eligibleDogCount: snapshot.usableDogCount, kennelCount: snapshot.kennelCount }, phenotype: snapshot.phenotypeMetricsJson, genotype: snapshot.genotypeMetricsJson, resetCalibration: FINAL_GENETICS_CALIBRATION };
  }
  return { breedCode2, mode: "RESET_FALLBACK", source: { snapshotId: null, gameYear: null, snapshotEpoch: null, rulesVersion: null, sourceFingerprint: null, eligibleDogCount: 0, kennelCount: 0 }, phenotype: null, genotype: null, resetCalibration: FINAL_GENETICS_CALIBRATION };
}
