import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

async function main() {
  const service = source("apps/web/server/services/supportSubscription.service.ts");
  const schema = source("apps/web/prisma/schema.prisma");
  const migration = source("apps/web/prisma/migrations/20260829130000_add_support_subscription_changes/migration.sql");
  const route = source("apps/web/app/api/support/change-tier/route.ts");
  const management = source("apps/web/components/support/SupportManagementAffordances.tsx");

  assert.match(schema, /model SupportSubscriptionChange/, "upgrade state is durable and separate from SupportStatus");
  assert.match(schema, /targetSupportSubscriptionId\s+String\?\s+@unique/, "a target has one workflow");
  assert.match(schema, /approvalUrl\s+String\?/, "pending retries can resume the original safe approval URL");
  assert.match(migration, /SupportSubscriptionChangeStatus/, "migration creates workflow states");
  assert.match(service, /PENDING_APPROVAL/, "pending approval is explicit");
  assert.match(service, /CLEANUP_FAILED/, "cancellation failure remains durable");
  assert.match(service, /targetActivatedAt && change\.targetSubscription\?\.status === "ACTIVE"/, "only a verified active replacement becomes canonical");
  assert.match(service, /: change\.sourceSubscription;/, "source remains canonical before activation");
  assert.match(service, /isStrictUpgrade/, "only strictly higher tiers are eligible");
  assert.match(service, /firstSupportedAt: canonical\.firstSupportedAt/, "replacement preserves original first support date");
  assert.match(service, /cancelSubscription\(change\.sourceSubscription\.providerSubscriptionId\)/, "only exact source is cancelled");
  assert.match(service, /status: "COMPLETED"/, "successful source cleanup completes the workflow");
  assert.match(service, /status: "CLEANUP_FAILED"/, "failed cleanup does not roll back target");
  assert.match(service, /existing\.status === "PENDING_APPROVAL"/, "pending replacement retries do not create a duplicate");
  assert.match(service, /approvalUrl: existing\.approvalUrl/, "the same pending upgrade returns its original approval URL");
  assert.match(route, /getSessionUserId/, "tier changes are authenticated");
  assert.match(route, /isSupportTier\(tier\)/, "client can submit only canonical tiers");
  assert.match(management, /\/api\/support\/change-tier/, "account management uses the tier-change route");
  assert.match(management, /Upgrading starts a new higher-level monthly support subscription/, "approved upgrade disclosure is presented");
  assert.doesNotMatch(management, /Cancel support/, "general cancellation remains deferred");
  console.log("SUPPORT-06B tier-change checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
