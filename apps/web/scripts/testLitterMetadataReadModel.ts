import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import { getLitterDisplayName } from "../lib/litterDisplayName";

const litterService = readFileSync("server/services/litter.service.ts", "utf8");
const mapper = readFileSync("server/mappers/litter.mapper.ts", "utf8");
const listRoute = readFileSync("app/api/litters/route.ts", "utf8");
const pageRoute = readFileSync("app/api/litters/page/route.ts", "utf8");
const detailRoute = readFileSync("app/api/litters/[litterId]/route.ts", "utf8");
const litterPage = readFileSync("app/litters/[litterId]/page.tsx", "utf8");
const littersPage = readFileSync("app/litters/page.tsx", "utf8");
const puppyCards = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const puppyCard = readFileSync("components/litters/LitterPuppyCard.tsx", "utf8");

const listSelect = litterService.slice(
  litterService.indexOf("const litterListSelect"),
  litterService.indexOf("const litterDetailSelect")
);
const detailSelect = litterService.slice(
  litterService.indexOf("const litterDetailSelect"),
  litterService.indexOf("type LitterDetailForMapping")
);
const listDto = mapper.slice(
  mapper.indexOf("export type LitterListItemDto"),
  mapper.indexOf("export type LitterDetailDto")
);
const detailDto = mapper.slice(
  mapper.indexOf("export type LitterDetailDto"),
  mapper.indexOf("function mapParent")
);

assert.match(listSelect, /customName: true/, "list select includes the public custom name");
assert.doesNotMatch(listSelect, /breederNote/, "list select excludes private breeder notes");
assert.match(detailSelect, /\.\.\.litterListSelect/, "detail select inherits the custom name from the list select");
assert.match(detailSelect, /breederNote: true/, "detail select includes the private breeder note");
assert.match(listDto, /customName: string \| null/, "list DTO exposes customName");
assert.doesNotMatch(listDto, /breederNote/, "list DTO excludes breederNote");
assert.match(detailDto, /breederNote: string \| null/, "detail DTO exposes breederNote");
assert.match(mapper, /customName: litter\.customName/, "customName maps through the list mapper");
assert.match(mapper, /breederNote: litter\.breederNote/, "breederNote maps only through the detail mapper");
for (const source of [listRoute, pageRoute]) {
  assert.doesNotMatch(source, /breederNote/, "general litter APIs do not expose breeder notes");
}
for (const source of [puppyCards, puppyCard]) {
  assert.doesNotMatch(source, /breederNote/, "puppy cards do not receive breeder notes");
}
assert.match(littersPage, /customName: true/, "stud-contract selection data is ready for the future label");
assert.doesNotMatch(littersPage, /breederNote/, "stud-contract selection excludes breeder notes");

assert.equal(getLitterDisplayName("C Litter", "6258828"), "C Litter", "named litter uses its custom name");
assert.equal(getLitterDisplayName(null, "6258828"), "Serial 6258828", "unnamed litter uses its serial label");
assert.equal(getLitterDisplayName("C litter!", "6258828"), "C litter!", "helper preserves capitalization and punctuation");
assert.equal(getLitterDisplayName("", "6258828"), "Serial 6258828", "blank name falls back to serial");

assert.match(detailRoute, /litterId/, "detail route remains parameterized by immutable litter id");
assert.match(litterPage, /getLitterForKennel/, "litter record remains on the breeder-scoped id lookup");
assert.doesNotMatch(litterPage, /customName/, "litter record presentation is unchanged in this read-model stage");

console.log("Litter metadata read-model checks passed.");
