import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSupporterBadgePresentation } from "../lib/supporterBadgePresentation";

const now = new Date("2031-01-01T00:00:00.000Z");
const visible = (tier: "BRONZE" | "SILVER" | "GOLD", status: string, showSupporterBadge = true, currentPaidPeriodEnd?: Date) =>
  getSupporterBadgePresentation({ tier, status, showSupporterBadge, currentPaidPeriodEnd, now });

for (const tier of ["BRONZE", "SILVER", "GOLD"] as const) assert.deepEqual(visible(tier, "ACTIVE"), { visible: true, tier });
assert.deepEqual(visible("GOLD", "ACTIVE", false), { visible: false });
assert.deepEqual(visible("GOLD", "ACTIVE", true), { visible: true, tier: "GOLD" }, "re-enabling restores Gold without changing its tier");
assert.deepEqual(visible("SILVER", "PAYMENT_RETRY"), { visible: true, tier: "SILVER" });
assert.equal(visible("BRONZE", "CANCELLATION_SCHEDULED", true, new Date(now.getTime() + 1)).visible, true);
assert.equal(visible("BRONZE", "CANCELLATION_SCHEDULED", true, now).visible, false);
assert.equal(visible("BRONZE", "CANCELLATION_SCHEDULED", true, new Date(now.getTime() - 1)).visible, false);
assert.equal(visible("BRONZE", "PENDING").visible, false);
assert.equal(visible("BRONZE", "ENDED").visible, false);

const root = join(process.cwd(), "../..");
const account = readFileSync(join(root, "apps/web/app/account/page.tsx"), "utf8");
const preference = readFileSync(join(root, "apps/web/components/account/SupporterBadgePreference.tsx"), "utf8");
assert.match(account, /getSupporterBadgePresentation/);
assert.match(preference, /<SupporterBadge tier=\{previewTier\}/);
assert.match(preference, /value && previewTier/);
console.log("SUPPORT-07D account badge preview checks passed.");
