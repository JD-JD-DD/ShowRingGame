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
const pendingCare = source("apps/web/server/services/emergencyVetCare.service.ts");
const protection = source("apps/web/server/services/studContractPuppyProtection.service.ts");

assert.match(panel, /<option value="bulk-sale">Bulk For Sale<\/option>/);
assert.match(panel, /setActiveBulkWorkspace\("bulk-sale"\)/);
assert.match(panel, /selectedDogIds\.flatMap/);
assert.match(panel, /<BulkForSaleWorkspace/);
assert.match(panel, /onSuccess=\{refreshAfterBulkSaleSuccess\}/);
assert.match(panel, /async function refreshAfterBulkSaleSuccess/);
assert.match(panel, /await loadDogs\(\{ preserveLoadingState: true \}\)/);
assert.match(panel, /clearSelection\(\);/);
assert.match(panel, /1 dog listed for sale\./);
assert.match(panel, /dogs listed for sale\./);
assert.match(panel, /The dogs were listed for sale, but My Kennel could not be refreshed\./);
assert.doesNotMatch(
  panel.slice(panel.indexOf("async function refreshAfterBulkSaleSuccess"), panel.indexOf("function updateBulkAction")),
  /loadRuns|router\.refresh|window\.location/
);

assert.match(workspace, /bulk-sale-preflight/);
assert.match(workspace, /Checking sale eligibility/);
assert.match(workspace, /Not eligible — \{eligibility\.reasonMessage/);
assert.match(workspace, /disabled=\{loading \|\| !eligible\}/);
assert.match(workspace, /isValidWholeDollarSalePrice/);
assert.match(workspace, /Number\.isSafeInteger/);
assert.match(workspace, /Apply to All/);
assert.match(workspace, /eligibleDogs\.map/);
assert.match(workspace, /if \(!sellAllPriceValid\) return;/);
assert.match(workspace, /Object\.fromEntries\(eligibleDogs\.map\(\(dog\) => \[dog\.dogId, sellAllPrice\]\)\)/);
assert.match(workspace, /setPricesByDogId\(\(current\) => \(\{ \.\.\.current, \[dog\.dogId\]: event\.target\.value \}\)\)/);
assert.match(workspace, /List Dogs For Sale/);
assert.match(workspace, /\/api\/kennel\/dogs\/bulk-for-sale/);
assert.match(workspace, /disabled=\{!formReady \|\| submitting \|\| Boolean\(successMessage\)\}/);
assert.match(workspace, /Listing dogs\.\.\./);
assert.match(workspace, /setPreflightRetry/);
assert.match(workspace, /await onSuccess\(\{ listedCount: data\.listedCount \}\)/);
assert.match(workspace, /setSubmissionError\(/);
assert.match(workspace, /setPreflightRetry\(\(current\) => current \+ 1\)/);
assert.doesNotMatch(workspace, /router\.refresh|window\.location/);
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
assert.match(mutationRoute, /if \(!userId\) return fail\("Unauthorized\."\s*, 401\)/);
assert.match(mutationRoute, /if \(!kennel\) return fail\("Kennel not found\."\s*, 404\)/);
assert.match(mutationRoute, /parseUpdates/);
assert.match(mutationRoute, /MAX_BULK_SALE_UPDATES = 200/);
assert.match(mutationRoute, /assertWholeDollarAmount/);
assert.match(mutationRoute, /bulkListDogsForSale/);
assert.match(mutationRoute, /typeof value === "string" && \/\^\\d\+\$\//);
assert.match(mutationRoute, /!Array\.isArray\(value\) \|\| value\.length === 0 \|\| value\.length > MAX_BULK_SALE_UPDATES/);
assert.match(mutationRoute, /new Set\(updates\.map\(\(update\) => update\.dogId\)\)\.size === updates\.length/);
assert.match(mutationRoute, /sellerKennelId: kennel\.id/);
assert.doesNotMatch(mutationRoute, /sellerKennelId: body|listDogForSale|dogListing|marketState/);

assert.match(market, /export async function bulkListDogsForSale/);
assert.match(market, /db\.\$transaction/);
assert.match(market, /getDogSaleEligibility\(\{/);
assert.match(market, /new BulkDogSaleError/);
assert.match(market, /dogListing\.createMany/);
assert.match(market, /dog\.updateMany/);
assert.match(market, /marketState: "LISTED_PLAYER"/);
assert.match(market, /playerSaleListingData/);
assert.match(market, /assertWholeDollarAmount\(askingPrice, "Sale price"\)/);
assert.match(market, /export async function listDogForSale/);
assert.match(market, /await assertDogHasNoPendingVeterinaryCare\(listing\.dog\.id, tx\)/);
assert.match(market, /await assertDogNotProtectedByStudContractSelection\(\{ dogId: listing\.dog\.id, action: "transferred", client: tx \}\)/);
assert.match(market, /sellerType: "PLAYER" as const/);
assert.match(market, /listingType: PLAYER_SALE_LISTING_TYPE/);
assert.match(market, /status: "ACTIVE" as const/);
assert.match(market, /descriptionPublic: `Player listing for \$\{args\.regNumber\}\.`/);
assert.match(market, /sellerType: "PLAYER",\s*listingType: PLAYER_SALE_LISTING_TYPE,\s*dog: \{[\s\S]*marketState: "LISTED_PLAYER"/);
assert.match(market, /status: "ACTIVE",\s*OR: \[/);
assert.match(market, /damId: dog\.id,\s*status: \{ in: \["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"\] \}/);
assert.match(pendingCare, /export async function assertDogHasNoPendingVeterinaryCare/);
assert.match(protection, /export async function assertDogNotProtectedByStudContractSelection/);

console.log("Bulk For Sale workspace source checks passed.");
