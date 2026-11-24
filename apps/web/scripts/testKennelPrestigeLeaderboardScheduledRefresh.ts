import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createRefreshKennelPrestigeLeaderboardCronHandler,
  GET,
} from "../app/api/cron/refresh-kennel-prestige-leaderboard/route";
import type { OverallKennelPrestigeLeaderboardRefreshResult } from "../server/services/kennelPrestigeLeaderboard.service";

const root = process.cwd();
const routeSource = readFileSync(
  resolve(root, "app/api/cron/refresh-kennel-prestige-leaderboard/route.ts"),
  "utf8"
);
const vercelConfig = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
  crons: Array<{ path: string; schedule: string }>;
};

async function withCronSecret(action: () => Promise<void>) {
  const priorSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "kennel-prestige-cron-test-secret";
  try {
    await action();
  } finally {
    if (priorSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = priorSecret;
  }
}

async function main() {
  let calls = 0;
  const unauthorizedHandler = createRefreshKennelPrestigeLeaderboardCronHandler({
    refreshDue: async () => {
      calls += 1;
      return { outcome: "published" };
    },
  });
  await withCronSecret(async () => {
    const missingAuthorization = await unauthorizedHandler(
      new Request("http://localhost/api/cron/refresh-kennel-prestige-leaderboard")
    );
    const wrongAuthorization = await unauthorizedHandler(
      new Request("http://localhost/api/cron/refresh-kennel-prestige-leaderboard", {
        headers: { Authorization: "Bearer incorrect" },
      })
    );
    assert.equal(missingAuthorization.status, 401);
    assert.equal(wrongAuthorization.status, 401);
    assert.equal(calls, 0, "unauthorized cron requests never invoke the refresh service");

    const outcomes: Array<{
      result: OverallKennelPrestigeLeaderboardRefreshResult;
      status: number;
      ok: boolean;
      published: boolean;
    }> = [
      { result: { outcome: "published" }, status: 200, ok: true, published: true },
      { result: { outcome: "not_due" }, status: 200, ok: true, published: false },
      { result: { outcome: "running" }, status: 200, ok: true, published: false },
      { result: { outcome: "claim_lost" }, status: 200, ok: true, published: false },
      { result: { outcome: "failed" }, status: 500, ok: false, published: false },
    ];

    for (const expected of outcomes) {
      const handler = createRefreshKennelPrestigeLeaderboardCronHandler({
        refreshDue: async () => expected.result,
      });
      const response = await handler(
        new Request("http://localhost/api/cron/refresh-kennel-prestige-leaderboard", {
          headers: { Authorization: "Bearer kennel-prestige-cron-test-secret" },
        })
      );
      const body = await response.json();
      assert.equal(response.status, expected.status, `${expected.result.outcome} status`);
      assert.equal(body.ok, expected.ok, `${expected.result.outcome} response ok`);
      assert.equal(body.published, expected.published, `${expected.result.outcome} publication flag`);
      assert.equal(body.outcome, expected.result.outcome, `${expected.result.outcome} response outcome`);
    }

    const unexpectedHandler = createRefreshKennelPrestigeLeaderboardCronHandler({
      refreshDue: async () => {
        throw new Error("controlled unexpected failure");
      },
    });
    const unexpectedResponse = await unexpectedHandler(
      new Request("http://localhost/api/cron/refresh-kennel-prestige-leaderboard", {
        headers: { Authorization: "Bearer kennel-prestige-cron-test-secret" },
      })
    );
    assert.equal(unexpectedResponse.status, 500);
    const unexpectedBody = await unexpectedResponse.json();
    assert.equal(unexpectedBody.ok, false);
    assert.equal(unexpectedBody.outcome, "failed");
    assert.equal(unexpectedBody.published, false);
    assert.equal(typeof unexpectedBody.durationMs, "number");
    assert.equal(unexpectedBody.error, "Kennel prestige leaderboard refresh failed.");
  });

  const priorSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "kennel-prestige-cron-test-secret";
  const defaultUnauthorized = await GET(
    new Request("http://localhost/api/cron/refresh-kennel-prestige-leaderboard")
  );
  assert.equal(defaultUnauthorized.status, 401, "default route rejects unauthorized calls before service access");
  if (priorSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = priorSecret;

  assert.match(routeSource, /export const dynamic = "force-dynamic"/);
  assert.match(routeSource, /export const maxDuration = 300/);
  assert.match(routeSource, /refreshDueOverallKennelPrestigeLeaderboard/);
  assert.doesNotMatch(routeSource, /getKennelPrestigeLeaderboard|publishCurrentOverallKennelPrestigeLeaderboard|replaceCurrentKennelPrestigeLeaderboard/);
  assert.deepEqual(
    vercelConfig.crons,
    [
      { path: "/api/cron/resolve-dog-mortality", schedule: "* * * * *" },
      { path: "/api/cron/judge-show-blocks", schedule: "* * * * *" },
      { path: "/api/cron/finalize-show-results", schedule: "*/2 * * * *" },
      { path: "/api/cron/maintain-breed-genetic-background", schedule: "29 */6 * * *" },
      { path: "/api/cron/refresh-kennel-prestige-leaderboard", schedule: "47 * * * *" },
      { path: "/api/cron/process-breed-kennel-prestige-leaderboard", schedule: "* * * * *" },
      { path: "/api/cron/resolve-breeding-progress", schedule: "0 * * * *" },
      { path: "/api/cron/process-stud-contract-lifecycle", schedule: "*/5 * * * *" },
      { path: "/api/cron/reconcile-art-payments", schedule: "*/5 * * * *" },
      { path: "/api/cron/replay-art-payment-events", schedule: "*/15 * * * *" },
      { path: "/api/jobs/process-emergency-vet-care", schedule: "17 * * * *" },
      { path: "/api/jobs/maintain-show-schedule", schedule: "*/30 * * * *" },
    ],
    "the leaderboard cron is added without changing existing schedules"
  );
  console.log("Kennel prestige leaderboard scheduled refresh checks passed.");
}

void main();
