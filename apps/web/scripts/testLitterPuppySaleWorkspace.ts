import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const workspace = readFileSync("components/litters/LitterPuppySaleWorkspace.tsx", "utf8");
const preflightRoute = readFileSync("app/api/litters/[litterId]/puppies/bulk-sale-preflight/route.ts", "utf8");
const mutationRoute = readFileSync("app/api/litters/[litterId]/puppies/bulk-for-sale/route.ts", "utf8");
const bulkService = readFileSync("server/services/litterBulkSale.service.ts", "utf8");
const singleRoute = readFileSync("app/api/litters/[litterId]/puppies/[dogId]/list-for-sale/route.ts", "utf8");
const market = readFileSync("server/services/market.service.ts", "utf8");
const mapper = readFileSync("server/mappers/litter.mapper.ts", "utf8");

assert.match(client, /activeAction === "sale" && activeActionPartition/, "Sale uses the shared action partition for one or many puppies");
assert.match(client, /eligiblePuppies=\{activeActionPartition\.eligiblePuppies\}/, "Sale passes the action-eligible cohort");
assert.match(client, /skippedPuppies=\{activeActionPartition\.skippedPuppies\}/, "Sale preserves action-level skips");
assert.match(client, /saleResult/, "Sale outcomes remain visible in parent state after close");

assert.match(workspace, /Sell All For/, "workspace mirrors the common-price interaction");
assert.match(workspace, /applyPriceToEligiblePuppies/, "common price applies to current eligible rows only");
assert.match(workspace, /pricesByDogId/, "individual puppy prices remain independently editable");
assert.match(workspace, /eligiblePuppies\.map/, "each requested eligible puppy has its own row");
assert.match(workspace, /\/bulk-sale-preflight/, "workspace refreshes sale eligibility through the litter preflight endpoint");
assert.match(workspace, /\/bulk-for-sale/, "one and many puppies use the same bulk-capable execution endpoint");
assert.match(workspace, /isValidWholeDollarSalePrice/, "client uses existing whole-dollar assistance");
assert.match(workspace, /role="alert"/, "errors remain inline and accessible");
assert.doesNotMatch(workspace, /modal|popover|drawer|Edit Sale|Cancel Listing|Relist|PUPPY_SALE_MIN_AGE_HOURS|ageHours/i, "workspace adds no listing management or client sale-age calculation");

assert.match(preflightRoute, /parseDogIds/, "preflight validates its narrow request shape");
assert.match(mutationRoute, /parseWholeDollarPrice/, "execution reuses canonical whole-dollar parsing");
assert.match(mutationRoute, /assertWholeDollarAmount/, "execution reuses canonical minimum validation");
assert.match(bulkService, /litter\.bredByKennelId !== args\.kennelId/, "litter breeder authority is whole-operation authorization");
assert.match(bulkService, /getDogSaleEligibility\(/, "preflight and execution use canonical sale eligibility");
assert.match(bulkService, /dog\.litterId !== litter\.id/, "every submitted puppy is revalidated against litter membership");
assert.match(bulkService, /dog\.ownerKennelId !== args\.kennelId/, "every submitted puppy is revalidated against current ownership");
assert.match(bulkService, /bulkListDogsForSale\(/, "remaining eligible rows execute through canonical bulk sale once");
assert.doesNotMatch(bulkService, /dogListing\.(create|update)|marketState:|ledgerTransaction/, "litter wrapper adds no direct market or ledger mutation");

assert.match(singleRoute, /export async function POST/, "single litter Sale compatibility route remains intact");
assert.match(market, /export async function bulkListDogsForSale/, "canonical bulk listing remains the execution seam");
assert.match(market, /getDogSaleEligibility\(/, "market listing remains protected by canonical eligibility");
assert.match(market, /canSellPuppy/, "canonical sale age remains in the market layer");
assert.doesNotMatch(mapper, /listingFee|kennelRuns:/, "litter read model adds no fee or destination-run preload");

console.log("Litter puppy unified sale workspace checks passed.");
