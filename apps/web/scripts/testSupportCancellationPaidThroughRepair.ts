import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repair = readFileSync(join(process.cwd(), "../..", "apps/web/scripts/repairSupportCancellationPaidThrough.ts"), "utf8");
assert.match(repair, /--subscription-id/, "requires an exact local subscription ID");
assert.match(repair, /I-DSPVEDWJTHFG/, "accepts only the verified provider subscription");
assert.match(repair, /status !== "ENDED"/, "fails closed unless the row is ended");
assert.match(repair, /currentPaidPeriodEnd\.getTime\(\) !== EXPECTED\.paidThrough\.getTime\(\)/, "fails closed for a different paid-through boundary");
assert.match(repair, /if \(args\.apply\)/, "defaults to dry-run");
assert.match(repair, /status: "CANCELLATION_SCHEDULED", cancellationRequestedAt: new Date\(\), endedAt: null/, "apply restores only scheduled paid-through recognition");
assert.doesNotMatch(repair, /paypalSupport|PayPalClient|createPayPal|cancelSubscription|reviseSubscription|createSubscription/, "never contacts PayPal");
console.log("SUPPORT-07 cancellation paid-through repair checks passed.");
