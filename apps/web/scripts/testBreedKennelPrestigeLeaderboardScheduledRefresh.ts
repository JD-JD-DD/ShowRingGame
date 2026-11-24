import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createProcessBreedKennelPrestigeLeaderboardCronHandler } from "../app/api/cron/process-breed-kennel-prestige-leaderboard/route";
import { createBreedKennelPrestigeLeaderboardCronRunner } from "../server/services/breedKennelPrestigeLeaderboardOrchestration.service";

const root = process.cwd();
const routeSource = readFileSync(resolve(root, "app/api/cron/process-breed-kennel-prestige-leaderboard/route.ts"), "utf8");
const vercelConfig = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as { crons: Array<{ path: string; schedule: string }> };

async function withCronSecret(action: () => Promise<void>) {
  const priorSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "breed-cron-test-secret";
  try { await action(); } finally {
    if (priorSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = priorSecret;
  }
}

async function main() {
  const calls: string[] = [];
  const runner = createBreedKennelPrestigeLeaderboardCronRunner({
    orchestrate: async (operation) => {
      calls.push(operation);
      return operation === "process"
        ? { operation, outcome: "generation_calculation_complete", generationId: "generation-1", completed: 1, remaining: 0, publicationOutcome: "not_attempted", durationMs: 1, workerOutcome: "generation_calculation_complete", batchDurationMs: 1 }
        : { operation, outcome: "published", generationId: "generation-1", completed: 1, remaining: 0, publicationOutcome: "published", durationMs: 1 };
    },
    getPublishedState: async () => ({ nextRefreshAt: new Date("2026-12-01T07:00:00.000Z") }) as never,
  });
  const completed = await runner();
  assert.deepEqual(calls, ["process", "publish"], "one bounded process is followed by explicit publication only after completion");
  assert.equal(completed.outcome, "published");
  assert.equal(completed.nextRefreshAt, "2026-12-01T07:00:00.000Z");

  const notDueCalls: string[] = [];
  const notDueRunner = createBreedKennelPrestigeLeaderboardCronRunner({
    orchestrate: async (operation) => {
      notDueCalls.push(operation);
      return { operation, outcome: "not_due", generationId: null, completed: 0, remaining: 0, publicationOutcome: "not_attempted", durationMs: 1, workerOutcome: "not_due", batchDurationMs: 1 };
    },
    getPublishedState: async () => ({ nextRefreshAt: new Date("2026-12-01T07:00:00.000Z") }) as never,
  });
  const notDue = await notDueRunner();
  assert.equal(notDue.outcome, "not_due");
  assert.equal(notDue.nextRefreshAt, "2026-12-01T07:00:00.000Z");
  assert.deepEqual(notDueCalls, ["process"], "seven-hour gate does not start or publish a new generation");

  let routeCalls = 0;
  const handler = createProcessBreedKennelPrestigeLeaderboardCronHandler({
    runCron: async () => { routeCalls += 1; return { outcome: "batch_processed", generationId: "generation-1", processing: {} as never, publication: null, nextRefreshAt: null, durationMs: 1 }; },
  });
  await withCronSecret(async () => {
    const unauthorized = await handler(new Request("http://localhost/api/cron/process-breed-kennel-prestige-leaderboard"));
    assert.equal(unauthorized.status, 401);
    assert.equal(routeCalls, 0, "unauthorized cron requests never invoke services");
    const authorized = await handler(new Request("http://localhost/api/cron/process-breed-kennel-prestige-leaderboard", { headers: { Authorization: "Bearer breed-cron-test-secret" } }));
    assert.equal(authorized.status, 200);
    assert.equal(routeCalls, 1);
  });

  assert.match(routeSource, /export const maxDuration = 300/);
  assert.match(routeSource, /request\.headers\.get\("Authorization"\) !== `Bearer \$\{cronSecret\}`/);
  assert.equal(vercelConfig.crons.find((cron) => cron.path === "/api/cron/process-breed-kennel-prestige-leaderboard")?.schedule, "* * * * *");
  console.log("Breed kennel prestige leaderboard scheduled refresh checks passed.");
}

void main();
