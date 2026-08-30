import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const repair = readFileSync(join(root, "apps/web/scripts/repairSupportUpgradeCleanup.ts"), "utf8");

assert.match(repair, /--source-subscription-id/, "requires an exact source identifier");
assert.match(repair, /--target-subscription-id/, "requires an exact target identifier");
assert.match(repair, /--change-id/, "requires an exact workflow identifier");
assert.match(repair, /import \{ db \} from "\.\.\/lib\/db"/, "uses the established apps\/web database client");
assert.doesNotMatch(repair, /new PrismaClient/, "does not construct a separate Prisma client");
assert.match(repair, /source\.providerSubscriptionId !== EXPECTED\.sourceProviderSubscriptionId/, "fails closed for a mismatched source provider ID");
assert.match(repair, /source\.status !== "ACTIVE"/, "fails closed for a mismatched source status");
assert.match(repair, /target\.status !== "ACTIVE"/, "fails closed for a mismatched target status");
assert.match(repair, /change\.status !== "CLEANUP_FAILED"/, "fails closed for a mismatched workflow status");
assert.match(repair, /if \(args\.apply\)/, "writes are gated behind --apply");
assert.match(repair, /status: "ENDED", endedAt: terminalAt/, "apply terminalizes only the source");
assert.match(repair, /status: "COMPLETED", completedAt: new Date\(\)/, "apply completes only the workflow");
assert.doesNotMatch(repair, /paypalSupport|PayPalClient|createPayPal|cancelSubscription|reviseSubscription|createSubscription/, "repair never imports or calls PayPal");
console.log("SUPPORT-07 upgrade cleanup repair checks passed.");
