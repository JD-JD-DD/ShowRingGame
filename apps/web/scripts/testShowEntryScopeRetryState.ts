import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { shouldPreserveRetrySelections } from "../app/shows/[showId]/ShowEntryPlannerScopeForm";

function scope(args: Partial<Parameters<typeof shouldPreserveRetrySelections>[0]>) {
  return shouldPreserveRetrySelections({
    initialBreedCode: "",
    initialKennelRunId: "",
    breedCode: "",
    kennelRunId: "",
    ...args,
  });
}

assert.equal(
  scope({ initialBreedCode: "AA", breedCode: "AA" }),
  true,
  "same breed preserves retry selections"
);
assert.equal(
  scope({ initialKennelRunId: "run-a", kennelRunId: "run-a" }),
  true,
  "same kennel run preserves retry selections"
);
assert.equal(
  scope({ initialBreedCode: "AA", breedCode: "BB" }),
  false,
  "breed change clears retry selections"
);
assert.equal(
  scope({ initialKennelRunId: "run-a", kennelRunId: "run-b" }),
  false,
  "kennel-run change clears retry selections"
);
assert.equal(
  scope({ initialKennelRunId: "run-a", breedCode: "AA" }),
  false,
  "kennel-run to breed scope change clears retry selections"
);
assert.equal(
  scope({ initialBreedCode: "AA", kennelRunId: "run-a" }),
  false,
  "breed to kennel-run scope change clears retry selections"
);
assert.equal(
  scope({ initialBreedCode: "AA" }),
  false,
  "clearing scope does not preserve retry selections"
);

const root = process.cwd().endsWith(`${join("apps", "web")}`)
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const form = readFileSync(
  join(root, "apps/web/app/shows/[showId]/ShowEntryPlannerScopeForm.tsx"),
  "utf8"
);
const page = readFileSync(
  join(root, "apps/web/app/shows/[showId]/page.tsx"),
  "utf8"
);

assert.ok(form.includes("preserveRetrySelections && dogIds?.trim()"));
assert.ok(form.includes("preserveRetrySelections && dogDaySelections?.trim()"));
assert.ok(form.includes('name="dogDaySelections"'));
assert.ok(page.includes("dogDaySelections={"));

console.log("Show-entry scope retry-state checks passed.");
