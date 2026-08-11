import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const litterService = readFileSync("server/services/litter.service.ts", "utf8");
const litterMapper = readFileSync("server/mappers/litter.mapper.ts", "utf8");

const listSelect = litterService.slice(
  litterService.indexOf("const litterListSelect"),
  litterService.indexOf("const litterDetailSelect")
);
const detailSelect = litterService.slice(
  litterService.indexOf("const litterDetailSelect"),
  litterService.indexOf("type LitterDetailForMapping")
);

assert.match(
  listSelect,
  /visibilityState:\s*\{\s*not: "HIDDEN_NEONATAL_LOSS"[\s\S]*take: 4/,
  "list previews should fetch only the first four visible puppies"
);
assert.doesNotMatch(
  listSelect,
  /traitHead|healthConditionTruths|healthTests/,
  "list previews must exclude hidden traits and health payloads"
);
assert.match(
  listSelect,
  /orderBy: \[\{ litterOrder: "asc" \}, \{ regNumber: "asc" \}\]/,
  "list previews retain deterministic litter and registration ordering"
);
assert.match(
  litterService,
  /db\.dog\.groupBy\([\s\S]*by: \["litterId", "sex", "visibilityState"\]/,
  "one page-level aggregate query calculates puppy summary buckets"
);
assert.match(
  litterService,
  /in: litterIds/,
  "summary aggregation is scoped to the current page of litters"
);
assert.match(
  litterMapper,
  /puppySummary \?\?/, 
  "list mapper consumes aggregate summary buckets without materializing all puppies"
);
assert.match(
  detailSelect,
  /traitHead[\s\S]*healthConditionTruths[\s\S]*healthTests/,
  "litter detail retains its complete puppy payload"
);

console.log("Litter list summary read-model checks passed.");
