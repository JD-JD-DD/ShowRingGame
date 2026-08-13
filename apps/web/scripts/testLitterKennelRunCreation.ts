import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ensureLitterKennelRun,
  formatLitterKennelRunName,
} from "../server/services/kennelRun.service";

type FakeRun = {
  id: string;
  kennelId: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  kind: "UNCATEGORIZED" | "PLAYER" | "LITTER";
  sourceLitterId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const runs: FakeRun[] = [
  {
    id: "uncategorized",
    kennelId: "kennel-1",
    name: "Uncategorized",
    sortOrder: 0,
    isSystem: true,
    kind: "UNCATEGORIZED",
    sourceLitterId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "player-run",
    kennelId: "kennel-1",
    name: "GS2222222",
    sortOrder: 1,
    isSystem: false,
    kind: "PLAYER",
    sourceLitterId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
];
let creates = 0;

const client = {
  kennelRun: {
    async findUnique(args: {
      where:
        | { sourceLitterId: string }
        | { kennelId_name: { kennelId: string; name: string } };
    }) {
      if ("sourceLitterId" in args.where) {
        const sourceLitterId = args.where.sourceLitterId;
        return (
          runs.find((run) => run.sourceLitterId === sourceLitterId) ??
          null
        );
      }

      const { kennelId, name } = args.where.kennelId_name;
      return runs.find((run) => run.kennelId === kennelId && run.name === name) ?? null;
    },
    async findFirst() {
      return [...runs].sort((left, right) => right.sortOrder - left.sortOrder)[0] ?? null;
    },
    async create(args: { data: Omit<FakeRun, "id" | "createdAt" | "updatedAt"> }) {
      creates += 1;
      const created: FakeRun = {
        ...args.data,
        id: `litter-run-${creates}`,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
      runs.push(created);
      return created;
    },
  },
};

async function main() {
  assert.equal(formatLitterKennelRunName({ breedCode2: "GS", serial7: "1234567" }), "GS1234567");

  const ordinaryRun = await ensureLitterKennelRun({
    client: client as never,
    kennelId: "kennel-1",
    litterId: "ordinary-litter",
    breedCode2: "GS",
    serial7: "1234567",
  });
  assert.deepEqual(
    {
      kennelId: ordinaryRun.kennelId,
      name: ordinaryRun.name,
      kind: ordinaryRun.kind,
      sourceLitterId: ordinaryRun.sourceLitterId,
      isSystem: ordinaryRun.isSystem,
    },
    {
      kennelId: "kennel-1",
      name: "GS1234567",
      kind: "LITTER",
      sourceLitterId: "ordinary-litter",
      isSystem: false,
    }
  );
  assert.equal(ordinaryRun.sortOrder, 2, "litter runs append without reordering existing runs");

  const ordinaryRetry = await ensureLitterKennelRun({
    client: client as never,
    kennelId: "kennel-1",
    litterId: "ordinary-litter",
    breedCode2: "GS",
    serial7: "0000000",
  });
  assert.equal(ordinaryRetry.id, ordinaryRun.id, "sourceLitterId makes ordinary retries idempotent");
  assert.equal(creates, 1, "ordinary retry cannot create a second litter run");

  const emergencyRun = await ensureLitterKennelRun({
    client: client as never,
    kennelId: "kennel-1",
    litterId: "emergency-litter",
    breedCode2: "GS",
    serial7: "7654321",
  });
  assert.equal(emergencyRun.name, "GS7654321", "emergency runs use the same canonical litter ID");
  assert.equal(emergencyRun.sourceLitterId, "emergency-litter");

  const playerRun = runs.find((run) => run.id === "player-run");
  assert.ok(playerRun, "player run exists");
  await assert.rejects(
    ensureLitterKennelRun({
      client: client as never,
      kennelId: "kennel-1",
      litterId: "conflicting-litter",
      breedCode2: "GS",
      serial7: "2222222",
    }),
    /already in use/
  );
  assert.deepEqual(playerRun, runs.find((run) => run.id === "player-run"), "name conflicts cannot mutate or hijack player runs");

  const breedingService = readFileSync("server/services/breeding.service.ts", "utf8");
  const emergencyService = readFileSync("server/services/reproductiveEmergencyResolution.service.ts", "utf8");
  assert.match(breedingService, /await tx\.dog\.createMany\([\s\S]*?ensureLitterKennelRun/);
  assert.match(emergencyService, /await tx\.dog\.createMany\([\s\S]*?ensureLitterKennelRun/);
  assert.match(breedingService, /persistedLitter\.puppies\.length > 0/);
  assert.match(emergencyService, /persistedLitter\.puppies\.length > 0/);
  assert.match(breedingService, /kennelRunId: puppyKennelRunId/);
  assert.match(emergencyService, /kennelRunId,/);
  assert.doesNotMatch(breedingService, /kind:\s*"LITTER"/);
  assert.doesNotMatch(emergencyService, /kind:\s*"LITTER"/);

  console.log("Litter Kennel Run creation checks passed.");
}

void main();
