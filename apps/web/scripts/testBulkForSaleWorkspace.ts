import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const panel = source("apps/web/components/kennel/KennelDogsPanel.tsx");
const workspace = source("apps/web/components/kennel/BulkForSaleWorkspace.tsx");
const route = source("apps/web/app/api/kennel/dogs/bulk-sale-preflight/route.ts");

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
assert.match(workspace, /disabled className=[\s\S]*List Dogs For Sale/);
assert.match(workspace, /aria-label=\{`Sale price for \$\{dog\.displayName\}`\}/);
assert.match(workspace, /Sell All For price/);
assert.match(workspace, /toLocaleString|Intl\.NumberFormat|formatMoney|Sale price/);
assert.doesNotMatch(workspace, /list-for-sale|listDogForSale|DogListing|marketState/);

assert.match(route, /getSessionUserId/);
assert.match(route, /getKennelForUser/);
assert.match(route, /sellerKennelId: kennel\.id/);
assert.match(route, /getDogSaleEligibility/);
assert.match(route, /Promise\.all/);
assert.match(route, /parseDogIds/);
assert.doesNotMatch(route, /dogListing|marketState|listDogForSale|\.create\(|\.update\(/);

console.log("Bulk For Sale workspace source checks passed.");
