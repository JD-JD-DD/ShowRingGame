import { strict as assert } from "node:assert";

import {
  BulkHealthTestPreviewError,
  previewBulkPhenotypeHealthTestsForKennel,
} from "../server/services/healthTest.service";
import {
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
} from "@showring/rules";

type PreviewDog = {
  id: string;
  ownerKennelId: string | null;
  lifecycleState: string;
  birthEpoch: number;
  breedCode2: string;
  healthTests: Array<{ testTypeCode: string }>;
};

function createPreviewClient(dogs: PreviewDog[]) {
  let findManyCalls = 0;

  return {
    client: {
      dog: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          findManyCalls += 1;
          const ids = new Set(where.id.in);
          return dogs.filter((dog) => ids.has(dog.id));
        },
      },
    },
    getFindManyCalls: () => findManyCalls,
  };
}

const adultDog = (overrides: Partial<PreviewDog> = {}): PreviewDog => ({
  id: "adult",
  ownerKennelId: "kennel-1",
  lifecycleState: "ALIVE",
  birthEpoch: 0,
  breedCode2: "LAB",
  healthTests: [],
  ...overrides,
});

async function preview(dogs: PreviewDog[], args: {
  dogIds: unknown;
  selection: unknown;
}) {
  const fake = createPreviewClient(dogs);
  const result = await previewBulkPhenotypeHealthTestsForKennel({
    kennelId: "kennel-1",
    dogIds: args.dogIds,
    selection: args.selection,
    currentEpoch: 1_000,
    client: fake.client as never,
  });

  return { result, fake };
}

async function main() {
  {
    const { result, fake } = await preview([adultDog()], {
      dogIds: ["adult", "adult"],
      selection: { mode: "explicit", testTypeCodes: ["HIP_DYSPLASIA"] },
    });

    assert.equal(result.selectedDogCount, 1, "duplicate dog IDs are deduplicated");
    assert.equal(result.eligibleDogCount, 1);
    assert.equal(result.runnableTestCount, 1);
    assert.equal(result.estimatedTotalCost, PHENOTYPE_HEALTH_TESTS.HIP_DYSPLASIA.fee);
    assert.equal(result.byTest.HIP_DYSPLASIA.runnableCount, 1);
    assert.equal(fake.getFindManyCalls(), 1, "preview loads the cohort in one set query");
  }

  {
    const { result } = await preview([adultDog()], {
      dogIds: ["adult"],
      selection: {
        mode: "explicit",
        testTypeCodes: ["CARDIAC", "THYROID"],
      },
    });

    assert.equal(result.runnableTestCount, 2, "explicit multiple tests are evaluated");
    assert.equal(
      result.estimatedTotalCost,
      PHENOTYPE_HEALTH_TESTS.CARDIAC.fee + PHENOTYPE_HEALTH_TESTS.THYROID.fee,
      "explicit quote uses canonical per-test fees"
    );
  }

  {
    const { result } = await preview([adultDog(), adultDog({ id: "adult-2" })], {
      dogIds: ["adult", "adult-2"],
      selection: { mode: "all-applicable" },
    });
    const oneDogCost = PHENOTYPE_HEALTH_TEST_CODES.reduce(
      (total, code) => total + PHENOTYPE_HEALTH_TESTS[code].fee,
      0
    );

    assert.equal(result.eligibleDogCount, 2);
    assert.equal(result.runnableTestCount, PHENOTYPE_HEALTH_TEST_CODES.length * 2);
    assert.equal(result.estimatedTotalCost, oneDogCost * 2);
  }

  {
    const { result } = await preview([
      adultDog({ healthTests: [{ testTypeCode: "HIP_DYSPLASIA" }] }),
    ], {
      dogIds: ["adult"],
      selection: {
        mode: "explicit",
        testTypeCodes: ["HIP_DYSPLASIA", "CARDIAC"],
      },
    });

    assert.equal(result.eligibleDogCount, 1, "a partially completed dog remains eligible");
    assert.equal(result.runnableTestCount, 1);
    assert.equal(result.skippedByReason.ALREADY_COMPLETED, 1);
    assert.equal(result.byTest.CARDIAC.runnableCount, 1);
  }

  {
    const { result } = await preview([
      adultDog({ id: "young", birthEpoch: 990 }),
      adultDog({ id: "dead", lifecycleState: "DECEASED" }),
      adultDog({ id: "other", ownerKennelId: "kennel-2" }),
    ], {
      dogIds: ["young", "dead", "other", "missing"],
      selection: { mode: "explicit", testTypeCodes: ["HIP_DYSPLASIA"] },
    });

    assert.equal(result.estimatedTotalCost, 0, "fully skipped cohorts have no cost");
    assert.equal(result.skippedByReason.TOO_YOUNG, 1);
    assert.equal(result.skippedByReason.NOT_ALIVE, 1);
    assert.equal(result.skippedByReason.NOT_OWNED_OR_NOT_FOUND, 2);
  }

  for (const testTypeCodes of [["BRUCELLOSIS"], ["UNKNOWN"], []]) {
    await assert.rejects(
      () => preview([adultDog()], {
        dogIds: ["adult"],
        selection: { mode: "explicit", testTypeCodes },
      }),
      (error) => error instanceof BulkHealthTestPreviewError,
      "unsupported, brucellosis, and empty explicit selections are rejected"
    );
  }
}

void main().then(() => {
  console.log("Bulk health test preview checks passed.");
});
