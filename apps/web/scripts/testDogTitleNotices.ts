import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createDogTitleNotice,
  getDogTitleNoticeSourceKey,
} from "../server/services/kennelNotice.service";
import { getGrandChampionNoticeText } from "../server/services/titleProgress.service";

type FakeKennel = {
  id: string;
  userId: string | null;
  isNpc: boolean;
  moderationStatus: "ACTIVE" | "CLOSED";
  user: {
    moderationStatus: "ACTIVE" | "BANNED";
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
  linkedDogId: string | null;
  metadataJson: unknown;
};

const root = join(__dirname, "../../..");

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

function createFakeClient(kennels: FakeKennel[]) {
  const notices: FakeNotice[] = [];

  return {
    notices,
    client: {
      kennel: {
        async findFirst(findArgs: {
          where: {
            id: string;
            isNpc: boolean;
            userId: { not: null };
            moderationStatus: "ACTIVE";
            user: {
              is: {
                moderationStatus: "ACTIVE";
              };
            };
          };
          select: {
            id: true;
          };
        }) {
          return (
            kennels
              .filter((kennel) => kennel.id === findArgs.where.id)
              .filter((kennel) => kennel.isNpc === findArgs.where.isNpc)
              .filter((kennel) =>
                findArgs.where.userId.not === null ? kennel.userId !== null : true
              )
              .filter(
                (kennel) =>
                  kennel.moderationStatus === findArgs.where.moderationStatus
              )
              .filter(
                (kennel) =>
                  kennel.user?.moderationStatus ===
                  findArgs.where.user.is.moderationStatus
              )
              .map((kennel) => ({ id: kennel.id }))[0] ?? null
          );
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
          const notice = {
            id: `notice-${notices.length + 1}`,
            ...createArgs.data,
          };

          notices.push(notice);
          return notice;
        },
      },
    },
  };
}

async function main() {
  assert.equal(
    getDogTitleNoticeSourceKey({
      dogId: "dog-1",
      titleCode: "CH",
      kennelId: "kennel-1",
    }),
    "dog-title:dog-1:CH:kennel-1",
    "CH source keys use the shared durable format"
  );
  assert.equal(
    getDogTitleNoticeSourceKey({
      dogId: "dog-1",
      titleCode: "GCHB",
      kennelId: "kennel-1",
    }),
    "dog-title:dog-1:GCHB:kennel-1",
    "GCH advancement source keys use the shared durable format"
  );

  const activeKennel: FakeKennel = {
    id: "owner-kennel",
    userId: "owner-user",
    isNpc: false,
    moderationStatus: "ACTIVE",
    user: { moderationStatus: "ACTIVE" },
  };
  const fake = createFakeClient([activeKennel]);

  const firstNotice = await createDogTitleNotice({
    client: fake.client as never,
    kennelId: activeKennel.id,
    dogId: "dog-1",
    dogDisplayName: "CH Harvest Moon",
    noticeType: "NEW_CHAMPION" as never,
    titleCode: "CH",
    sourceKey: getDogTitleNoticeSourceKey({
      dogId: "dog-1",
      titleCode: "CH",
      kennelId: activeKennel.id,
    }),
    title: "New champion",
    body: "CH Harvest Moon has finished their championship.",
    currentEpoch: 12345,
  });

  assert.equal(firstNotice?.kennelId, activeKennel.id, "active registered owner receives the title notice");
  assert.equal(firstNotice?.linkedDogId, "dog-1", "title notices link to the titled dog");
  assert.equal(firstNotice?.title, "New champion", "CH notice title is preserved");
  assert.equal(
    firstNotice?.body,
    "CH Harvest Moon has finished their championship.",
    "CH notice body is byte-for-byte unchanged"
  );

  const duplicateNotice = await createDogTitleNotice({
    client: fake.client as never,
    kennelId: activeKennel.id,
    dogId: "dog-1",
    dogDisplayName: "CH Harvest Moon",
    noticeType: "NEW_CHAMPION" as never,
    titleCode: "CH",
    sourceKey: getDogTitleNoticeSourceKey({
      dogId: "dog-1",
      titleCode: "CH",
      kennelId: activeKennel.id,
    }),
    title: "New champion",
    body: "CH Harvest Moon has finished their championship.",
    currentEpoch: 12345,
  });

  assert.equal(fake.notices.length, 1, "reprocessing CH does not create a duplicate notice");
  assert.equal(duplicateNotice?.id, firstNotice?.id, "duplicate CH notice returns the existing row");

  const gchText = getGrandChampionNoticeText({
    dog: {
      registeredName: "Harvest Moon",
      callName: "Harvey",
      regNumber: "SRG-100",
      visibleTitlePrefix: "GCH",
      visibleTitleSuffix: null,
    },
    titleCode: "GCHB",
  });

  assert.deepEqual(
    gchText,
    {
      title: "New GCHB title",
      body: "GCHB Harvest Moon has advanced to GCHB.",
    },
    "GCH notice text remains generated by the existing helper unchanged"
  );

  const gchNotice = await createDogTitleNotice({
    client: fake.client as never,
    kennelId: activeKennel.id,
    dogId: "dog-1",
    dogDisplayName: "GCHB Harvest Moon",
    noticeType: "NEW_GRAND_CHAMPION" as never,
    titleCode: "GCHB",
    sourceKey: getDogTitleNoticeSourceKey({
      dogId: "dog-1",
      titleCode: "GCHB",
      kennelId: activeKennel.id,
    }),
    title: gchText.title,
    body: gchText.body,
    currentEpoch: 23456,
    metadataJson: {
      titleCode: "GCHB",
      previousTitleCode: "GCH",
      showDayId: "show-day-1",
    },
  });

  assert.equal(gchNotice?.type, "NEW_GRAND_CHAMPION", "GCH notices keep the same enum");
  assert.deepEqual(
    gchNotice?.metadataJson,
    {
      titleCode: "GCHB",
      previousTitleCode: "GCH",
      showDayId: "show-day-1",
    },
    "GCH metadata remains unchanged"
  );

  const inactiveOwnerCases: Array<{
    label: string;
    kennel: FakeKennel;
  }> = [
    {
      label: "closed kennel",
      kennel: {
        id: "closed-kennel",
        userId: "closed-user",
        isNpc: false,
        moderationStatus: "CLOSED",
        user: { moderationStatus: "ACTIVE" },
      },
    },
    {
      label: "banned-user kennel",
      kennel: {
        id: "banned-kennel",
        userId: "banned-user",
        isNpc: false,
        moderationStatus: "ACTIVE",
        user: { moderationStatus: "BANNED" },
      },
    },
    {
      label: "npc kennel",
      kennel: {
        id: "npc-kennel",
        userId: "npc-user",
        isNpc: true,
        moderationStatus: "ACTIVE",
        user: { moderationStatus: "ACTIVE" },
      },
    },
    {
      label: "system kennel",
      kennel: {
        id: "system-kennel",
        userId: null,
        isNpc: false,
        moderationStatus: "ACTIVE",
        user: null,
      },
    },
  ];

  for (const testCase of inactiveOwnerCases) {
    const client = createFakeClient([testCase.kennel]);

    await createDogTitleNotice({
      client: client.client as never,
      kennelId: testCase.kennel.id,
      dogId: "dog-2",
      dogDisplayName: "CH Example Dog",
      noticeType: "NEW_CHAMPION" as never,
      titleCode: "CH",
      sourceKey: getDogTitleNoticeSourceKey({
        dogId: "dog-2",
        titleCode: "CH",
        kennelId: testCase.kennel.id,
      }),
      title: "New champion",
      body: "CH Example Dog has finished their championship.",
      currentEpoch: 1,
    });

    assert.equal(client.notices.length, 0, `${testCase.label} does not receive a dog-title notice`);
  }

  const titleProgressSource = source("apps/web/server/services/titleProgress.service.ts");
  assertIncludes(
    titleProgressSource,
    "await createDogTitleNotice({",
    "CH and GCH notices both route through the shared dog title helper"
  );
  assertIncludes(
    titleProgressSource,
    'noticeType: "NEW_CHAMPION"',
    "CH still uses the NEW_CHAMPION enum"
  );
  assertIncludes(
    titleProgressSource,
    'title: "New champion"',
    "CH notice title remains unchanged"
  );
  assertIncludes(
    titleProgressSource,
    'body: `${dogDisplayName} has finished their championship.`',
    "CH notice body remains unchanged"
  );
  assertIncludes(
    titleProgressSource,
    "titleCode: CHAMPION_TITLE_CODE",
    "CH uses a stable durable source key keyed by the canonical CH code"
  );
  assertIncludes(
    titleProgressSource,
    'noticeType: "NEW_GRAND_CHAMPION"',
    "GCH and higher still use the NEW_GRAND_CHAMPION enum"
  );
  assertIncludes(
    titleProgressSource,
    "getGrandChampionNoticeText({",
    "GCH notice text is still produced by the existing generator"
  );
  assertIncludes(
    titleProgressSource,
    "previousTitleCode,",
    "GCH metadata still includes previousTitleCode"
  );
  assertIncludes(
    titleProgressSource,
    "showDayId: args.showDayId,",
    "GCH metadata still includes showDayId"
  );

  const noticeServiceSource = source("apps/web/server/services/kennelNotice.service.ts");
  assertIncludes(
    noticeServiceSource,
    "export async function createDogTitleNotice",
    "the shared dog title helper is defined in the canonical kennel notice service"
  );
  assertIncludes(
    noticeServiceSource,
    'linkedDogId: args.dogId',
    "the shared helper preserves dog-page routing"
  );
  assertIncludes(
    noticeServiceSource,
    'moderationStatus: "ACTIVE"',
    "the shared helper validates active player-kennel eligibility"
  );

  console.log("Dog title notice checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
