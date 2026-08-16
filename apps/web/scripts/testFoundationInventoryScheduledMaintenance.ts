import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { GET } from "../app/api/cron/maintain-foundation-inventory/route";

const routeSource = readFileSync(
  resolve(process.cwd(), "app/api/cron/maintain-foundation-inventory/route.ts"),
  "utf8"
);
const vercelConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")
) as { crons: Array<{ path: string; schedule: string }> };

async function main() {
  const priorSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "foundation-cron-test-secret";
  const unauthorized = await GET(
    new Request("http://localhost/api/cron/maintain-foundation-inventory")
  );
  assert.equal(unauthorized.status, 401, "scheduled maintenance rejects unauthenticated callers");
  if (priorSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = priorSecret;

  assert.match(routeSource, /getCurrentEpoch\(\)/, "route uses canonical game epoch");
  assert.match(routeSource, /getReleasedBreedCodes\(\)/, "route uses canonical released active breed eligibility");
  assert.match(routeSource, /ensureFoundationInventoryForBreed\(\{ breedCode2, currentEpoch \}\)/, "route delegates every breed to canonical maintenance");
  assert.match(routeSource, /for \(const breedCode2 of breedCode2List\)/, "breed execution is sequential and bounded");
  assert.match(routeSource, /foundation-inventory-scheduled-maintenance-failed/, "per-breed failures are logged and isolated");
  assert.doesNotMatch(routeSource, /\bdb\.|createOneFoundationDog|expireStaleFoundationListings|cleanupExpiredDisposableFoundationInventory|pg_advisory|femalesNeeded|malesNeeded/, "route contains orchestration only");

  const foundationCrons = vercelConfig.crons.filter(
    (cron) => cron.path === "/api/cron/maintain-foundation-inventory"
  );
  assert.deepEqual(foundationCrons, [{ path: "/api/cron/maintain-foundation-inventory", schedule: "43 */6 * * *" }], "one staggered six-hour foundation cron is configured");
  assert.ok(vercelConfig.crons.some((cron) => cron.path === "/api/cron/resolve-dog-mortality" && cron.schedule === "* * * * *"), "existing mortality schedule remains unchanged");
  assert.ok(vercelConfig.crons.some((cron) => cron.path === "/api/jobs/process-emergency-vet-care" && cron.schedule === "17 * * * *"), "existing emergency schedule remains unchanged");
  console.log("Foundation inventory scheduled maintenance checks passed.");
}

void main();
