import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd().endsWith(join("apps", "web")) ? resolve(process.cwd(), "..", "..") : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const page = source("apps/web/app/test/dog-profile-design/page.tsx");
const fixture = source("apps/web/app/test/dog-profile-design/fixture.ts");

assert.match(page, /href="\/breed-art"/, "missing-art state uses the established Breed Art route");
assert.match(page, /Dog Profile Preview/, "prototype uses player-facing preview copy");
assert.match(page, /Upcoming Dog Profile/, "prototype identifies the upcoming player experience");
assert.match(page, /Buttons and statuses on this page are examples only and do not affect the game\./, "prototype explains that its controls are non-gameplay examples");
assert.match(page, /View Without Breed Art/, "prototype uses player-facing missing-art preview copy");
assert.match(page, /Preview Emergency State/, "prototype uses player-facing emergency-preview copy");
assert.match(page, /TraitLine/, "prototype reuses the established trait slider component");
assert.match(page, /precision=\{3\}/, "prototype preserves three-decimal visible-category presentation");
assert.match(page, /PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES/, "prototype reuses the established health result text-class mapping");
assert.match(page, /valueClassName: PHENOTYPE_HEALTH_SEVERITY_TEXT_CLASSES\[severity\]/, "only prototype Health result values receive the established severity class");
assert.match(page, /className=\{`text-sm font-semibold \$\{row\.valueClassName \?\? "theme-heading"\}`\}/, "health result values use their semantic class instead of the neutral theme-heading class");
assert.doesNotMatch(page, /@\/lib\/db|@\/server\/services|fetch\(/, "prototype has no database, service, or API dependency");
assert.match(page, /Manage Dog/, "prototype includes the local Manage Dog control");
assert.match(page, /aria-expanded=\{manageDogOpen\}/, "Manage Dog exposes expanded state");
assert.match(page, /Emergency veterinary care required/, "prototype keeps urgent care visible outside Manage Dog");
assert.match(page, /Not currently eligible — reproductive recovery is still active\./, "prototype explains unavailable breeding in plain English");
assert.doesNotMatch(fixture, /genotype|geneticsVersion|traitHead|traitForequarters|traitHindquarters|traitGait|traitCoat|traitSize|traitTemperament|traitShowShine|traitFeet|traitTopline/, "fixture contains no hidden Dog trait fields");
assert.match(fixture, /Demo's Ringbright Aster/, "prototype carries forward the guide dog's player-facing identity");

console.log("Dog Profile design prototype checks passed.");
