import { strict as assert } from "node:assert";

import { db } from "@/lib/db";
import {
  getBulletinThread,
  getCommunityOverview,
  listBulletinCategories,
  listBulletinThreads,
} from "@/server/services/bulletin.service";
import {
  getKennelPrestigeSummaries,
  getKennelPrestigeSummary,
} from "@/server/services/kennelPrestige.service";

async function assertOverviewMatchesIndependentLists(args: {
  includeInactive?: boolean;
  includeModerated?: boolean;
}) {
  const [categories, recentTopics, overview] = await Promise.all([
    listBulletinCategories(args),
    listBulletinThreads({ take: 8, includeModerated: args.includeModerated }),
    getCommunityOverview({ ...args, recentTopicTake: 8 }),
  ]);

  assert.deepEqual(
    overview.categories,
    categories,
    "overview categories preserve the existing list output"
  );
  assert.deepEqual(
    overview.recentTopics,
    recentTopics,
    "overview recent topics preserve the existing list output"
  );

  const allTopics = [
    ...overview.recentTopics,
    ...overview.categories.flatMap((category) =>
      category.latestThread ? [category.latestThread] : []
    ),
  ];
  const badgesByKennelId = new Map<string, (typeof allTopics)[number]["badges"]>();

  for (const topic of allTopics) {
    const existing = badgesByKennelId.get(topic.kennel.id);
    if (existing) {
      assert.deepEqual(topic.badges, existing, "duplicate authors share a badge result");
    } else {
      badgesByKennelId.set(topic.kennel.id, topic.badges);
    }
  }
}

async function main() {
  const categoryDelegate = db.bulletinCategory as unknown as {
    findMany: unknown;
  };
  const originalCategoryFindMany = categoryDelegate.findMany;
  const originalConsoleError = console.error;
  const failure = Object.assign(new Error("controlled community overview failure"), {
    code: "P2024",
  });
  const failureLogs: unknown[][] = [];

  try {
    categoryDelegate.findMany = async () => {
      throw failure;
    };
    console.error = (...args: unknown[]) => failureLogs.push(args);

    await assert.rejects(
      getCommunityOverview({ isAdmin: true }),
      (error: unknown) => error === failure,
      "overview failures preserve the original error"
    );
  } finally {
    categoryDelegate.findMany = originalCategoryFindMany;
    console.error = originalConsoleError;
  }

  assert.equal(failureLogs.length, 1, "overview failures emit one structured log");
  const [failureLabel, failureDetails] = failureLogs[0];
  assert.equal(failureLabel, "community-overview-failed", "failure label is stable");
  assert.ok(
    typeof failureDetails === "object" && failureDetails !== null,
    "failure log includes structured details"
  );
  const failureContext = failureDetails as Record<string, unknown>;
  assert.equal(failureContext.stage, "load-community-records", "failure stage is recorded");
  assert.equal(failureContext.isAdmin, true, "viewer role is recorded");
  assert.equal(failureContext.errorName, "Error", "error name is recorded");
  assert.equal(failureContext.errorMessage, failure.message, "error message is recorded");
  assert.equal(failureContext.errorCode, "P2024", "Prisma-style error code is recorded");
  assert.equal(failureContext.error, failure, "original error object is logged");

  const communityAuthors = await db.bulletinThread.findMany({
    where: { status: { in: ["OPEN", "LOCKED"] } },
    orderBy: [{ pinned: "desc" }, { lastActivityEpoch: "desc" }],
    take: 8,
    select: { kennelId: true },
  });
  const kennelIds = [...new Set(communityAuthors.map((thread) => thread.kennelId))];
  const batched = await getKennelPrestigeSummaries([
    ...kennelIds,
    ...kennelIds,
    "missing-community-kennel",
  ]);

  assert.equal(
    batched.size,
    kennelIds.length + 1,
    "batching deduplicates requested kennel IDs and tolerates missing IDs"
  );
  const missing = batched.get("missing-community-kennel");
  assert.equal(missing?.score, 0, "missing IDs retain the zero-prestige fallback");
  assert.equal(missing?.tier.label, "New Kennel", "missing IDs retain the default badge tier");
  assert.equal(
    (await getKennelPrestigeSummaries([])).size,
    0,
    "empty author sets do not issue prestige reads"
  );

  for (const kennelId of kennelIds) {
    assert.deepEqual(
      batched.get(kennelId),
      await getKennelPrestigeSummary(kennelId),
      "batched prestige matches the existing single-kennel calculation"
    );
  }

  await assertOverviewMatchesIndependentLists({});
  await assertOverviewMatchesIndependentLists({
    includeInactive: true,
    includeModerated: true,
  });

  const closedKennelThread = await db.bulletinThread.findFirst({
    where: {
      status: { in: ["OPEN", "LOCKED"] },
      kennel: { moderationStatus: "CLOSED" },
    },
    select: { id: true },
  });
  if (closedKennelThread) {
    assert.ok(
      await getBulletinThread(closedKennelThread.id),
      "visible community content from a closed kennel continues to render"
    );
  }

  await db.$disconnect();
  console.log("Community batched prestige read checks passed.");
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});
