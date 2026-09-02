import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd().endsWith(join("apps", "web")) ? resolve(process.cwd(), "..", "..") : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const market = source("apps/web/server/services/market.service.ts");
const entry = source("apps/web/server/services/showEntry.service.ts");
const health = source("apps/web/server/services/infectiousDisease.service.ts");
const grooming = source("apps/web/server/services/grooming.service.ts");

for (const [name, text] of [["market", market], ["show entry", entry], ["brucellosis", health], ["grooming", grooming]] as const) {
  assert.match(text, /\$transaction\(/, `${name} representative money flow remains transactional`);
  assert.match(text, /ledgerTransaction\.create/, `${name} representative money flow retains ledger persistence`);
}
assert.match(market, /transactionType: "DOG_PURCHASE"/, "player purchase retains buyer ledger type");
assert.match(market, /transactionType: "DOG_SALE"/, "player sale retains seller ledger type");
assert.match(market, /amount: -listing\.askingPrice/, "player purchase remains a negative payer row");
assert.match(market, /amount: listing\.askingPrice/, "player sale remains a positive recipient row");
assert.match(market, /balanceAfter: buyerBalanceAfter/, "buyer row retains logical post-effect balance");
assert.match(market, /balanceAfter: sellerBalanceAfter/, "seller row retains logical post-effect balance");
assert.match(entry, /amount: -ENTRY_FEE_PER_SHOW/, "show entry retains a negative sink debit");
assert.match(entry, /balanceAfter,/, "show entry records its post-debit balance");
assert.match(health, /amount: -BRUCELLOSIS_TEST_FEE/, "brucellosis retains a negative health debit");
assert.match(health, /balanceAfter: args\.runningBalance\.value/, "brucellosis retains logical running post-effect balances");
assert.match(grooming, /transactionType: "GROOMING_INCOME"/, "outside grooming retains its faucet classification");
assert.match(grooming, /amount: listing\.price/, "outside grooming retains a positive recipient payment");

console.log("ARCH-GUARD-004 ledger invariant checks passed.");
