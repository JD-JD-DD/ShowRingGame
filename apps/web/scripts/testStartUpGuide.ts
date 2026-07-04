import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`)
    ? join(cwd, "..", "..")
    : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), label);
}

function assertExcludes(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), label);
}

function main() {
  const pageSource = source("apps/web/app/guide/page.tsx");
  const stepperSource = source("apps/web/app/guide/CoreLoopStepper.tsx");

  assertIncludes(
    pageSource,
    "<CoreLoopStepper />",
    "guide page renders the progressive Core Loop stepper"
  );
  assertIncludes(
    pageSource,
    'href="/kennel"',
    "guide keeps the top My Kennel action"
  );
  assertIncludes(
    pageSource,
    'href="/market"',
    "guide keeps the top Browse Market action"
  );

  assertIncludes(
    stepperSource,
    '"use client"',
    "Core Loop stepper uses client-side state"
  );
  assertIncludes(
    stepperSource,
    "useState(0)",
    "Step 1 is active by default"
  );
  assertIncludes(
    stepperSource,
    "continueToNextStep",
    "Continue buttons advance through the guide"
  );
  assertIncludes(
    stepperSource,
    "Continue to buying dogs",
    "Step 1 continue copy is present"
  );
  assertIncludes(
    stepperSource,
    "Continue to viewing a dog",
    "Step 2 continue copy is present"
  );
  assertIncludes(
    stepperSource,
    "View Example Dog",
    "Step 3 action opens the example dog"
  );
  assertIncludes(
    stepperSource,
    'href: "/start-up-guide/example-dog"',
    "Step 3 action links to the example dog page"
  );
  assertIncludes(
    stepperSource,
    "Continue to breeding or showing",
    "Step 3 continue copy is present"
  );
  assertIncludes(
    stepperSource,
    "Continue to results",
    "Step 4 continue copy is present"
  );
  assertIncludes(
    pageSource,
    'id="first-useful-route"',
    "first useful route section has an anchor target"
  );
  assertIncludes(
    stepperSource,
    "Continue to your first route",
    "Final step guides players to the first route section"
  );
  assertIncludes(
    stepperSource,
    'href="#first-useful-route"',
    "Final step uses an in-page anchor"
  );
  assertExcludes(
    stepperSource,
    "Start Playing",
    "Final step no longer shows Start Playing"
  );
  assertIncludes(
    stepperSource,
    "aria-current",
    "Active step has an accessible current state"
  );
  assertExcludes(
    stepperSource,
    "localStorage",
    "Core Loop progress is not persisted"
  );

  console.log("Start Up Guide checks passed.");
}

main();
