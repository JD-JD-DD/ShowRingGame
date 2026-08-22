import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const header = read("apps/web/components/layout/GameHeaderNav.tsx");
const requests = read("apps/web/app/stud-contracts/requests/page.tsx");
const detail = read("apps/web/app/stud-contracts/[contractId]/page.tsx");
const worksheet = read("apps/web/app/dogs/[dogId]/stud-contract/page.tsx");
const manual = read("apps/web/components/stud-contract/ManualStudContractRequest.tsx");

assert.equal((header.match(/href: "\/stud-contracts"/g) ?? []).length, 1);
assert.ok(header.includes('label: "Stud Contracts", href: "/stud-contracts"'));
assert.equal(header.includes('href: "/stud-contracts/requests"'), false);
assert.ok(requests.includes('redirect("/stud-contracts?action=manual-approval")'));
assert.equal(requests.includes("studContract.findMany"), false);
assert.ok(detail.includes('href="/stud-contracts"'));
assert.ok(worksheet.includes('href="/stud-contracts"'));
assert.ok(manual.includes("Open Contract"));
assert.ok(manual.includes('`/stud-contracts/${contractId}`'));
assert.equal(manual.includes("/stud-contracts/requests"), false);
console.log("Stud Contract navigation checks passed.");
