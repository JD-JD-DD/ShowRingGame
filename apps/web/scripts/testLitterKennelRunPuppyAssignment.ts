import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ordinary = readFileSync("server/services/breeding.service.ts", "utf8");
const emergency = readFileSync(
  "server/services/reproductiveEmergencyResolution.service.ts",
  "utf8"
);

assert.match(
  ordinary,
  /const litterRun =[\s\S]*?ensureLitterKennelRun[\s\S]*?kennelRunId: litterRun\?\.id \?\? null/,
  "ordinary puppies receive the transaction's litter run"
);
assert.match(
  emergency,
  /const litterRun =[\s\S]*?ensureLitterKennelRun[\s\S]*?kennelRunId: litterRun\?\.id \?\? null/,
  "emergency survivor puppies receive the transaction's litter run"
);
assert.doesNotMatch(
  ordinary,
  /fresh\.dam\.kennelRunId/,
  "ordinary newborns no longer inherit the dam's run"
);
assert.doesNotMatch(
  emergency,
  /attempt\.dam\.kennelRunId/,
  "emergency newborns no longer inherit the dam's run"
);
assert.doesNotMatch(
  ordinary,
  /ensureUncategorizedKennelRun/,
  "ordinary newborns do not fall back to Uncategorized"
);
assert.doesNotMatch(
  emergency,
  /ensureUncategorizedKennelRun/,
  "emergency newborns do not fall back to Uncategorized"
);
assert.match(
  ordinary,
  /persistedLitter\.puppies\.map\(\(puppy\) => \(\{[\s\S]*?kennelRunId: litterRun\?\.id \?\? null/,
  "every persisted ordinary puppy receives the litter run before neonatal processing"
);
assert.match(
  emergency,
  /persistedLitter\.puppies\.map\(\(puppy\) => \(\{[\s\S]*?kennelRunId: litterRun\?\.id \?\? null/,
  "every persisted emergency survivor receives the litter run"
);

console.log("Litter Kennel Run puppy-assignment checks passed.");
