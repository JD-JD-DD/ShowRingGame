import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const breedingSource = readFileSync(resolve(root, "apps/web/server/services/breeding.service.ts"), "utf8");
const lifecycleSource = readFileSync(resolve(root, "apps/web/server/services/studContractLifecycle.service.ts"), "utf8");
const cronSource = readFileSync(resolve(root, "apps/web/app/api/cron/process-stud-contract-lifecycle/route.ts"), "utf8");

function expect(value: boolean, message: string) {
  if (!value) throw new Error(message);
}

expect(breedingSource.includes('status: "ACCEPTED"') && breedingSource.includes("litterId: persistedLitter.id") && breedingSource.includes("const whelpQualificationAt = new Date()") && breedingSource.includes("whelpQualificationAt,"), "Whelping must link and qualify only an accepted StudContract at litter creation.");
expect(breedingSource.includes("litterId: null"), "Whelping must not overwrite an existing StudContract litter link.");
expect(breedingSource.includes("persistedLitter.puppies.length"), "Live-born count must come from puppies created in the whelping transaction.");
expect(breedingSource.includes("puppyBackMinimumMet") && breedingSource.includes("smallLitterReturnServiceMet"), "Both frozen whelp-time results must be persisted.");
expect(breedingSource.includes("openInitialStudContractPuppySelection"), "Qualifying Puppy Back selection must open in the whelping transaction.");
expect(breedingSource.includes("bornEpoch: outcome.litter.bornEpoch"), "Whelp-time opening must use canonical litter birth timing.");
expect(!breedingSource.includes("PUPPY_SELECTION_TURN_MS"), "Whelping must not calculate a rolling selection deadline.");
expect(!lifecycleSource.includes("processStudContractLitterQualifications"), "No Day-8 contract qualification pass may remain.");
expect(!cronSource.includes("processStudContractLitterQualifications"), "Cron must not run Day-8 contract qualification.");

console.log("STUD-CONTRACT-20B lifecycle regression passed.");
