import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import { COI_CALCULATION_MAX_GENERATIONS } from "@showring/rules";
import { loadPlannerPedigreeClosure } from "../server/services/breeding.service";

type PedigreeRow = {
  id: string;
  sireId: string | null;
  damId: string | null;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
};

function row(
  id: string,
  sireId: string | null = null,
  damId: string | null = null
): PedigreeRow {
  return {
    id,
    sireId,
    damId,
    callName: `Call ${id}`,
    registeredName: `Registered ${id}`,
    regNumber: `REG-${id}`,
    visibleTitlePrefix: null,
    visibleTitleSuffix: null,
  };
}

function createClient(rows: PedigreeRow[]) {
  const byId = new Map(rows.map((item) => [item.id, item]));
  const frontiers: string[][] = [];

  return {
    frontiers,
    client: {
      dog: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          frontiers.push([...where.id.in]);
          return where.id.in.flatMap((id) => {
            const item = byId.get(id);
            return item ? [{ ...item }] : [];
          });
        },
      },
    },
  };
}

async function main() {
  {
    const rows = [row("owned", "owned-sire"), row("public", "shared"), row("owned-sire", "shared"), row("shared")];
    const fixture = createClient(rows);
    const pedigree = await loadPlannerPedigreeClosure(fixture.client as never, [
      "owned",
      "public",
      "owned",
    ]);

    assert.deepEqual(fixture.frontiers, [
      ["owned", "public"],
      ["owned-sire", "shared"],
    ], "owned and public planner dogs seed deduplicated pedigree frontiers");
    assert.deepEqual(
      pedigree.map((dog) => dog.id).sort(),
      ["owned", "owned-sire", "public", "shared"],
      "closure contains only planner dogs and reachable ancestors"
    );
    assert.equal(
      pedigree.filter((dog) => dog.id === "shared").length,
      1,
      "repeated ancestors are loaded once"
    );
  }

  {
    const rows = Array.from(
      { length: COI_CALCULATION_MAX_GENERATIONS + 1 },
      (_, generation) => row(`g${generation}`, generation < COI_CALCULATION_MAX_GENERATIONS ? `g${generation + 1}` : null)
    );
    const fixture = createClient(rows);
    const pedigree = await loadPlannerPedigreeClosure(fixture.client as never, ["g0"]);

    assert.equal(
      fixture.frontiers.length,
      COI_CALCULATION_MAX_GENERATIONS,
      "closure uses one query per configured COI generation"
    );
    assert.equal(pedigree.length, COI_CALCULATION_MAX_GENERATIONS, "closure preserves the configured COI depth");
    assert.ok(!pedigree.some((dog) => dog.id === `g${COI_CALCULATION_MAX_GENERATIONS}`), "ancestor beyond the COI depth remains a founder boundary");
  }

  {
    const fixture = createClient([row("sparse", null, "known-parent"), row("known-parent")]);
    const pedigree = await loadPlannerPedigreeClosure(fixture.client as never, ["sparse"]);

    assert.deepEqual(pedigree.map((dog) => dog.id), ["sparse", "known-parent"], "missing parent chains retain known pedigree data without extra work");
  }

  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const plannerSource = readFileSync(
    path.join(repoRoot, "apps/web/components/breeding/BreedingPlannerPage.tsx"),
    "utf8"
  );
  const breedingServiceSource = readFileSync(
    path.join(repoRoot, "apps/web/server/services/breeding.service.ts"),
    "utf8"
  );
  const plannerClosureSection = breedingServiceSource.slice(
    breedingServiceSource.indexOf("export async function loadPlannerPedigreeClosure("),
    breedingServiceSource.indexOf("function getAgeHours(")
  );

  assert.ok(plannerSource.includes("loadPlannerPedigreeClosure(db, pedigreePlannerDogIds)"), "planner uses the bounded pedigree closure loader");
  assert.ok(!plannerSource.includes("action: () =>\n          db.dog.findMany({"), "planner no longer issues an unfiltered pedigree Dog.findMany");
  assert.ok(breedingServiceSource.includes("generation < COI_CALCULATION_MAX_GENERATIONS"), "planner closure shares the canonical COI generation limit");
  assert.ok(!plannerClosureSection.includes("traitHead: true"), "planner pedigree closure does not load hidden genetic trait data");

  console.log("Breeding planner pedigree closure checks passed.");
}

void main();
