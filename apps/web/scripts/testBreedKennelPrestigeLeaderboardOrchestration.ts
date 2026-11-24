import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createProcessBreedKennelPrestigeLeaderboardHandler } from "../app/api/jobs/process-breed-kennel-prestige-leaderboard/route";
import { createBreedKennelPrestigeLeaderboardOrchestrator } from "../server/services/breedKennelPrestigeLeaderboardOrchestration.service";

const root = process.cwd();
const routeSource = readFileSync(resolve(root, "app/api/jobs/process-breed-kennel-prestige-leaderboard/route.ts"), "utf8");
const vercelConfig = readFileSync(resolve(root, "vercel.json"), "utf8");
const completeGeneration = { id: "generation-complete", manifestBreeds: [{ breedCode2: "AA", completedAt: new Date() }] } as never;
const incompleteGeneration = { id: "generation-incomplete", manifestBreeds: [{ breedCode2: "AA", completedAt: null }] } as never;

async function withSecrets(action: () => Promise<void>) {
  const priorCron = process.env.CRON_SECRET;
  const priorManual = process.env.SHOWRING_JOBS_SECRET;
  process.env.CRON_SECRET = "breed-cron-secret";
  process.env.SHOWRING_JOBS_SECRET = "breed-manual-secret";
  try { await action(); } finally {
    if (priorCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = priorCron;
    if (priorManual === undefined) delete process.env.SHOWRING_JOBS_SECRET; else process.env.SHOWRING_JOBS_SECRET = priorManual;
  }
}

async function main() {
  let workerCalls = 0;
  let publishCalls = 0;
  const process = createBreedKennelPrestigeLeaderboardOrchestrator({
    processBatch: async () => { workerCalls += 1; return { outcome: "batch_processed", initialized: false, generationId: "generation-complete", attempted: 1, completed: 1, remaining: 4, conflicts: 0, failures: 0 }; },
    getWorkingGeneration: async () => completeGeneration,
    getPublishedState: async () => null,
    publishGeneration: async () => { publishCalls += 1; },
  });
  const processed = await process("process");
  assert.equal(workerCalls, 1);
  assert.equal(publishCalls, 0, "processing never publishes");
  assert.equal(processed.outcome, "generation_calculation_complete", "durable manifest state determines completion");
  assert.equal(processed.remaining, 0, "a completed zero-entry breed is still complete");

  const incomplete = createBreedKennelPrestigeLeaderboardOrchestrator({
    getWorkingGeneration: async () => incompleteGeneration,
    getPublishedState: async () => null,
    publishGeneration: async () => { throw new Error("must not publish incomplete generation"); },
  });
  assert.equal((await incomplete("publish")).outcome, "generation_incomplete");

  const publish = createBreedKennelPrestigeLeaderboardOrchestrator({
    getWorkingGeneration: async () => completeGeneration,
    getPublishedState: async () => null,
    publishGeneration: async (args) => { assert.equal(args.generationId, "generation-complete"); publishCalls += 1; },
  });
  assert.equal((await publish("publish")).outcome, "published");
  assert.equal(publishCalls, 1, "publish targets the verified working generation");

  const superseded = createBreedKennelPrestigeLeaderboardOrchestrator({
    getWorkingGeneration: async () => completeGeneration,
    getPublishedState: async () => null,
    publishGeneration: async () => { throw new Error("Only the active breed leaderboard generation can publish."); },
  });
  assert.equal((await superseded("publish")).outcome, "superseded");

  let routeCalls = 0;
  const handler = createProcessBreedKennelPrestigeLeaderboardHandler({
    orchestrate: async () => { routeCalls += 1; return { operation: "process", outcome: "batch_processed", generationId: "generation", workerOutcome: "batch_processed", completed: 1, remaining: 2, batchDurationMs: 1, publicationOutcome: "not_attempted", durationMs: 1 }; },
  });
  await withSecrets(async () => {
    const unauthorized = await handler(new Request("http://localhost/api/jobs/process-breed-kennel-prestige-leaderboard", { method: "POST", body: JSON.stringify({ action: "process" }) }));
    assert.equal(unauthorized.status, 401);
    const invalid = await handler(new Request("http://localhost/api/jobs/process-breed-kennel-prestige-leaderboard", { method: "POST", headers: { Authorization: "Bearer breed-manual-secret" }, body: JSON.stringify({ action: "all", generationId: "forbidden" }) }));
    assert.equal(invalid.status, 400);
    assert.equal(routeCalls, 0, "unauthorized and invalid requests cannot invoke orchestration");
    const authorized = await handler(new Request("http://localhost/api/jobs/process-breed-kennel-prestige-leaderboard", { method: "POST", headers: { Authorization: "Bearer breed-manual-secret" }, body: JSON.stringify({ action: "process" }) }));
    assert.equal(authorized.status, 200);
    assert.equal(routeCalls, 1);
  });

  assert.match(routeSource, /export const dynamic = "force-dynamic"/);
  assert.match(routeSource, /isAuthorizedJobRequest/);
  assert.doesNotMatch(routeSource, /maxBreeds|generationId|breedCode2/);
  assert.doesNotMatch(vercelConfig, /process-breed-kennel-prestige-leaderboard/);
  console.log("Breed kennel prestige leaderboard orchestration checks passed.");
}

void main();
