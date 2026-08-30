import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const page = source("apps/web/app/account/settings/support/page.tsx");
const presentation = source("apps/web/lib/supportPresentation.ts");
const affordances = source("apps/web/components/support/SupportManagementAffordances.tsx");
const reconcile = source("apps/web/components/support/ReconcileSupportStatusButton.tsx");
const supportService = source("apps/web/server/services/supportSubscription.service.ts");

assert.match(presentation, /PENDING: "Pending confirmation"/);
assert.match(presentation, /ACTIVE: "Active"/);
assert.match(presentation, /PAYMENT_RETRY: "Payment issue"/);
assert.match(presentation, /CANCELLATION_SCHEDULED: "Cancelling"/);
assert.match(presentation, /ENDED: "Not currently supporting"/);

assert.match(page, /subscription\.status === "ACTIVE"/);
assert.match(page, /Next billing date/);
assert.match(affordances, /Change support level/);
assert.doesNotMatch(affordances, /Cancel support/);
assert.match(affordances, /\/api\/support\/change-tier/);
assert.match(affordances, /Upgrading starts a new higher-level monthly support subscription/);
assert.match(affordances, /current support level will remain active until PayPal applies the lower level/);
assert.match(affordances, /Cancel Support/);
assert.match(affordances, /Keep Support/);
assert.match(page, /A support-level change is in progress/);

assert.match(page, /subscription\.status === "PENDING"/);
assert.match(page, /ReconcileSupportStatusButton/);
assert.match(reconcile, /\/api\/support\/reconcile/);
assert.doesNotMatch(page, /Refresh Support Status/);

assert.match(page, /subscription\.status === "PAYMENT_RETRY"/);
assert.match(page, /PayPal was unable to complete a support payment\. Your supporter recognition remains active while PayPal handles payment recovery\./);
assert.match(page, /subscription\.status === "CANCELLATION_SCHEDULED"/);
assert.match(page, /Your recurring PayPal subscription has been cancelled\./);
assert.match(page, /No further recurring charges are scheduled\./);

assert.match(page, /Thank you for supporting ShowRing during development\./);
assert.match(page, /Previous level/);
assert.match(page, /Current status/);
assert.match(page, /Support Again/);
assert.match(page, /You are not currently supporting ShowRing\./);
assert.match(page, /Support ShowRing/);
assert.match(page, /href="\/support"/);
assert.doesNotMatch(page + affordances, /lifetime|total contributed|supporter score|supporter rank/i);
assert.doesNotMatch(page + affordances, /revise|CANCELLATION_SCHEDULED.*user action/);

console.log("SUPPORT-05 management presentation checks passed.");
