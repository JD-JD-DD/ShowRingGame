import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { resolveBreedingProgressForKennel } from "../server/services/breeding.service";
import {
  listLitterPageForKennel,
  listLittersForKennel,
} from "../server/services/litter.service";

const db = new PrismaClient();
const currentEpoch = 4704;
const root = join(fileURLToPath(new URL("..", import.meta.url)), "..", "..");

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

async function findKennelWithMultiplePages(): Promise<string> {
  const candidates = await db.litter.groupBy({
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
    take: 10,
  });

  for (const candidate of candidates) {
    if (!candidate.bredByKennelId) {
      continue;
    }

    const visibleCount = await db.litter.count({
      where: visibleToKennelWhere(candidate.bredByKennelId),
    });

    if (visibleCount > 10) {
      return candidate.bredByKennelId;
    }
  }

  throw new Error("Expected at least one kennel with more than ten visible litters.");
}

async function main() {
  const kennelId = await findKennelWithMultiplePages();

  await resolveBreedingProgressForKennel({
    kennelId,
    currentEpoch,
  });

  const baselineLitters = await db.litter.findMany({
    where: visibleToKennelWhere(kennelId),
    orderBy: [{ bornEpoch: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
    },
  });
  const baselineIds = baselineLitters.map((litter) => litter.id);

  const initialPage = await listLittersForKennel({
    kennelId,
    currentEpoch,
  });

  assert.ok(
    initialPage.litters.length <= 10,
    "initial litter page should return no more than ten litters"
  );
  assert.equal(
    initialPage.litters.length,
    Math.min(10, baselineIds.length),
    "initial litter page should return the first ten visible litters"
  );
  assert.deepEqual(
    initialPage.litters.map((litter) => litter.litterId),
    baselineIds.slice(0, initialPage.litters.length),
    "initial litter page ordering should match the newest-first baseline query"
  );
  assert.equal(
    initialPage.totalCount,
    baselineIds.length,
    "total visible litter count should match the baseline query"
  );
  assert.equal(
    initialPage.hasMore,
    baselineIds.length > initialPage.litters.length,
    "initial hasMore should reflect whether more visible litters remain"
  );
  assert.equal(
    initialPage.nextCursor !== null,
    baselineIds.length > initialPage.litters.length,
    "initial nextCursor should exist when additional pages remain"
  );

  const secondPage = initialPage.nextCursor
    ? await listLitterPageForKennel({
        kennelId,
        currentEpoch,
        cursor: initialPage.nextCursor,
      })
    : null;

  if (secondPage) {
    assert.ok(
      secondPage.litters.length <= 10,
      "second litter page should return no more than ten litters"
    );
    assert.deepEqual(
      secondPage.litters.map((litter) => litter.litterId),
      baselineIds.slice(
        initialPage.litters.length,
        initialPage.litters.length + secondPage.litters.length
      ),
      "second litter page should return the next visible litters without gaps"
    );
  }

  const pagedIds: string[] = [];
  const seenIds = new Set<string>();
  let pageCursor = initialPage.nextCursor;
  let hasMore = initialPage.hasMore;
  let finalPage = {
    nextCursor: initialPage.nextCursor,
    hasMore: initialPage.hasMore,
  };

  for (const litter of initialPage.litters) {
    assert.equal(
      seenIds.has(litter.litterId),
      false,
      `initial page should not duplicate litter ${litter.litterId}`
    );
    seenIds.add(litter.litterId);
    pagedIds.push(litter.litterId);
  }

  while (hasMore && pageCursor) {
    const page = await listLitterPageForKennel({
      kennelId,
      currentEpoch,
      cursor: pageCursor,
    });

    for (const litter of page.litters) {
      assert.equal(
        seenIds.has(litter.litterId),
        false,
        `cursor pagination should not duplicate litter ${litter.litterId}`
      );
      seenIds.add(litter.litterId);
      pagedIds.push(litter.litterId);
    }

    pageCursor = page.nextCursor;
    hasMore = page.hasMore;
    finalPage = page;
  }

  assert.deepEqual(
    pagedIds,
    baselineIds,
    "cursor pagination should return every visible litter in the baseline order with no gaps"
  );
  assert.equal(finalPage.hasMore, false, "final page should report no more litters");
  assert.equal(finalPage.nextCursor, null, "final page should not return a next cursor");

  const clientSource = readFileSync(
    join(root, "apps/web/components/litters/LittersListClient.tsx"),
    "utf8"
  );
  assert.ok(
    clientSource.includes('{hasMore ? ('),
    "load-more button should only render when more litters remain"
  );
  assert.ok(
    clientSource.includes("See More Litters"),
    'load-more button should use the complete "See More Litters" label'
  );

  console.log("Litter list pagination checks passed.");
}

main()
  .finally(async () => {
    await db.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
