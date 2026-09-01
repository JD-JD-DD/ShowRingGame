import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const service = readFileSync(
  resolve(process.cwd(), "server/services/grooming.service.ts"),
  "utf8"
);
const route = readFileSync(
  resolve(
    process.cwd(),
    "app/api/services/grooming/listings/[listingId]/accept/route.ts"
  ),
  "utf8"
);
const acceptSection = service.slice(
  service.indexOf("export async function acceptGroomingJob"),
  service.indexOf("async function getDogNetGroomingImpact")
);
const expectedRouteSection = route.slice(
  route.indexOf("if (error instanceof GroomingServiceError)"),
  route.indexOf("console.error(")
);

assert.ok(
  service.includes("export class GroomingServiceError extends Error"),
  "grooming uses a typed local domain error"
);
assert.ok(
  service.includes("Your kennel has used all 10 grooming actions this week."),
  "weekly-cap player message is unchanged"
);
assert.ok(
  service.includes("throw new GroomingServiceError("),
  "weekly-cap rejection is classified as a grooming domain error"
);
assert.ok(
  acceptSection.includes("This grooming job is no longer available."),
  "listing availability rejection remains a recognized domain error"
);
assert.ok(
  acceptSection.includes("This dog is awaiting emergency veterinary care."),
  "dog eligibility rejection remains a recognized domain error"
);
assert.ok(
  expectedRouteSection.includes("fail(error.message, error.status)"),
  "expected JSON rejections preserve their player-facing 4xx response"
);
assert.equal(
  expectedRouteSection.includes("console.error"),
  false,
  "expected grooming rejections do not log at error level"
);
assert.ok(
  route.includes('console.error(\n      "POST /api/services/grooming/listings/[listingId]/accept failed:"'),
  "unexpected acceptance exceptions still log"
);
assert.ok(
  route.includes('fail(message, 500)'),
  "unexpected JSON exceptions retain the generic 500 response"
);
assert.ok(
  acceptSection.indexOf("const listingClaim") <
    acceptSection.indexOf("await tx.groomingServiceAction.create"),
  "successful acceptance flow remains unchanged after the listing claim"
);

console.log("Grooming listing acceptance error-classification checks passed.");
