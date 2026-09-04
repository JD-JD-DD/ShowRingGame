import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd().endsWith(join("apps", "web"))
  ? resolve(process.cwd(), "..", "..")
  : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

const page = source("apps/web/app/dogs/[dogId]/page.tsx");
const panel = source("apps/web/components/dogs/ManageDogPanel.tsx");

assert.match(panel, /aria-expanded=\{isOpen\}/, "Manage Dog exposes expanded state");
assert.match(panel, /aria-controls=\{panelId\}/, "Manage Dog controls its panel");
assert.match(panel, /Identity[\s\S]*Kennel[\s\S]*Breeding[\s\S]*Grooming[\s\S]*Shows[\s\S]*Stud[\s\S]*Market/, "Manage Dog has the approved groups in order");
assert.doesNotMatch(panel, /Private/, "Manage Dog has no Private group");
assert.match(page, /viewerContext\.isOwnedByCurrentKennel &&\s*header\.lifecycleState === "ALIVE"[\s\S]*<ManageDogPanel/, "Manage Dog is owner/live only");
assert.match(page, /<ManageDogPanel[\s\S]*callName=\{<CallNameEditor[\s\S]*registerName=\{actions\.canName \? <RegisterDogNameForm/, "Identity owns the naming controls");
assert.match(page, /moveRun=\{<DogProfileKennelRunMove[\s\S]*rehome=\{actions\.canRehome[\s\S]*<RehomeDogForm/, "Kennel owns Run movement and rehome");
assert.match(page, /breed=\{<BreedDogActionButton[\s\S]*breedingParticipation=\{viewerContext\.canManage \? <BreedingActiveControl/, "Breeding owns participation and Breed actions");
assert.match(page, /stud=\{[\s\S]*Stud Worksheet/, "Stud owns the worksheet destination");
assert.match(page, /market=\{[\s\S]*<OfferDogForSaleForm[\s\S]*<ManageDogListingForm/, "Market owns listing controls");
assert.match(page, /grooming=\{[\s\S]*DogProfileGroomingManagement/, "Grooming retains its final component placement");
assert.match(page, /shows=\{[\s\S]*DogProfileShowsManagement/, "Shows retains its final component placement");
for (const control of [
  "<CallNameEditor",
  "<RegisterDogNameForm",
  "<DogProfileKennelRunMove",
  "<RehomeDogForm",
  "<BreedingActiveControl",
  "<BreedDogActionButton",
  "<OfferDogForSaleForm",
  "<ManageDogListingForm",
]) {
  assert.equal(
    page.split(control).length - 1,
    1,
    `${control} has one final production placement`
  );
}

console.log("Dog Profile Manage Dog Stage 2A checks passed.");
