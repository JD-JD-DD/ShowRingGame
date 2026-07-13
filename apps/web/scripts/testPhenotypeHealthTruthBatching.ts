import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  generateFoundationPhenotypeHealthTruths,
  inheritPhenotypeHealthTruths,
  PHENOTYPE_HEALTH_TEST_CODES,
  type PhenotypeHealthTruth,
} from "@showring/rules";

import {
  createDeterministicPhenotypeHealthRandom,
  ensurePhenotypeHealthTruthsForDogs,
} from "../server/services/healthTest.service";

type DogRow = {
  id: string;
  sireId: string | null;
  damId: string | null;
  coiPercent: number | null;
};

type TruthRow = {
  dogId: string;
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

function buildFoundationTruths(dogId: string): PhenotypeHealthTruth[] {
  return generateFoundationPhenotypeHealthTruths(
    createDeterministicPhenotypeHealthRandom(dogId)
  );
}

function toTruthRows(dogId: string, truths: PhenotypeHealthTruth[]): TruthRow[] {
  return truths.map((truth) => ({
    dogId,
    conditionCode: truth.conditionCode,
    geneticLiability: truth.geneticLiability,
    environmentModifier: truth.environmentModifier,
  }));
}

function truthSignature(truths: TruthRow[]): string[] {
  return truths
    .map(
      (truth) =>
        `${truth.dogId}:${truth.conditionCode}:${truth.geneticLiability}:${truth.environmentModifier}`
    )
    .sort();
}

function truthCountForDog(truths: TruthRow[], dogId: string): number {
  return truths.filter((truth) => truth.dogId === dogId).length;
}

function truthByDogAndCode(
  truths: TruthRow[],
  dogId: string,
  code: string
): TruthRow | undefined {
  return truths.find(
    (truth) => truth.dogId === dogId && truth.conditionCode === code
  );
}

type FakeHealthClient = {
  dogs: DogRow[];
  truths: TruthRow[];
  dogFindManyCalls: number;
  truthFindManyCalls: number;
  truthCreateManyCalls: number;
  createdRows: TruthRow[];
  dog: {
    findMany: (args: {
      where: { id: { in: string[] } };
    }) => Promise<DogRow[]>;
  };
  dogHealthConditionTruth: {
    findMany: (args: {
      where: {
        dogId: { in: string[] };
        conditionCode: { in: readonly string[] };
      };
    }) => Promise<TruthRow[]>;
    createMany: (args: {
      data: TruthRow[];
      skipDuplicates?: boolean;
    }) => Promise<{ count: number }>;
  };
};

function createFakeHealthClient(args: {
  dogs: DogRow[];
  truths?: TruthRow[];
}): FakeHealthClient {
  const client: FakeHealthClient = {
    dogs: [...args.dogs],
    truths: [...(args.truths ?? [])],
    dogFindManyCalls: 0,
    truthFindManyCalls: 0,
    truthCreateManyCalls: 0,
    createdRows: [],
    dog: {
      findMany: async ({ where }) => {
        client.dogFindManyCalls += 1;
        const ids = new Set(where.id.in);
        return client.dogs
          .filter((dog) => ids.has(dog.id))
          .map((dog) => ({
            id: dog.id,
            sireId: dog.sireId,
            damId: dog.damId,
            coiPercent: dog.coiPercent,
          }));
      },
    },
    dogHealthConditionTruth: {
      findMany: async ({ where }) => {
        client.truthFindManyCalls += 1;
        const dogIds = new Set(where.dogId.in);
        const conditionCodes = new Set(where.conditionCode.in);
        return client.truths
          .filter(
            (truth) =>
              dogIds.has(truth.dogId) && conditionCodes.has(truth.conditionCode)
          )
          .map((truth) => ({ ...truth }));
      },
      createMany: async ({ data, skipDuplicates }) => {
        client.truthCreateManyCalls += 1;
        await Promise.resolve();

        let count = 0;

        for (const row of data) {
          const exists = client.truths.some(
            (truth) =>
              truth.dogId === row.dogId &&
              truth.conditionCode === row.conditionCode
          );

          if (exists && skipDuplicates) {
            continue;
          }

          if (exists) {
            throw new Error("Duplicate truth row would violate uniqueness.");
          }

          const nextRow = { ...row };
          client.truths.push(nextRow);
          client.createdRows.push(nextRow);
          count += 1;
        }

        return { count };
      },
    },
  };

  return client;
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const healthServiceSource = readFileSync(
    path.join(repoRoot, "apps/web/server/services/healthTest.service.ts"),
    "utf8"
  );
  const mineRouteSource = readFileSync(
    path.join(repoRoot, "apps/web/app/api/dogs/mine/route.ts"),
    "utf8"
  );
  const ensureSection =
    healthServiceSource.match(
      /export async function ensurePhenotypeHealthTruthsForDogs[\s\S]*?^}\n\nexport async function runPhenotypeHealthTestForKennel/m
    )?.[0] ?? "";

  assert.ok(
    ensureSection.includes("const existingTruthRows = await client.dogHealthConditionTruth.findMany({"),
    "batch helper loads existing truth rows in one bounded query"
  );
  assert.ok(
    ensureSection.includes("const dogsById = await loadPhenotypeHealthPedigree(client, uniqueDogIds);"),
    "batch helper loads required dog and parent inputs ahead of repair"
  );
  assert.ok(
    ensureSection.includes("await client.dogHealthConditionTruth.createMany({"),
    "batch helper writes missing truths through a bulk create"
  );
  assert.ok(
    !ensureSection.includes("findUnique({"),
    "batch helper no longer performs per-dog findUnique reads"
  );
  assert.ok(
    mineRouteSource.includes("ensurePhenotypeHealthTruthsForDogs(db, dogIds)"),
    "kennel roster still uses the automatic phenotype truth repair helper"
  );
  for (const field of [
    "dogId:",
    "callName:",
    "registeredName:",
    "regNumber:",
    "breedCode2:",
    "breedName:",
    "healthBadgeStatus:",
    "groomingStatus:",
    "visibleCategories:",
    "breedingCardStatus:",
  ]) {
    assert.ok(
      mineRouteSource.includes(field),
      `kennel roster response shape still includes ${field}`
    );
  }

  {
    const fullTruths = buildFoundationTruths("complete-dog");
    const client = createFakeHealthClient({
      dogs: [{ id: "complete-dog", sireId: null, damId: null, coiPercent: null }],
      truths: toTruthRows("complete-dog", fullTruths),
    });
    const beforeSignature = truthSignature(client.truths);

    await ensurePhenotypeHealthTruthsForDogs(client as never, ["complete-dog"]);

    assert.deepEqual(
      truthSignature(client.truths),
      beforeSignature,
      "complete dogs do not receive duplicate truth rows"
    );
    assert.equal(
      client.truthCreateManyCalls,
      0,
      "complete dogs require no write"
    );
  }

  {
    const fullTruths = buildFoundationTruths("partial-dog");
    const missingCode = PHENOTYPE_HEALTH_TEST_CODES[0];
    const partialTruths = toTruthRows(
      "partial-dog",
      fullTruths.filter((truth) => truth.conditionCode !== missingCode)
    );
    const client = createFakeHealthClient({
      dogs: [{ id: "partial-dog", sireId: null, damId: null, coiPercent: null }],
      truths: partialTruths,
    });

    await ensurePhenotypeHealthTruthsForDogs(client as never, ["partial-dog"]);

    assert.equal(
      truthCountForDog(client.truths, "partial-dog"),
      PHENOTYPE_HEALTH_TEST_CODES.length,
      "partial legacy dogs are repaired back to a full truth set"
    );
    assert.equal(
      client.createdRows.length,
      1,
      "repair inserts only the single missing truth row"
    );
    assert.equal(
      client.createdRows[0]?.conditionCode,
      missingCode,
      "repair writes only the missing phenotype condition code"
    );
  }

  {
    const dogIds = ["dog-a", "dog-b", "dog-c", "dog-d"];
    const client = createFakeHealthClient({
      dogs: dogIds.map((id) => ({
        id,
        sireId: null,
        damId: null,
        coiPercent: null,
      })),
      truths: toTruthRows("dog-a", buildFoundationTruths("dog-a")),
    });

    await ensurePhenotypeHealthTruthsForDogs(client as never, dogIds);

    for (const dogId of dogIds) {
      assert.equal(
        truthCountForDog(client.truths, dogId),
        PHENOTYPE_HEALTH_TEST_CODES.length,
        `batch repair completes all truths for ${dogId}`
      );
    }
    assert.equal(
      client.dogFindManyCalls,
      1,
      "foundation-only batch repair uses one dog query regardless of dog count"
    );
    assert.equal(
      client.truthFindManyCalls,
      1,
      "foundation-only batch repair uses one truth query regardless of dog count"
    );
    assert.equal(
      client.truthCreateManyCalls,
      1,
      "foundation-only batch repair writes missing truths in one bulk create"
    );
  }

  {
    const sireTruths = buildFoundationTruths("sire");
    const damTruths = buildFoundationTruths("dam");
    const expectedChildTruths = inheritPhenotypeHealthTruths({
      sireTruths,
      damTruths,
      coiPercent: 12.5,
      random01: createDeterministicPhenotypeHealthRandom("child"),
    });
    const client = createFakeHealthClient({
      dogs: [
        { id: "child", sireId: "sire", damId: "dam", coiPercent: 12.5 },
        { id: "sire", sireId: null, damId: null, coiPercent: null },
        { id: "dam", sireId: null, damId: null, coiPercent: null },
      ],
      truths: [
        ...toTruthRows("sire", sireTruths),
        ...toTruthRows("dam", damTruths),
      ],
    });

    await ensurePhenotypeHealthTruthsForDogs(client as never, ["child"]);

    const actualChildTruths = PHENOTYPE_HEALTH_TEST_CODES.map((code) => {
      const truth = truthByDogAndCode(client.truths, "child", code);
      assert.ok(truth, `child truth exists for ${code}`);
      return {
        conditionCode: truth.conditionCode,
        geneticLiability: truth.geneticLiability,
        environmentModifier: truth.environmentModifier,
      };
    });

    assert.deepEqual(
      actualChildTruths,
      expectedChildTruths,
      "parent-dependent truth generation remains deterministic and correct"
    );
  }

  {
    const client = createFakeHealthClient({
      dogs: [
        { id: "repeat-a", sireId: null, damId: null, coiPercent: null },
        { id: "repeat-b", sireId: null, damId: null, coiPercent: null },
      ],
    });

    await ensurePhenotypeHealthTruthsForDogs(client as never, [
      "repeat-a",
      "repeat-b",
    ]);
    const afterFirstCount = client.truths.length;
    await ensurePhenotypeHealthTruthsForDogs(client as never, [
      "repeat-a",
      "repeat-b",
    ]);
    const afterSecondCount = client.truths.length;

    assert.equal(
      afterSecondCount,
      afterFirstCount,
      "repeated batch calls remain idempotent"
    );
  }

  {
    const client = createFakeHealthClient({
      dogs: [{ id: "concurrent-dog", sireId: null, damId: null, coiPercent: null }],
    });

    await Promise.all([
      ensurePhenotypeHealthTruthsForDogs(client as never, ["concurrent-dog"]),
      ensurePhenotypeHealthTruthsForDogs(client as never, ["concurrent-dog"]),
    ]);

    assert.equal(
      truthCountForDog(client.truths, "concurrent-dog"),
      PHENOTYPE_HEALTH_TEST_CODES.length,
      "concurrent repair calls remain uniqueness-safe"
    );
  }

  console.log("Phenotype health truth batching checks passed.");
}

void main();
