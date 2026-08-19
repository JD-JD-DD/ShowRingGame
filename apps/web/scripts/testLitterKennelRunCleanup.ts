import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  deleteEmptyLitterRuns,
  deleteLitterRunIfEmpty,
} from "../server/services/kennelRun.service";

type Run = {
  id: string;
  kind: "UNCATEGORIZED" | "PLAYER" | "LITTER";
  sourceLitterId: string | null;
};

const runs = new Map<string, Run>([
  ["litter-empty", { id: "litter-empty", kind: "LITTER", sourceLitterId: "litter-a" }],
  ["litter-populated", { id: "litter-populated", kind: "LITTER", sourceLitterId: "litter-b" }],
  ["litter-renamed", { id: "litter-renamed", kind: "LITTER", sourceLitterId: "litter-c" }],
  ["litter-malformed", { id: "litter-malformed", kind: "LITTER", sourceLitterId: null }],
  ["player-empty", { id: "player-empty", kind: "PLAYER", sourceLitterId: null }],
  ["uncategorized", { id: "uncategorized", kind: "UNCATEGORIZED", sourceLitterId: null }],
]);
const dogCounts = new Map<string, number>([
  ["litter-populated", 1],
  ["litter-renamed", 1],
]);
let countCalls = 0;

const client = {
  kennelRun: {
    async findUnique(args: { where: { id: string } }) {
      return runs.get(args.where.id) ?? null;
    },
    async delete(args: { where: { id: string } }) {
      const run = runs.get(args.where.id);
      if (!run) throw { code: "P2025" };
      runs.delete(args.where.id);
      return run;
    },
    async deleteMany(args: {
      where: {
        id: { in: string[] };
        kind: "LITTER";
        sourceLitterId: { not: null };
        dogs: { none: Record<string, never> };
      };
    }) {
      const deleted = args.where.id.in.filter((id) => {
        const run = runs.get(id);
        return run?.kind === args.where.kind &&
          run.sourceLitterId !== null &&
          (dogCounts.get(id) ?? 0) === 0;
      });
      deleted.forEach((id) => runs.delete(id));
      return { count: deleted.length };
    },
  },
  dog: {
    async count(args: { where: { kennelRunId: string } }) {
      countCalls += 1;
      return dogCounts.get(args.where.kennelRunId) ?? 0;
    },
  },
};

async function main() {
  assert.equal(await deleteLitterRunIfEmpty({ priorRunId: "litter-empty", client: client as never }), true);
  assert.equal(runs.has("litter-empty"), false, "empty provenanced litter runs delete");
  assert.equal(await deleteLitterRunIfEmpty({ priorRunId: "litter-empty", client: client as never }), false, "missing runs are harmless no-ops");
  assert.equal(await deleteLitterRunIfEmpty({ priorRunId: "litter-populated", client: client as never }), false);
  assert.equal(runs.has("litter-populated"), true, "persisted dog references prevent cleanup");
  assert.equal(await deleteLitterRunIfEmpty({ priorRunId: "litter-renamed", client: client as never }), false);
  dogCounts.set("litter-renamed", 0);
  assert.equal(await deleteLitterRunIfEmpty({ priorRunId: "litter-renamed", client: client as never }), true, "rename does not affect provenance cleanup");
  assert.equal(await deleteLitterRunIfEmpty({ priorRunId: "litter-malformed", client: client as never }), false);
  assert.equal(await deleteLitterRunIfEmpty({ priorRunId: "player-empty", client: client as never }), false);
  assert.equal(await deleteLitterRunIfEmpty({ priorRunId: "uncategorized", client: client as never }), false);
  assert.ok(countCalls >= 3, "cleanup checks persisted Dog references");

  runs.set("litter-empty", { id: "litter-empty", kind: "LITTER", sourceLitterId: "litter-a" });
  assert.equal(
    await deleteEmptyLitterRuns({
      priorRunIds: ["litter-empty", "litter-populated", "player-empty", "litter-empty", null],
      client: client as never,
    }),
    1,
    "batch cleanup deduplicates source runs and only deletes empty provenanced litter runs"
  );
  assert.equal(runs.has("litter-empty"), false);
  assert.equal(runs.has("litter-populated"), true);
  assert.equal(runs.has("player-empty"), true);

  const runManagement = readFileSync("server/services/kennelRunManagement.service.ts", "utf8");
  const market = readFileSync("server/services/market.service.ts", "utf8");
  const rehome = readFileSync("server/services/rehome.service.ts", "utf8");
  const kennelRun = readFileSync("server/services/kennelRun.service.ts", "utf8");
  const lifecycle = readFileSync("server/services/lifecycle.service.ts", "utf8");
  assert.match(runManagement, /const sourceRunIds = new Set\([\s\S]*?deleteLitterRunIfEmpty/);
  assert.match(market, /priorRunId: listing\.dog\.kennelRunId/);
  assert.match(rehome, /dogs[\s\S]*?\.map\(\(dog\) => dog\.kennelRunId\)/);
  assert.match(rehome, /deleteEmptyLitterRuns/);
  assert.match(kennelRun, /dogs: \{ none: \{\} \}/);
  assert.doesNotMatch(lifecycle, /deleteLitterRunIfEmpty/);
  console.log("Bulk movement deduplicates source runs; sale and rehome clean prior runs.");
  console.log("Litter Kennel Run cleanup checks passed.");
}

void main();
