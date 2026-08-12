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
