import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import { parseLitterArchiveFilters } from "../server/services/litter.service";

const litterService = readFileSync("server/services/litter.service.ts", "utf8");
const listClient = readFileSync(
  "components/litters/LittersListClient.tsx",
  "utf8"
);
const pageRoute = readFileSync("app/api/litters/page/route.ts", "utf8");

assert.deepEqual(parseLitterArchiveFilters(undefined), {
  search: "",
  breedCode2: null,
  gameYear: null,
  sort: "newest",
});
assert.deepEqual(
  parseLitterArchiveFilters({
    search: "  Cedar  ",
    breedCode2: "bc",
    year: "12",
    sort: "oldest",
  }),
  { search: "Cedar", breedCode2: "BC", gameYear: 12, sort: "oldest" }
);
assert.deepEqual(
  parseLitterArchiveFilters({ breedCode2: "bad value", year: "0", sort: "sideways" }),
  { search: "", breedCode2: null, gameYear: null, sort: "newest" }
);

assert.match(litterService, /visibleToKennelWhere\(kennelId\),[\s\S]*searchWhere/);
assert.match(litterService, /serial7: \{ contains: search, mode: "insensitive" \}/);
assert.match(litterService, /sire:[\s\S]*callName:[\s\S]*registeredName:[\s\S]*regNumber/);
assert.match(litterService, /dam:[\s\S]*callName:[\s\S]*registeredName:[\s\S]*regNumber/);
assert.match(litterService, /puppies:[\s\S]*some:[\s\S]*callName:[\s\S]*registeredName:[\s\S]*regNumber/);
assert.match(litterService, /SHOW_YEAR_HOURS/);
assert.match(litterService, /filters\.sort === "newest" \? "desc" : "asc"/);
assert.match(litterService, /filters\.sort === "newest" \? "lt" : "gt"/);
assert.match(litterService, /take: pageSize \+ 1/);
assert.match(litterService, /take: 4/);
assert.match(litterService, /db\.dog\.groupBy/);

assert.match(pageRoute, /parseLitterArchiveFilters/);
assert.match(listClient, /filters: props\.filters/);
assert.match(listClient, /Search litters/);
assert.match(listClient, /Clear filters/);
assert.match(listClient, /No litters match these filters/);
assert.match(listClient, /router\.push\(/);
assert.match(listClient, /focus-visible:outline/);

console.log("Litter large-program management checks passed.");
