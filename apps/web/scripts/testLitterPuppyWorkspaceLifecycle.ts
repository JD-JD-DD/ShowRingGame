import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const nameWorkspace = readFileSync("components/litters/LitterPuppyNameWorkspace.tsx", "utf8");
const runWorkspace = readFileSync("components/litters/LitterPuppyKennelRunWorkspace.tsx", "utf8");
const saleWorkspace = readFileSync("components/litters/LitterPuppySaleWorkspace.tsx", "utf8");
const rehomeWorkspace = readFileSync("components/litters/LitterPuppyRehomeWorkspace.tsx", "utf8");

assert.match(client, /useState<"name" \| "moveRun" \| "sale" \| "rehome" \| null>/, "one discriminator controls every workspace");
assert.match(client, /if \(selectedPuppyId !== puppyId\) setActiveAction\(null\)/, "selecting another puppy closes the prior workspace");
assert.match(client, /function clearSelection\(\) \{\s*setActiveAction\(null\)/, "clearing selection closes the workspace and discards its draft");
assert.match(client, /onClick=\{\(\) => setActiveAction\("name"\)\}/, "Name action switches the active workspace");
assert.match(client, /onClick=\{\(\) => setActiveAction\("moveRun"\)\}/, "Move action switches the active workspace");
assert.match(client, /onClick=\{\(\) => setActiveAction\("sale"\)\}/, "Sale action switches the active workspace");
assert.match(client, /onClick=\{\(\) => setActiveAction\("rehome"\)\}/, "Re-home action switches the active workspace");
assert.match(client, /if \(!isEligible\) setActiveAction\(null\)/, "refreshed ineligible actions close their workspace");
assert.match(client, /const onAuthoritativeRefresh = useCallback[\s\S]*router\.refresh\(\)/, "parent owns the authoritative refresh convention");
assert.match(client, /onAuthoritativeRefresh=\{onAuthoritativeRefresh\}/, "every workspace receives the shared refresh callback");
assert.doesNotMatch(client, /Select All|bulk action|selected count/i, "Feature 3 remains single-puppy without bulk UI");

for (const workspace of [nameWorkspace, runWorkspace, saleWorkspace, rehomeWorkspace]) {
  assert.match(workspace, /onAuthoritativeRefresh\(\)/, "workspace refreshes authoritative state after success or stale failure");
  assert.match(workspace, /role="alert"/, "workspace presents expected errors inline");
  assert.match(workspace, /onClose/, "workspace closes through the parent-owned lifecycle");
  assert.doesNotMatch(workspace, /alert\(|confirm\(|location\.href|router\.push/i, "workspace does not navigate or use browser dialogs");
}

assert.match(nameWorkspace, /response\.status === 403 \|\| response\.status === 404 \|\| response\.status === 409/, "stale registered-name conflicts refresh authoritative state");
assert.match(runWorkspace, /response\.status === 403 \|\| response\.status === 404/, "stale run ownership and destination failures refresh authoritative state");

console.log("Litter puppy workspace lifecycle checks passed.");
