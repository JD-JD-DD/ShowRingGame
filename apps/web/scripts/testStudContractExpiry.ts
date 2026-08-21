import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const service = source("apps/web/server/services/studContractLifecycle.service.ts");
const route = source("apps/web/app/api/cron/process-stud-contract-lifecycle/route.ts");
const config = source("apps/web/vercel.json");
for (const fragment of [
  'status: "PENDING"',
  "approvalDeadlineAt: { lte: now }",
  "take: limit",
  "updateMany",
  'status: "EXPIRED"',
  "expiredAt: now",
  "STUD_MANUAL_EXPIRED",
  "createKennelNotice",
]) assert.ok(service.includes(fragment), fragment);
assert.equal(service.includes("breedingAttempt.create"), false);
assert.equal(service.includes("ledgerTransaction"), false);
assert.ok(route.includes("processExpiredStudContractRequests"));
assert.ok(route.includes("CRON_SECRET"));
assert.ok(config.includes('"/api/cron/process-stud-contract-lifecycle"'));
assert.ok(config.includes('"schedule": "*/5 * * * *"'));
console.log("Stud Contract expiry checks passed.");
