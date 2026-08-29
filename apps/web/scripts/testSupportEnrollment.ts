import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

const presentation = source("apps/web/lib/supportPresentation.ts");
const enrollment = source("apps/web/components/support/SupportEnrollment.tsx");
const supportPage = source("apps/web/app/support/page.tsx");
const statusPage = source("apps/web/app/account/settings/support/page.tsx");
const refreshButton = source("apps/web/components/support/RefreshSupportStatusButton.tsx");
const header = source("apps/web/components/layout/GameHeaderNav.tsx");
const route = source("apps/web/app/api/support/subscriptions/route.ts");
const payPalService = source("apps/web/server/services/paypalSupport.service.ts");
const sandboxPage = source("apps/web/app/test/support-sandbox/page.tsx");

assert.match(presentation, /BRONZE[\s\S]*Bronze Supporter[\s\S]*monthlyAmount: 2/);
assert.match(presentation, /SILVER[\s\S]*Silver Supporter[\s\S]*monthlyAmount: 5/);
assert.match(presentation, /GOLD[\s\S]*Gold Supporter[\s\S]*monthlyAmount: 10/);
assert.match(presentation, /Bronze, Silver, and Gold Supporter badges recognize voluntary monthly support of ShowRing Game\. Support level does not affect gameplay, rankings, visibility, or competitive outcomes\. Players may choose whether their supporter badge is displayed publicly\./);
assert.match(presentation, /The Supporter badge is currently the only benefit of monthly support\./);
for (const question of [
  "Can I cancel anytime?",
  "Can I change my support level?",
  "Can I hide my supporter badge?",
  "Does Gold get gameplay advantages over Bronze?",
  "Will supporter tiers become Premium tiers later?",
]) assert.match(presentation, new RegExp(question.replace(/[?]/g, "\\?")));

assert.match(enrollment, /fetch\("\/api\/support\/subscriptions"/);
assert.match(enrollment, /JSON\.stringify\(\{ tier: selectedTier\.tier \}\)/);
assert.doesNotMatch(enrollment, /planId|providerSubscriptionId|environment/);
assert.match(enrollment, /if \(!selectedTier \|\| isSubmitting\) return/);
assert.match(enrollment, /disabled=\{isSubmitting\}/);
assert.match(enrollment, /\/login\?next=%2Fsupport/);
assert.match(enrollment, /currentSubscription \?/);
assert.match(enrollment, /Support setup was cancelled\. No new support subscription was completed\./);

assert.match(supportPage, /CURRENT_SUPPORT_STATUSES/);
assert.match(supportPage, /paypal === "cancelled"/);
assert.match(statusPage, /redirect\("\/login\?next=%2Faccount%2Fsettings%2Fsupport"\)/);
assert.match(statusPage, /paypal === "approved"/);
assert.match(statusPage, /PayPal approval received\. Confirming your support status…/);
assert.match(statusPage, /subscription\.status === "PENDING"/);
assert.doesNotMatch(statusPage, /cancelSubscription|upgrade|downgrade/);
assert.match(refreshButton, /router\.refresh\(\)/);
assert.match(header, /\{ label: "Support", href: "\/support" \}/);

assert.match(route, /getAppBaseUrl\(request\)/);
assert.match(route, /new URL\("\/account\/settings\/support\?paypal=approved", appBaseUrl\)\.toString\(\)/);
assert.match(route, /new URL\("\/support\?paypal=cancelled", appBaseUrl\)\.toString\(\)/);
assert.match(payPalService, /user_action: "SUBSCRIBE_NOW"/);
assert.match(payPalService, /return_url: args\.returnUrl/);
assert.match(payPalService, /cancel_url: args\.cancelUrl/);
assert.match(sandboxPage, /getPayPalEnvironment\(\) === "sandbox"/);

console.log("SUPPORT-04 enrollment source checks passed.");
