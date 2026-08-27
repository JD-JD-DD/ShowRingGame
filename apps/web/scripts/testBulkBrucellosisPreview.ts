import { strict as assert } from "node:assert";

import {
  previewBulkBrucellosisScreeningForKennel,
} from "../server/services/infectiousDisease.service";
import { BRUCELLOSIS_TEST_FEE } from "@showring/rules";

type PreviewDog = {
  id: string;
  ownerKennelId: string | null;
  lifecycleState: string;
};

function createPreviewClient(dogs: PreviewDog[]) {
  return {
    dog: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        const ids = new Set(where.id.in);
        return dogs.filter((dog) => ids.has(dog.id));
      },
    },
  };
}

async function preview(dogs: PreviewDog[], dogIds: unknown) {
  return previewBulkBrucellosisScreeningForKennel({
    kennelId: "kennel-1",
    dogIds,
    client: createPreviewClient(dogs) as never,
  });
}

async function main() {
  const aliveDog: PreviewDog = {
    id: "alive",
    ownerKennelId: "kennel-1",
    lifecycleState: "ALIVE",
  };

  {
    const result = await preview([aliveDog], ["alive", "alive"]);
    assert.equal(result.selectedDogCount, 1, "duplicate IDs are deduplicated");
    assert.equal(result.screenableDogCount, 1);
    assert.equal(result.skippedDogCount, 0);
    assert.equal(result.estimatedTotalCost, BRUCELLOSIS_TEST_FEE);
  }

  {
    const result = await preview(
      [aliveDog, { ...aliveDog, id: "alive-2" }],
      ["alive", "alive-2"]
    );
    assert.equal(result.screenableDogCount, 2);
    assert.equal(result.estimatedTotalCost, BRUCELLOSIS_TEST_FEE * 2);
  }

  {
    const result = await preview(
      [
        aliveDog,
        { ...aliveDog, id: "dead", lifecycleState: "DECEASED" },
        { ...aliveDog, id: "other", ownerKennelId: "kennel-2" },
      ],
      ["alive", "dead", "other", "missing"]
    );
    assert.equal(result.screenableDogCount, 1);
    assert.equal(result.skippedDogCount, 3);
    assert.equal(result.skippedByReason.NOT_ALIVE, 1);
    assert.equal(result.skippedByReason.NOT_OWNED_OR_NOT_FOUND, 2);
    assert.equal(result.estimatedTotalCost, BRUCELLOSIS_TEST_FEE);
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        "estimatedTotalCost",
        "screenableDogCount",
        "selectedDogCount",
        "skippedByReason",
        "skippedDogCount",
      ],
      "preview contains no disease status or result information"
    );
  }

  {
    const result = await preview(
      [{ ...aliveDog, id: "young", lifecycleState: "ALIVE" }],
      ["young"]
    );
    assert.equal(result.screenableDogCount, 1, "preview has no maturity gate");
  }

  {
    const result = await preview(
      [{ ...aliveDog, id: "previously-screened" }],
      ["previously-screened"]
    );
    assert.equal(
      result.screenableDogCount,
      1,
      "previous screening, including a current negative, does not affect preview eligibility"
    );
  }

  {
    const result = await preview(
      [
        { ...aliveDog, id: "dead-only", lifecycleState: "DECEASED" },
        { ...aliveDog, id: "other-only", ownerKennelId: "kennel-2" },
      ],
      ["dead-only", "other-only"]
    );
    assert.equal(result.screenableDogCount, 0, "fully skipped cohorts are valid quotes");
    assert.equal(result.skippedDogCount, 2);
    assert.equal(result.estimatedTotalCost, 0);
  }
}

void main().then(() => {
  console.log("Bulk brucellosis preview checks passed.");
});
