import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const breeding = source("apps/web/server/services/breeding.service.ts");
const constants = source("packages/rules/constants/lifecycle.constants.ts");
for (const forbidden of ["WHELPING_DAM" + "_DEATH_RATE", "whelp:dam-" + "mortality", "damDied" + "AtWhelp"]) {
  assert.equal(breeding.includes(forbidden) || constants.includes(forbidden), false, `${forbidden} must be retired`);
}
assert.ok(breeding.includes("shouldTriggerReproductiveEmergency({"));
console.log("Legacy fatal-whelp mechanic retirement checks passed.");
