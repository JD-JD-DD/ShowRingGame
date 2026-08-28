import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { publicHealthTestResultRows } from "../components/dogs/HealthTestResultsPanel";

const repoRoot = path.resolve(__dirname, "../../..");
const marketService = fs.readFileSync(
  path.join(repoRoot, "apps/web/server/services/market.service.ts"),
  "utf8"
);
const marketPage = fs.readFileSync(
  path.join(repoRoot, "apps/web/app/market/MarketPageClient.tsx"),
  "utf8"
);
const studsPage = fs.readFileSync(
  path.join(repoRoot, "apps/web/app/studs/page.tsx"),
  "utf8"
);

assert.deepEqual(publicHealthTestResultRows([]), []);
assert.deepEqual(
  publicHealthTestResultRows([
    { testTypeCode: "HIP_DYSPLASIA", resultCode: "EXCELLENT" },
    { testTypeCode: "HIP_DYSPLASIA", resultCode: "SEVERE" },
    { testTypeCode: "CARDIAC", resultCode: "NORMAL" },
  ]),
  [
    {
      testTypeCode: "HIP_DYSPLASIA",
      label: "Hip Dysplasia",
      result: "Excellent",
    },
    {
      testTypeCode: "CARDIAC",
      label: "Cardiac",
      result: "Normal",
    },
  ],
  "the shared presenter keeps the newest public result per canonical test"
);
assert.equal(
  publicHealthTestResultRows([
    { testTypeCode: "NOT_A_PUBLIC_TEST", resultCode: "UNKNOWN" },
  ]).length,
  0,
  "the presenter does not expose unrecognized health records"
);

assert.match(
  marketService,
  /healthTests:\s*listing\.dog\.healthTests/,
  "market DTO exposes the already-public health-test records"
);
assert.match(
  marketService,
  /healthTests:\s*\{[\s\S]*?where:\s*\{\s*isPublic:\s*true/,
  "market query only reads public health-test records"
);
assert.match(
  marketPage,
  /<HealthTestResultsPanel tests=\{dog\.healthTests\} \/>/,
  "market cards use the shared health-test presenter"
);
assert.match(
  studsPage,
  /<HealthTestResultsPanel tests=\{dog\.healthTests\} \/>/,
  "public stud cards use the shared health-test presenter"
);
assert.match(
  studsPage,
  /Stud Terms[\s\S]*?<HealthTestResultsPanel tests=\{dog\.healthTests\} \/>/,
  "stud health tests occupy the cell following Stud Terms"
);

console.log("Marketplace and public-stud health-test presentation checks passed.");
