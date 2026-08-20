import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = readFileSync(
  join(repoRoot, "apps/web/app/stud-contract/page.tsx"),
  "utf8"
);

assert.ok(source.includes('args.source === "public-stud") return "/studs"'));
assert.ok(source.includes('args.source === "plan-a-litter") return "/plan-a-litter"'));
assert.ok(source.includes('return `/breed?studListingId=${encodeURIComponent(args.studListingId)}`'));
assert.ok(source.includes('return `/breed?dogId=${encodeURIComponent(args.damDogId)}`'));
assert.ok(source.includes('return "/breed"'));
assert.ok(source.includes('return "/studs"'));
assert.ok(source.includes('redirect("/login")'));
assert.ok(source.includes("Stud contract details will be available here."));
assert.ok(source.includes("Go Back"));
assert.ok(!source.includes("returnTo"));
assert.ok(!source.includes("db."));
assert.ok(!source.includes("fetch("));

console.log("Stud contract route checks passed.");
