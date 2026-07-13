import { strict as assert } from "node:assert";

import { Prisma, PrismaClient } from "@prisma/client";

import { formatDogDisplayName } from "../lib/dogNames";

const db = new PrismaClient();

function visibleToKennelWhere(kennelId: string) {
  return {
    OR: [
      { bredByKennelId: kennelId },
      {
        sire: {
          ownerKennelId: kennelId,
        },
      },
      {
        puppies: {
          some: {
            ownerKennelId: kennelId,
          },
        },
      },
    ],
  };
}

const legacyListSelect = Prisma.validator<Prisma.LitterSelect>()({
  id: true,
  breedCode2: true,
  serial7: true,
  bornEpoch: true,
  pupCount: true,
  createdAt: true,
  breed: {
    select: {
      name: true,
    },
  },
  sire: {
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
    },
  },
  dam: {
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
    },
  },
  bredByKennel: {
    select: {
      name: true,
    },
  },
  puppies: {
    orderBy: [{ litterOrder: "asc" }, { regNumber: "asc" }],
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
      visibilityState: true,
      litterOrder: true,
      traitHead: true,
      traitForequarters: true,
      traitHindquarters: true,
      traitGait: true,
      traitCoat: true,
      traitSize: true,
      traitTemperament: true,
      traitShowShine: true,
      traitFeet: true,
      traitTopline: true,
      healthConditionTruths: {
        select: {
          conditionCode: true,
          geneticLiability: true,
          environmentModifier: true,
        },
      },
      healthTests: {
        select: {
          testTypeCode: true,
          resultCode: true,
        },
      },
    },
  },
});

const narrowListSelect = Prisma.validator<Prisma.LitterSelect>()({
  id: true,
  breedCode2: true,
  serial7: true,
  bornEpoch: true,
  pupCount: true,
  createdAt: true,
  breed: {
    select: {
      name: true,
    },
  },
  sire: {
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
    },
  },
  dam: {
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
    },
  },
  bredByKennel: {
    select: {
      name: true,
    },
  },
  puppies: {
    orderBy: [{ litterOrder: "asc" }, { regNumber: "asc" }],
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
      visibilityState: true,
      litterOrder: true,
    },
  },
});

type LegacyLitter = Prisma.LitterGetPayload<{ select: typeof legacyListSelect }>;
type NarrowLitter = Prisma.LitterGetPayload<{ select: typeof narrowListSelect }>;

function mapListShape(litter: LegacyLitter | NarrowLitter) {
  const visiblePuppies = litter.puppies.filter(
    (puppy) => puppy.visibilityState !== "HIDDEN_NEONATAL_LOSS"
  );

  return {
    litterId: litter.id,
    pupCount: litter.pupCount,
    survivedCount: visiblePuppies.length,
    neonatalLossCount: litter.puppies.length - visiblePuppies.length,
    maleCount: litter.puppies.filter((puppy) => puppy.sex === "M").length,
    femaleCount: litter.puppies.filter((puppy) => puppy.sex === "F").length,
    bredByKennelName: litter.bredByKennel?.name ?? null,
    sireDisplayName: formatDogDisplayName(litter.sire),
    damDisplayName: formatDogDisplayName(litter.dam),
    puppiesPreview: visiblePuppies.slice(0, 4).map((puppy) => ({
      dogId: puppy.id,
      displayName: formatDogDisplayName(puppy),
      regNumber: puppy.regNumber,
      sex: puppy.sex,
      litterOrder: puppy.litterOrder,
    })),
  };
}

async function main() {
  const [candidate] = await db.litter.groupBy({
    by: ["bredByKennelId"],
    where: {
      bredByKennelId: {
        not: null,
      },
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _count: {
        bredByKennelId: "desc",
      },
    },
    take: 1,
  });

  assert.ok(candidate?.bredByKennelId, "expected at least one kennel with litters");
  const kennelId = candidate.bredByKennelId;

  const [legacyLitters, narrowLitters] = await Promise.all([
    db.litter.findMany({
      where: visibleToKennelWhere(kennelId),
      orderBy: [{ bornEpoch: "desc" }, { createdAt: "desc" }],
      select: legacyListSelect,
    }),
    db.litter.findMany({
      where: visibleToKennelWhere(kennelId),
      orderBy: [{ bornEpoch: "desc" }, { createdAt: "desc" }],
      select: narrowListSelect,
    }),
  ]);

  assert.equal(
    narrowLitters.length,
    legacyLitters.length,
    "narrow litter list query preserves the visible litter count"
  );

  const legacyById = new Map(
    legacyLitters.map((litter) => [litter.id, mapListShape(litter)])
  );

  for (const narrowLitter of narrowLitters) {
    const legacy = legacyById.get(narrowLitter.id);
    assert.ok(legacy, `missing legacy litter for ${narrowLitter.id}`);

    const next = mapListShape(narrowLitter);
    assert.equal(next.pupCount, legacy.pupCount);
    assert.equal(next.survivedCount, legacy.survivedCount);
    assert.equal(next.neonatalLossCount, legacy.neonatalLossCount);
    assert.equal(next.maleCount, legacy.maleCount);
    assert.equal(next.femaleCount, legacy.femaleCount);
    assert.equal(next.bredByKennelName, legacy.bredByKennelName);
    assert.equal(next.sireDisplayName, legacy.sireDisplayName);
    assert.equal(next.damDisplayName, legacy.damDisplayName);
    assert.ok(
      next.puppiesPreview.length <= 4,
      `preview count exceeds four for litter ${narrowLitter.id}`
    );
    assert.deepEqual(
      next.puppiesPreview,
      legacy.puppiesPreview,
      `preview ordering or preview fields changed for litter ${narrowLitter.id}`
    );

    for (const preview of next.puppiesPreview) {
      assert.deepEqual(
        Object.keys(preview).sort(),
        ["displayName", "dogId", "litterOrder", "regNumber", "sex"],
        "preview payload stays narrow and excludes detail-only fields"
      );
    }

    for (const puppy of narrowLitter.puppies) {
      assert.equal("traitHead" in puppy, false);
      assert.equal("healthConditionTruths" in puppy, false);
      assert.equal("healthTests" in puppy, false);
    }
  }

  console.log("Litter list read model checks passed.");
}

main()
  .finally(async () => {
    await db.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
