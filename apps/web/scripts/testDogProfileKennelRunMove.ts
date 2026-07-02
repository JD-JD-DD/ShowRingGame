import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

function assertNotIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(!haystack.includes(needle), label);
}

const dogPage = source("apps/web/app/dogs/[dogId]/page.tsx");
const dogService = source("apps/web/server/services/dog.service.ts");
const dogMapper = source("apps/web/server/mappers/dog.mapper.ts");
const moveComponent = source(
  "apps/web/components/dogs/DogProfileKennelRunMove.tsx"
);

assertIncludes(
  dogMapper,
  "export type DogProfileKennelRunDto",
  "dog profile DTO exposes a current Kennel Run display type"
);
assertIncludes(
  dogMapper,
  "currentRun: DogProfileKennelRunDto;",
  "dog profile DTO includes currentRun"
);
assertIncludes(
  dogMapper,
  "runId: input.currentRun.runId",
  "dog profile mapper copies the current Kennel Run id"
);
assertIncludes(
  dogMapper,
  "name: input.currentRun.name",
  "dog profile mapper copies the current Kennel Run name"
);

assertIncludes(
  dogService,
  "kennelRunId: true",
  "dog profile service selects kennelRunId for profile run context"
);
assertIncludes(
  dogService,
  "kennelRun: {",
  "dog profile service selects the Kennel Run relation"
);
assertIncludes(
  dogService,
  "currentRun:",
  "dog profile service returns currentRun through the mapper"
);
assertIncludes(
  dogService,
  "dog.kennelRun.kennelId === dog.ownerKennelId",
  "dog profile service guards against stale run-owner mismatches"
);

assertIncludes(
  dogPage,
  'import DogProfileKennelRunMove from "@/components/dogs/DogProfileKennelRunMove";',
  "dog page imports the Kennel Run move component"
);
assertIncludes(
  dogPage,
  "const canMoveKennelRun =",
  "dog page computes a dedicated Kennel Run move gate"
);
assertIncludes(
  dogPage,
  "viewerContext.isOwnedByCurrentKennel && header.lifecycleState === \"ALIVE\"",
  "dog page limits Kennel Run moving to active dogs owned by the viewer"
);
assertIncludes(
  dogPage,
  "<DogProfileKennelRunMove",
  "dog page renders the Kennel Run move component"
);
assertIncludes(
  dogPage,
  "currentRunId={profile.currentRun?.runId ?? null}",
  "dog page passes the current Kennel Run id"
);
assertIncludes(
  dogPage,
  "currentRunName={profile.currentRun?.name ?? null}",
  "dog page passes the current Kennel Run name"
);
assertIncludes(
  dogPage,
  "canMove={canMoveKennelRun}",
  "dog page passes the owner-active move gate"
);

assertIncludes(
  moveComponent,
  '"use client";',
  "dog profile move control is a client component"
);
assertIncludes(
  moveComponent,
  'fetch("/api/kennel/runs"',
  "dog profile move control loads real Kennel Runs"
);
assertIncludes(
  moveComponent,
  'fetch("/api/kennel/dogs/run"',
  "dog profile move control calls the existing move API"
);
assertIncludes(
  moveComponent,
  'method: "PATCH"',
  "dog profile move control uses PATCH for moving dogs"
);
assertIncludes(
  moveComponent,
  "dogIds: [dogId]",
  "dog profile move control sends a single selected dog id"
);
assertIncludes(
  moveComponent,
  "targetRunId: selectedRunId",
  "dog profile move control sends the selected target run"
);
assertIncludes(
  moveComponent,
  "Current Run:",
  "dog profile move control displays the current Kennel Run"
);
assertIncludes(
  moveComponent,
  "Move to Run",
  "dog profile move control labels the run selector"
);
assertIncludes(
  moveComponent,
  "Move Dog",
  "dog profile move control exposes a Move Dog action"
);
assertIncludes(
  moveComponent,
  "Moved to",
  "dog profile move control shows move success feedback"
);
assertIncludes(
  moveComponent,
  "Failed to move dog.",
  "dog profile move control shows move failure feedback"
);
assertIncludes(
  moveComponent,
  "Unassigned",
  "dog profile move control handles a missing current Kennel Run defensively"
);
assertNotIncludes(
  moveComponent,
  "Create Run",
  "dog profile move control does not add create-run UI"
);
assertNotIncludes(
  moveComponent,
  "New Run",
  "dog profile move control does not add new-run UI"
);
assertNotIncludes(
  moveComponent,
  "Area",
  "dog profile move control does not reintroduce legacy Area wording"
);
assertNotIncludes(
  moveComponent,
  "Areas",
  "dog profile move control does not reintroduce legacy Areas wording"
);

console.log("Dog profile Kennel Run move checks passed.");
