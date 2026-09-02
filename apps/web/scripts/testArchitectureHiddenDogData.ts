import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd().endsWith(join("apps", "web")) ? resolve(process.cwd(), "..", "..") : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const mineRoute = source("apps/web/app/api/dogs/mine/route.ts");
const mapper = source("apps/web/server/mappers/dog.mapper.ts");
const market = source("apps/web/server/services/market.service.ts");
const hiddenFields = ["genotype", "geneticsVersion", "traitHead", "traitForequarters", "traitHindquarters", "traitGait", "traitCoat", "traitSize", "traitTemperament", "traitShowShine", "traitFeet", "traitTopline"];

const rosterDtoStart = mineRoute.indexOf("const payload = await perf.measure(\"dtoMappingMs\"");
const rosterDtoEnd = mineRoute.indexOf("const payloadSizeBytes", rosterDtoStart);
assert.ok(rosterDtoStart >= 0 && rosterDtoEnd > rosterDtoStart, "owned roster has an explicit DTO mapping boundary");
const rosterDto = mineRoute.slice(rosterDtoStart, rosterDtoEnd);
for (const field of hiddenFields) assert.doesNotMatch(rosterDto, new RegExp(`\\b${field}\\s*:`), `owned roster DTO does not serialize ${field}`);
assert.match(rosterDto, /visibleCategories: toVisibleCategories\(/, "owned roster exposes intended derived visible categories");
assert.doesNotMatch(mapper, /\bgenotype\b|\bgeneticsVersion\b|\btraitHead\b/, "Dog profile mapper does not expose raw genetic or trait fields");
const marketMapperStart = market.indexOf("function mapMarketListing");
const marketMapperEnd = market.indexOf("export async function listMarketDogs", marketMapperStart);
assert.ok(marketMapperStart >= 0 && marketMapperEnd > marketMapperStart, "market has a dedicated player DTO mapper");
const marketMapper = market.slice(marketMapperStart, marketMapperEnd);
for (const field of hiddenFields) assert.doesNotMatch(marketMapper, new RegExp(`\\b${field}\\s*:`), `market DTO does not serialize ${field}`);
assert.match(marketMapper, /visibleCategories:/, "market DTO retains derived visible categories");

console.log("ARCH-GUARD-006 hidden Dog data checks passed.");
