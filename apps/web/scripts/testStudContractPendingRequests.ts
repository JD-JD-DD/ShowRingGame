import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const page = source("apps/web/app/stud-contracts/requests/page.tsx");

assert.ok(page.includes('redirect("/stud-contracts?action=manual-approval")'));
assert.equal(page.includes("studContract.findMany"), false, "compatibility route does not query requests");
assert.equal(page.includes("studContract.update"), false, "compatibility route does not mutate requests");
console.log("Stud Contract pending requests checks passed.");
