import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd().endsWith(join("apps", "web")) ? resolve(process.cwd(), "..", "..") : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const forbidden = /from\s+["'][^"']*(supportSubscription|paypalSupport|communitySupporterBadge|supporterBadgePresentation)[^"']*["']/i;

for (const path of [
  "apps/web/server/services/judging.service.ts",
  "apps/web/server/services/showEntry.service.ts",
  "apps/web/server/services/breedingEligibility.service.ts",
  "apps/web/server/services/market.service.ts",
  "apps/web/server/services/foundationDog.service.ts",
]) {
  assert.doesNotMatch(source(path), forbidden, `${path} must not depend on Support lifecycle/provider/badge modules as gameplay input`);
}

const community = source("apps/web/server/services/communitySupporterBadge.service.ts");
assert.match(community, /getSupporterBadgePresentation/, "Community may consume cosmetic Support badge presentation");
assert.match(community, /isCurrentSupportSubscriptionAt/, "Community uses the shared read-only Support semantic predicate");
assert.doesNotMatch(community, /paypalSupport|PayPalClient|createPayPalClient|getSubscription\(/, "Community badge enrichment remains provider-isolated");

console.log("ARCH-GUARD-002 Support isolation checks passed.");
