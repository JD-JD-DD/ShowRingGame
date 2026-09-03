import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd().endsWith(join("apps", "web")) ? resolve(process.cwd(), "..", "..") : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const page = source("apps/web/app/test/dog-profile-design/page.tsx");
const fixture = source("apps/web/app/test/dog-profile-design/fixture.ts");

assert.match(page, /href="\/breed-art"/, "missing-art state uses the established Breed Art route");
assert.match(page, /TraitLine/, "prototype reuses the established trait slider component");
assert.match(page, /precision=\{3\}/, "prototype preserves three-decimal visible-category presentation");
assert.doesNotMatch(page, /@\/lib\/db|@\/server\/services|fetch\(/, "prototype has no database, service, or API dependency");
assert.doesNotMatch(fixture, /genotype|geneticsVersion|traitHead|traitForequarters|traitHindquarters|traitGait|traitCoat|traitSize|traitTemperament|traitShowShine|traitFeet|traitTopline/, "fixture contains no hidden Dog trait fields");
assert.match(fixture, /Demo's Ringbright Aster/, "prototype carries forward the guide dog's player-facing identity");

console.log("Dog Profile design prototype checks passed.");
