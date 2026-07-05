import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createAdminCommunityTopicNotices } from "@/server/services/bulletin.service";

type FakeKennel = {
  id: string;
  name: string;
  user: {
    isAdmin: boolean;
    displayName: string | null;
  } | null;
};

type FakeNotice = {
  id: string;
  kennelId: string;
  sourceKey: string | null;
  type: string;
  title: string;
  body: string | null;
  createdAtEpoch: number;
  linkedThreadId: string | null;
  metadataJson: unknown;
};

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), label);
}

function assertExcludes(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), label);
}

function createFakeClient(args: {
  kennels: FakeKennel[];
  notices?: FakeNotice[];
  throwOnNoticeCreate?: boolean;
}) {
  const notices = args.notices ?? [];
  const client = {
    kennel: {
      async findMany(findArgs: { where: { user: { isAdmin: boolean } } }) {
        return args.kennels
          .filter((kennel) => kennel.user?.isAdmin === findArgs.where.user.isAdmin)
          .map((kennel) => ({ id: kennel.id }));
      },
      async findUnique(findArgs: { where: { id: string } }) {
        const kennel = args.kennels.find(
          (candidate) => candidate.id === findArgs.where.id
        );

        if (!kennel) return null;

        return {
          name: kennel.name,
          user: kennel.user
            ? {
                displayName: kennel.user.displayName,
              }
            : null,
        };
      },
    },
    kennelNotice: {
      async findUnique(findArgs: { where: { sourceKey: string } }) {
        return (
          notices.find((notice) => notice.sourceKey === findArgs.where.sourceKey) ??
          null
        );
      },
      async create(createArgs: { data: Omit<FakeNotice, "id"> }) {
        if (args.throwOnNoticeCreate) {
          throw new Error("notice insert failed");
        }

        const notice = {
          id: `notice-${notices.length + 1}`,
          ...createArgs.data,
        };

        notices.push(notice);
        return notice;
      },
    },
  };

  return {
    client,
    notices,
  };
}

async function main() {
  const fake = createFakeClient({
    kennels: [
      {
        id: "admin-a",
        name: "Admin A Kennel",
        user: { isAdmin: true, displayName: "Admin A" },
      },
      {
        id: "admin-b",
        name: "Admin B Kennel",
        user: { isAdmin: true, displayName: "Admin B" },
      },
      {
        id: "player-a",
        name: "Player Kennel",
        user: { isAdmin: false, displayName: "Player One" },
      },
    ],
  });

  await createAdminCommunityTopicNotices({
    client: fake.client as never,
    threadId: "topic-1",
    topicTitle: "Best grooming routines",
    categoryName: "General",
    categorySlug: "general",
    authorKennelId: "player-a",
    currentEpoch: 12345,
  });

  assert.equal(fake.notices.length, 2, "one notice is created per admin kennel");
  assert.deepEqual(
    fake.notices.map((notice) => notice.kennelId).sort(),
    ["admin-a", "admin-b"],
    "normal player kennels do not receive admin notices"
  );

  for (const notice of fake.notices) {
    assert.equal(notice.type, "KENNEL_SERVICE", "existing notice type is used");
    assert.equal(notice.title, "New Community Topic", "notice title is clear");
    assert.equal(notice.createdAtEpoch, 12345, "existing epoch convention is used");
    assert.equal(notice.linkedThreadId, "topic-1", "notice links to the topic");
    assert.ok(
      notice.sourceKey?.startsWith(`community-topic:topic-1:admin:${notice.kennelId}`),
      "notice has a recipient-specific idempotency key"
    );
    assert.ok(
      notice.body?.includes("Best grooming routines"),
      "notice body includes the topic title"
    );
    assert.ok(notice.body?.includes("General"), "notice body includes category name");
    assert.ok(
      notice.body?.includes("Player One (Player Kennel)"),
      "notice body includes author display and kennel names"
    );
    assert.ok(
      notice.body?.includes("/community/general/topic-1"),
      "notice body includes the community topic path"
    );
  }

  await createAdminCommunityTopicNotices({
    client: fake.client as never,
    threadId: "topic-1",
    topicTitle: "Best grooming routines",
    categoryName: "General",
    categorySlug: "general",
    authorKennelId: "player-a",
    currentEpoch: 12345,
  });

  assert.equal(fake.notices.length, 2, "retrying the same topic does not duplicate notices");

  const failingFake = createFakeClient({
    kennels: [
      {
        id: "admin-a",
        name: "Admin A Kennel",
        user: { isAdmin: true, displayName: "Admin A" },
      },
      {
        id: "player-a",
        name: "Player Kennel",
        user: { isAdmin: false, displayName: "Player One" },
      },
    ],
    throwOnNoticeCreate: true,
  });

  await createAdminCommunityTopicNotices({
    client: failingFake.client as never,
    threadId: "topic-2",
    topicTitle: "Notice insert failure should not block",
    categoryName: "General",
    categorySlug: "general",
    authorKennelId: "player-a",
    currentEpoch: 20000,
  });

  assert.equal(
    failingFake.notices.length,
    0,
    "notice creation failures are swallowed by the notice service"
  );

  const bulletinSource = source("apps/web/server/services/bulletin.service.ts");
  assertIncludes(
    bulletinSource,
    'if ((args.sourceType ?? "PLAYER") === "PLAYER")',
    "admin notices are only hooked to player-created top-level topics"
  );
  assertIncludes(
    bulletinSource,
    "await createAdminCommunityTopicNotices({",
    "topic creation calls the admin notice helper after thread creation"
  );
  const replySection = bulletinSource.slice(
    bulletinSource.indexOf("export async function createBulletinReply"),
    bulletinSource.indexOf("function requireCommunityKennel")
  );
  assertExcludes(
    replySection,
    "createAdminCommunityTopicNotices",
    "reply creation does not create admin topic notices"
  );
  const noticesPageSource = source("apps/web/app/notices/page.tsx");
  assertIncludes(
    noticesPageSource,
    'getNoticeMetadataString(notice, "topicPath")',
    "kennel inbox reads community topic paths from notice metadata"
  );
  assertIncludes(
    noticesPageSource,
    'communityTopicPath?.startsWith("/community/")',
    "kennel inbox opens community topic notices directly"
  );

  console.log("Community topic admin notice checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
