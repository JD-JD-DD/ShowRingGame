import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const home = source("apps/web/app/page.tsx");

assert.match(home, /<section className="theme-panel rounded-\[24px\] p-5" aria-labelledby="support-and-art-heading">/);
assert.match(home, /<Link href="\/support"[\s\S]*>Support ShowRing<\/Link>/);
assert.match(home, /<Link href="\/breed-art"[\s\S]*>Explore the Breed Art Fund<\/Link>/);
assert.match(home, /ShowRing is free to play\. Voluntary monthly support helps with development and operating costs\./);
assert.match(home, /Help fund original artwork for ShowRing&apos;s growing breed collection\./);
assert.match(home, /grid gap-4 sm:grid-cols-2 xl:grid-cols-1/);
assert.match(home, /border border-\[var\(--dog-border-strong\)\]/);
assert.match(home, /focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2/);
assert.doesNotMatch(home, /HomePayPalButton|paypal-container|hosted-buttons|enable-funding=venmo|PayPal button|<input|fetch\(/i);
assert.equal(existsSync(join(root, "apps/web/components/payments/HomePayPalButton.tsx")), false, "obsolete homepage hosted payment component is removed");
assert.doesNotMatch(home, /ArtPaymentAttempt|ArtContribution|SupportSubscription|createPayPal|PayPal/);
console.log("Homepage Support and Breed Art navigation checks passed.");
