import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { dueBreedGeneticBackgroundSnapshots } from "../server/services/breedGeneticBackgroundProgression.service";
import { GET } from "../app/api/cron/maintain-breed-genetic-background/route";

const root = process.cwd();
const routeSource = readFileSync(
  resolve(root, "app/api/cron/maintain-breed-genetic-background/route.ts"),
  "utf8"
);
const progressionSource = readFileSync(
  resolve(root, "server/services/breedGeneticBackgroundProgression.service.ts"),
  "utf8"
);
const vercelConfig = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
  crons: Array<{ path: string; schedule: string }>;
};

async function main() {
  assert.deepEqual(
    dueBreedGeneticBackgroundSnapshots(
      [
        { year: 5, endEpoch: 1_825 },
        { year: 4, endEpoch: 1_460 },
        { year: 5, endEpoch: 1_825 },
        { year: 6, endEpoch: 2_190 },
      ],
      2_000
    ),
    [
      { year: 4, endEpoch: 1_460 },
      { year: 5, endEpoch: 1_825 },
    ],
    "only completed Invitational years at or before the current game epoch are due once"
  );
  assert.deepEqual(
    dueBreedGeneticBackgroundSnapshots([{ year: 6, endEpoch: 2_190 }], 2_000),
    [],
    "future or incomplete annual boundaries do no work"
  );

  const priorSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "breed-background-cron-test-secret";
  const unauthorized = await GET(
    new Request("http://localhost/api/cron/maintain-breed-genetic-background")
  );
  assert.equal(unauthorized.status, 401, "scheduled progression rejects unauthenticated callers");
  if (priorSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = priorSecret;

  assert.match(routeSource, /getCurrentEpoch\(\)/, "route uses canonical game time");
  assert.match(routeSource, /maintainDueBreedGeneticBackgroundSnapshots/, "route delegates to the progression service");
  assert.match(progressionSource, /status: "COMPLETE"/, "only finalized Invitational clusters are candidates");
  assert.match(progressionSource, /snapshotEpoch: invitational\.endEpoch/, "the durable Invitational boundary supplies the snapshot epoch");
  assert.match(progressionSource, /existingSnapshot: "SKIP"/, "retry delivery preserves completed annual snapshot truth");
  assert.match(progressionSource, /createBreedGeneticBackgroundSnapshots/, "scheduled and manual execution share the canonical snapshot service");
  assert.doesNotMatch(progressionSource, /showCluster\.update|showDay\.update/, "snapshot failure cannot mutate Invitational history");
  assert.deepEqual(
    vercelConfig.crons.filter((cron) => cron.path === "/api/cron/maintain-breed-genetic-background"),
    [{ path: "/api/cron/maintain-breed-genetic-background", schedule: "29 */6 * * *" }],
    "one staggered periodic cron triggers game-time-aware maintenance"
  );
  assert.ok(
    vercelConfig.crons.some(
      (cron) =>
        cron.path === "/api/cron/finalize-show-results" &&
        cron.schedule === "*/2 * * * *"
    ),
    "existing Invitational finalization cadence remains unchanged"
  );
  console.log("Breed genetic background scheduled progression checks passed.");
}

void main();
