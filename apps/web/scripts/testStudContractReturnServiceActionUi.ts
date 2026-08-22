import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const detail = read("apps/web/app/stud-contracts/[contractId]/page.tsx");
const action = read("apps/web/components/stud-contract/StudContractReturnServiceAction.tsx");
const history = read("apps/web/server/services/studContractHistory.service.ts");

for (const fragment of [
  "isDamContractingKennel",
  'contract.returnService.status === "AVAILABLE"',
  "StudContractReturnServiceAction",
]) assert.ok(detail.includes(fragment), fragment);
for (const fragment of [
  "returnServiceId",
  "encodeURIComponent(props.returnServiceId)",
  "method: \"POST\"",
  "router.refresh()",
  "Attempt Return Service",
  "Return Service used. The return breeding has begun.",
  "aria-live=\"polite\"",
  "expiresAt",
  "canAttempt",
  "unavailableReason",
  "aria-describedby",
]) assert.ok(action.includes(fragment), fragment);
assert.equal(action.includes("sireDogId"), false);
assert.equal(action.includes("damDogId"), false);
assert.equal(action.includes("studOffer"), false);
assert.ok(history.includes("isDamContractingKennel: contract.damKennelId === kennelId"));
assert.ok(history.includes("returnServiceIsActionable && !isStudOwner"));
assert.ok(history.includes("returnServiceAvailability"));
console.log("Stud Contract Return Service action UI checks passed.");
