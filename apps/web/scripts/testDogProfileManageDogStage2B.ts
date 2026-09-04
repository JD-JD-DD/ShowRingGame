import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd().endsWith(join("apps", "web")) ? resolve(process.cwd(), "..", "..") : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const page = source("apps/web/app/dogs/[dogId]/page.tsx");
const panel = source("apps/web/components/dogs/ManageDogPanel.tsx");
const health = source("apps/web/components/dogs/DogProfileHealthActions.tsx");
const grooming = source("apps/web/components/dogs/DogProfileGroomingManagement.tsx");
const shows = source("apps/web/components/dogs/DogProfileShowsManagement.tsx");
const planning = source("apps/web/components/dogs/DogProfilePrivatePlanning.tsx");

assert.doesNotMatch(page, /DogProfileDashboard/, "production profile no longer renders the compatibility dashboard");
assert.match(panel, /Identity[\s\S]*Kennel[\s\S]*Breeding[\s\S]*Grooming[\s\S]*Shows[\s\S]*Stud[\s\S]*Market/, "Manage Dog groups remain exact");
assert.doesNotMatch(panel, /Private|Health/, "Manage Dog has no Private or Health group");
assert.match(health, /HealthTestingPanel/, "Health retains the real health testing component");
assert.match(health, /brucellosis-screening/, "Health retains the brucellosis route");
assert.match(grooming, /Manage Grooming/, "Grooming has its approved management entry point");
assert.match(grooming, /self-groom[\s\S]*Offer for Outside Grooming/, "Grooming retains real operations");
assert.match(shows, /currentEntriesCount[\s\S]*Pull entry/, "Shows retains current entries and Pull Entry");
assert.match(page, /EmergencyVetCarePanel[\s\S]*ReproductiveEmergencyPanel[\s\S]*DogProfileReadSections/, "urgent panels remain outside Manage Dog before read sections");
assert.match(planning, /Private Kennel Notes[\s\S]*DogPrivateNotesEditor/, "private planning retains notes under its final section");
assert.match(page, /canManage=\{viewerContext\.canManage && header\.lifecycleState === "ALIVE"\}/, "deceased dogs cannot order health actions");
assert.match(page, /actions\.canBuyActiveListing && saleListing/, "Buy Dog remains conditional");
assert.match(page, /actions\.canUseActiveStudListing && studListing/, "Use at Stud remains conditional");

console.log("Dog Profile Manage Dog Stage 2B checks passed.");
