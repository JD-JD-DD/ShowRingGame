import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const assertExcludes = (value: string, needle: string, label: string) =>
  assert.ok(!value.includes(needle), label);
const assertIncludes = (value: string, needle: string, label: string) =>
  assert.ok(value.includes(needle), label);

const mortalityCron = source("apps/web/app/api/cron/resolve-dog-mortality/route.ts");
const lifecycle = source("apps/web/server/services/lifecycle.service.ts");

assertIncludes(mortalityCron, "resolveDogDeaths({ currentEpoch })", "scheduled job owns global mortality resolution");
assertIncludes(lifecycle, 'cause: "NEONATAL_PUPPY"', "canonical resolver retains neonatal handling");
assertIncludes(lifecycle, 'cause: "ACCIDENT_ILLNESS"', "canonical resolver retains accident/illness handling");
assertIncludes(lifecycle, 'cause: "AGE"', "canonical resolver retains age handling");
assertIncludes(lifecycle, "if (update.count === 0)", "canonical resolver remains retry-idempotent");

for (const path of [
  "apps/web/server/services/dog.service.ts",
  "apps/web/server/services/litter.service.ts",
  "apps/web/server/services/breeding.service.ts",
  "apps/web/server/services/market.service.ts",
  "apps/web/server/services/showEntry.service.ts",
  "apps/web/server/services/judging.service.ts",
  "apps/web/components/breeding/BreedingPlannerPage.tsx",
  "apps/web/app/studs/page.tsx",
  "apps/web/app/memorium/page.tsx",
  "apps/web/app/kennels/[slug]/page.tsx",
  "apps/web/app/api/kennel/program-planner/route.ts",
]) {
  assertExcludes(source(path), "resolveDogDeaths(", `${path} has no lazy mortality resolution`);
}

console.log("Scheduled mortality ownership checks passed.");
