import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const panel = source("apps/web/components/kennel/KennelDogsPanel.tsx");
const workspace = source("apps/web/components/kennel/BulkForSaleWorkspace.tsx");
const route = source("apps/web/app/api/kennel/dogs/bulk-sale-preflight/route.ts");
const mutationRoute = source("apps/web/app/api/kennel/dogs/bulk-for-sale/route.ts");
const market = source("apps/web/server/services/market.service.ts");

assert.match(panel, /<option value="bulk-sale">Bulk For Sale<\/option>/);
assert.match(panel, /setActiveBulkWorkspace\("bulk-sale"\)/);
assert.match(panel, /selectedDogIds\.flatMap/);
assert.match(panel, /<BulkForSaleWorkspace/);

assert.match(workspace, /bulk-sale-preflight/);
assert.match(workspace, /Checking sale eligibility/);
assert.match(workspace, /Not eligible — \{eligibility\.reasonMessage/);
assert.match(workspace, /disabled=\{loading \|\| !eligible\}/);
assert.match(workspace, /isValidWholeDollarSalePrice/);
assert.match(workspace, /Number\.isSafeInteger/);
assert.match(workspace, /Apply to All/);
assert.match(workspace, /eligibleDogs\.map/);
assert.match(workspace, /List Dogs For Sale/);
assert.match(workspace, /\/api\/kennel\/dogs\/bulk-for-sale/);
assert.match(workspace, /disabled=\{!formReady \|\| submitting \|\| Boolean\(successMessage\)\}/);
assert.match(workspace, /Listing dogs\.\.\./);
assert.match(workspace, /setPreflightRetry/);
assert.match(workspace, /aria-label=\{`Sale price for \$\{dog\.displayName\}`\}/);
assert.match(workspace, /Sell All For price/);
assert.match(workspace, /toLocaleString|Intl\.NumberFormat|formatMoney|Sale price/);
assert.doesNotMatch(workspace, /\/api\/dogs\/\[dogId\]\/list-for-sale|listDogForSale|DogListing|marketState/);

assert.match(route, /getSessionUserId/);
assert.match(route, /getKennelForUser/);
assert.match(route, /sellerKennelId: kennel\.id/);
assert.match(route, /getDogSaleEligibility/);
assert.match(route, /Promise\.all/);
assert.match(route, /parseDogIds/);
assert.doesNotMatch(route, /dogListing|marketState|listDogForSale|\.create\(|\.update\(/);

assert.match(mutationRoute, /getSessionUserId/);
assert.match(mutationRoute, /getKennelForUser/);
assert.match(mutationRoute, /parseUpdates/);
assert.match(mutationRoute, /MAX_BULK_SALE_UPDATES = 200/);
assert.match(mutationRoute, /assertWholeDollarAmount/);
assert.match(mutationRoute, /bulkListDogsForSale/);
assert.doesNotMatch(mutationRoute, /sellerKennelId: body|listDogForSale|dogListing|marketState/);

assert.match(market, /export async function bulkListDogsForSale/);
assert.match(market, /db\.\$transaction/);
assert.match(market, /getDogSaleEligibility\(\{/);
assert.match(market, /new BulkDogSaleError/);
assert.match(market, /dogListing\.createMany/);
assert.match(market, /dog\.updateMany/);
assert.match(market, /marketState: "LISTED_PLAYER"/);
assert.match(market, /playerSaleListingData/);

console.log("Bulk For Sale workspace source checks passed.");
