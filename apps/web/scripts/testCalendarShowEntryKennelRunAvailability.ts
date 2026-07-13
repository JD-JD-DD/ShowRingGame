import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildShowEntryAvailabilityOptionSnapshots,
  buildShowEntryKennelRunOptionsFromSnapshots,
} from "../server/services/showEntry.service";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

const currentEpoch = 1_000;
const cluster = {
  id: "cluster-current",
  startEpoch: 900,
  entryOpenEpoch: 0,
  entryCloseEpoch: 2_000,
  status: "ENTRY_OPEN",
  showDays: [
    { id: "day-1", status: "ENTRY_OPEN", scheduledEpoch: 1_200 },
    { id: "day-2", status: "ENTRY_OPEN", scheduledEpoch: 1_260 },
  ],
};

const runs = [
  { id: "run-a", name: "Alpha", dogCount: 99, isSystem: false },
  { id: "run-b", name: "Bravo", dogCount: 99, isSystem: false },
  { id: "run-c", name: "Charlie", dogCount: 99, isSystem: false },
  { id: "uncat", name: "Uncategorized", dogCount: 99, isSystem: true },
];

function makeDog(args: {
  id: string;
  breedCode2?: string;
  kennelRunId?: string | null;
  birthEpoch?: number;
  lifecycleState?: "ALIVE" | "DEAD";
  marketState?: string;
  pendingEmergency?: boolean;
  pregnant?: boolean;
}): unknown {
  return {
    id: args.id,
    ownerKennelId: "kennel-1",
    lifecycleState: args.lifecycleState ?? "ALIVE",
    marketState: args.marketState ?? "OWNED",
    breedCode2: args.breedCode2 ?? "AA",
    kennelRunId: args.kennelRunId ?? null,
    birthEpoch: args.birthEpoch ?? 700,
    breedingAttemptsAsDam: args.pregnant ? [{ status: "PREGNANT", whelpedEpoch: null }] : [],
    emergencyCareEvents: args.pendingEmergency ? [{ id: `event-${args.id}` }] : [],
  };
}

const dogs = [
  makeDog({ id: "alpha-available-1", kennelRunId: "run-a", breedCode2: "AA" }),
  makeDog({ id: "alpha-available-2", kennelRunId: "run-a", breedCode2: "BB" }),
  makeDog({
    id: "alpha-conflict",
    kennelRunId: "run-a",
    breedCode2: "AA",
    pregnant: true,
  }),
  makeDog({ id: "bravo-conflict-1", kennelRunId: "run-b", breedCode2: "CC" }),
  makeDog({ id: "bravo-conflict-2", kennelRunId: "run-b", breedCode2: "CC" }),
  makeDog({
    id: "charlie-ineligible",
    kennelRunId: "run-c",
    breedCode2: "DD",
    birthEpoch: 1_150,
  }),
  makeDog({ id: "uncat-available", kennelRunId: null, breedCode2: "EE" }),
  makeDog({
    id: "uncat-conflict",
    kennelRunId: null,
    breedCode2: "EE",
    pregnant: true,
  }),
  makeDog({
    id: "breed-emergency",
    kennelRunId: "run-a",
    breedCode2: "FF",
    pendingEmergency: true,
    birthEpoch: 1_150,
  }),
  makeDog({
    id: "one-day-only",
    kennelRunId: "run-c",
    breedCode2: "GG",
    birthEpoch: 1_078,
  }),
] as Parameters<typeof buildShowEntryAvailabilityOptionSnapshots>[0]["dogs"];

const weekendConflictDogIds = new Set([
  "alpha-conflict",
  "bravo-conflict-1",
  "bravo-conflict-2",
  "uncat-conflict",
]);

const availabilitySnapshots = buildShowEntryAvailabilityOptionSnapshots({
  dogs,
  cluster,
  weekendConflictDogIds,
  currentEpoch,
});

const kennelRunOptions = buildShowEntryKennelRunOptionsFromSnapshots({
  runs,
  availabilitySnapshots,
  uncategorizedRunId: "uncat",
});

const breedCounts = new Map<string, number>();
for (const snapshot of availabilitySnapshots) {
  if (!snapshot.isCurrentlyAvailable) {
    continue;
  }

  breedCounts.set(
    snapshot.breedCode2,
    (breedCounts.get(snapshot.breedCode2) ?? 0) + 1
  );
}

assert.equal(
  kennelRunOptions.find((run) => run.id === "run-a")?.dogCount,
  3,
  "run with at least one available dog remains listed and counts only currently available dogs"
);
assert.equal(
  kennelRunOptions.some((run) => run.id === "run-b"),
  false,
  "run whose dogs are all entered in another weekend cluster is omitted"
);
assert.equal(
  kennelRunOptions.find((run) => run.id === "run-c")?.dogCount,
  1,
  "dog eligible for only one open day keeps its run listed"
);
assert.equal(
  kennelRunOptions.some((run) => run.id === "uncat"),
  true,
  "Uncategorized remains listed when an unassigned dog is currently available"
);

const fullyUnavailableOptions = buildShowEntryKennelRunOptionsFromSnapshots({
  runs,
  availabilitySnapshots: availabilitySnapshots.map((snapshot) =>
    snapshot.kennelRunId === "run-c" || snapshot.kennelRunId == null
      ? { ...snapshot, isCurrentlyAvailable: false, eligibleShowDayIds: [] }
      : snapshot
  ),
  uncategorizedRunId: "uncat",
});

assert.equal(
  fullyUnavailableOptions.some((run) => run.id === "run-c"),
  false,
  "run whose dogs are all otherwise ineligible is omitted"
);
assert.equal(
  fullyUnavailableOptions.some((run) => run.id === "uncat"),
  false,
  "Uncategorized is omitted when it has zero available dogs"
);
assert.equal(
  breedCounts.get("FF"),
  1,
  "breed selector behavior remains unchanged for emergency-only availability"
);

const pageSource = source("apps/web/app/shows/[showId]/page.tsx");
const serviceSource = source("apps/web/server/services/showEntry.service.ts");

assert.ok(
  pageSource.includes("showId: cluster.id"),
  "show page passes the current cluster id into kennel-run option loading"
);
assert.ok(
  serviceSource.includes("buildShowEntryAvailabilityOptionSnapshots"),
  "show entry options share the canonical dog-level availability snapshot"
);
assert.ok(
  serviceSource.includes("snapshot.kennelRunId ?? args.uncategorizedRunId"),
  "legacy unassigned dogs are counted toward Uncategorized availability"
);
assert.ok(
  serviceSource.includes(".filter((run) => run.dogCount > 0)"),
  "zero-availability kennel runs are omitted from the selector"
);

console.log("Calendar kennel-run availability checks passed.");
