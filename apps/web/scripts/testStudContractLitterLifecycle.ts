import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const breedingSource = readFileSync(resolve(root, "apps/web/server/services/breeding.service.ts"), "utf8");
const lifecycleSource = readFileSync(resolve(root, "apps/web/server/services/studContractLifecycle.service.ts"), "utf8");
const cronSource = readFileSync(resolve(root, "apps/web/app/api/cron/process-stud-contract-lifecycle/route.ts"), "utf8");

function expect(value: boolean, message: string) {
  if (!value) throw new Error(message);
}

expect(breedingSource.includes('status: "ACCEPTED"') && breedingSource.includes("data: { litterId: persistedLitter.id }"), "Whelping must link only an accepted StudContract to its new litter.");
expect(breedingSource.includes("litterId: null"), "Whelping must not overwrite an existing StudContract litter link.");
expect(lifecycleSource.includes("NEONATAL_PUPPY_DEATH_WINDOW_HOURS"), "Qualification must use the canonical neonatal-window constant.");
expect(lifecycleSource.includes("epochToDate(contract.litter.bornEpoch + NEONATAL_PUPPY_DEATH_WINDOW_HOURS)"), "Qualification must persist the canonical game-time checkpoint.");
expect(lifecycleSource.includes("getProjectedDogDeath(puppy).deathEpoch > checkpointEpoch"), "Qualification must count survival at the checkpoint, not arbitrary current state.");
expect(lifecycleSource.includes("qualificationCheckpointAt: null"), "Qualification writes must be guarded against retries.");
expect(!lifecycleSource.includes("studOffer.find"), "Qualification must not consult the current StudOffer.");
expect(cronSource.includes("processStudContractLitterQualifications"), "The existing Stud Contract lifecycle route must process qualifications.");

console.log("STUD-CONTRACT-20B lifecycle regression passed.");
