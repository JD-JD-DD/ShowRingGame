import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const workspace = readFileSync("components/litters/LitterPuppySaleWorkspace.tsx", "utf8");
const route = readFileSync("app/api/litters/[litterId]/puppies/[dogId]/list-for-sale/route.ts", "utf8");
const market = readFileSync("server/services/market.service.ts", "utf8");
const mapper = readFileSync("server/mappers/litter.mapper.ts", "utf8");

assert.match(client, /"name" \| "moveRun" \| "sale" \| null/, "one active workspace supports all implemented actions");
assert.match(client, /Put Up for Sale/, "sale action is visible in the shared action seam");
assert.match(client, /disabled=\{!selectedPuppy\.actionEligibility\.canListForSale\}/, "sale availability is server-authoritative");
assert.match(client, /saleDisabledReason/, "sale unavailability visibly uses the server reason");
assert.match(client, /<LitterPuppySaleWorkspace/, "sale action opens an inline workspace");
assert.doesNotMatch(client, /Re-home/, "Re-home remains absent");

assert.match(workspace, /Sale price/, "workspace exposes the canonical price field");
assert.match(workspace, /min=\{1\}/, "price has canonical minimum UI assistance");
assert.match(workspace, /step=\{1\}/, "price has canonical whole-dollar UI assistance");
assert.match(workspace, /inputMode="numeric"/, "price matches canonical numeric input behavior");
assert.match(workspace, /router\.refresh\(\)/, "success and stale errors refresh authoritative state");
assert.match(workspace, /role="alert"/, "errors remain inline and accessible");
assert.doesNotMatch(workspace, /modal|popover|drawer|Edit Sale|Cancel Listing|Relist/i, "workspace has no listing-management controls");
assert.doesNotMatch(workspace, /PUPPY_SALE_MIN_AGE_HOURS|ageHours/, "client performs no sale-age calculation");

assert.match(route, /export async function POST/, "litter sale uses a narrow POST route");
assert.match(route, /litter\.bredByKennelId !== kennel\.id/, "route verifies breeder-of-litter authority");
assert.match(route, /puppy\.litterId !== litter\.id/, "route verifies puppy membership");
assert.match(route, /puppy\.ownerKennelId !== kennel\.id/, "route verifies current ownership");
assert.match(route, /parseWholeDollarPrice/, "route reuses canonical price parsing");
assert.match(route, /listDogForSale\(/, "route delegates listing creation to the canonical service");
assert.doesNotMatch(route, /dogListing\.(create|update)|marketState:|ledgerTransaction/, "route has no direct listing, market state, or ledger mutation");
assert.match(market, /getDogSaleEligibility\(/, "market listing remains protected by canonical eligibility");
assert.match(market, /canSellPuppy/, "canonical sale age remains in the market layer");
assert.match(market, /assertWholeDollarAmount/, "canonical price validation remains in the market layer");
assert.doesNotMatch(mapper, /listingFee|kennelRuns:/, "litter read model adds no fee or destination-run preload");

console.log("Litter puppy sale workspace checks passed.");
