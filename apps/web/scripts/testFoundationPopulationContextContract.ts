import assert from "node:assert/strict";

import { createResetFoundationPopulationContext } from "@showring/rules";
import { foundationPopulationContextMapping } from "@/server/services/foundationPopulationContext.service";

const liveSource = { mode: "LIVE" as const, snapshotId: "live-snapshot", gameYear: 16, snapshotEpoch: 6000, rulesVersion: "breed-background-v1", sourceFingerprint: "live", eligibleDogCount: 50, kennelCount: 5 };
const retainedSource = { ...liveSource, mode: "RETAINED_BASELINE" as const, snapshotId: "retained-snapshot" };
const phenotypePayload = {
  head: { count: 50, mean: 8.5, variance: 1.25, meanAbsoluteDeviation: 1.5, min: 6, max: 11, belowCount: 40, exactCount: 0, aboveCount: 10, belowMean: 8, aboveMean: 10.5, belowShare: .8, aboveShare: .2, nearIdealShare: .1 },
  gait: { count: 50, mean: 11.5, variance: 1.25, meanAbsoluteDeviation: 1.5, min: 9, max: 14, belowCount: 10, exactCount: 0, aboveCount: 40, belowMean: 9.5, aboveMean: 12, belowShare: .2, aboveShare: .8, nearIdealShare: .1 },
};
const diversityPayload = {
  payloadVersion: "breed-background-payload-v2", componentBinWidth: .5, overallMeanHomozygosity: .4, fixedLocusCount: 1, nearFixedLocusCount: 2,
  loci: [
    { locus: 0, components: [{ component: "-1.0", share: .5 }, { component: "1.0", share: .5 }], dominantShare: .5, effectiveComponentCount: 2, homozygosity: .2, classification: "DIVERSE" },
    { locus: 1, components: [{ component: "-1.0", share: .95 }, { component: "1.0", share: .05 }], dominantShare: .95, effectiveComponentCount: 1.1, homozygosity: .8, classification: "NEAR_FIXED" },
    { locus: 2, components: [{ component: "-1.0", share: .99 }, { component: "1.0", share: .01 }], dominantShare: .99, effectiveComponentCount: 1.02, homozygosity: .95, classification: "EFFECTIVELY_FIXED" },
  ],
};

const livePhenotype = foundationPopulationContextMapping.mapPhenotypeContext(liveSource, phenotypePayload);
const liveDiversity = foundationPopulationContextMapping.mapGeneticDiversityContext(liveSource, diversityPayload);
assert.equal(livePhenotype.source.mode, "LIVE");
assert.equal(liveDiversity.source.mode, "LIVE");
assert.equal(livePhenotype.traits?.head?.center, 8.5);
assert.equal(livePhenotype.traits?.head?.belowShare, .8);
assert.equal(livePhenotype.traits?.gait?.center, 11.5);
assert.equal(livePhenotype.traits?.gait?.aboveShare, .8);
assert.equal(liveDiversity.loci?.length, 3);
assert.deepEqual(liveDiversity.loci?.map(locus => locus.classification), ["DIVERSE", "NEAR_FIXED", "EFFECTIVELY_FIXED"]);
assert.equal((livePhenotype as unknown as { loci?: unknown }).loci, undefined, "phenotype context does not carry diversity loci");
assert.equal((liveDiversity as unknown as { traits?: unknown }).traits, undefined, "diversity context does not carry phenotype traits");

const retainedPhenotype = foundationPopulationContextMapping.mapPhenotypeContext(retainedSource, phenotypePayload);
const retainedDiversity = foundationPopulationContextMapping.mapGeneticDiversityContext(retainedSource, diversityPayload);
assert.equal(retainedPhenotype.source.mode, "RETAINED_BASELINE");
assert.equal(retainedDiversity.source.mode, "RETAINED_BASELINE");
assert.equal(retainedPhenotype.traits?.head?.center, 8.5);
assert.equal(retainedDiversity.loci?.[1]?.classification, "NEAR_FIXED");

const reset = foundationPopulationContextMapping.mapPhenotypeContext({ mode: "RESET_FALLBACK", snapshotId: null, gameYear: null, snapshotEpoch: null, rulesVersion: null, sourceFingerprint: null, eligibleDogCount: 0, kennelCount: 0 }, null);
assert.equal(reset.source.mode, "RESET_FALLBACK");
assert.equal(reset.traits, null);
const resetContext = createResetFoundationPopulationContext();
assert.equal(resetContext.phenotypeContext.source.mode, "RESET_FALLBACK");
assert.equal(resetContext.phenotypeContext.traits, null);
assert.equal(resetContext.geneticDiversityContext.source.mode, "RESET_FALLBACK");
assert.equal(resetContext.geneticDiversityContext.loci, null);
console.log("GEN-09B foundation context contract tests passed");
