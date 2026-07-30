import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  listEarnedProducerMeritTitles,
  listNewlyEarnedProducerMeritTitles,
  recalculateProducerMeritForDog,
} from "../server/services/producerMerit.service";

type FakeDog = {
  id: string;
  ownerKennelId: string | null;
  registeredName: string | null;
  callName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  sex: "M" | "F";
  championOffspringCount: number;
  producerMeritLevel: "NONE" | "MERIT" | "EXCELLENT" | "ELITE" | "LEGACY";
  producerMeritSuffix: string | null;
  producerMeritLabel: string | null;
};

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

function createFakeClient(args: {
  dog: FakeDog;
  championOffspringCount: number;
  kennels: FakeKennel[];
}) {
  const notices: FakeNotice[] = [];
  const state = {
    championOffspringCount: args.championOffspringCount,
  };

  return {
    notices,
    client: {
      dog: {
        async findUnique(findArgs: { where: { id: string } }) {
          if (findArgs.where.id !== args.dog.id) {
            return null;
          }

          return { ...args.dog };
        },
        async count() {
          return state.championOffspringCount;
        },
      },
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
        }) {
          return (
            args.kennels
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
      async $executeRaw(_query: TemplateStringsArray, ...values: unknown[]) {
        args.dog.championOffspringCount = values[0] as number;
        args.dog.producerMeritLevel = values[1] as FakeDog["producerMeritLevel"];
        args.dog.producerMeritSuffix = values[2] as string | null;
        args.dog.producerMeritLabel = values[3] as string | null;
        args.dog.visibleTitleSuffix = values[4] as string | null;

        return 1;
      },
    },
    state,
  };
}

async function main() {
  assert.deepEqual(listEarnedProducerMeritTitles({ sex: "F", championOffspringCount: 0 }), []);
  assert.deepEqual(listEarnedProducerMeritTitles({ sex: "F", championOffspringCount: 5 }), [
    {
      titleCode: "DOM",
      titleLabel: "Dam of Merit",
    },
  ]);
  assert.deepEqual(listEarnedProducerMeritTitles({ sex: "M", championOffspringCount: 35 }), [
    {
      titleCode: "SOM",
      titleLabel: "Sire of Merit",
    },
    {
      titleCode: "SOMX",
      titleLabel: "Excellent Producer",
    },
    {
      titleCode: "SOMXX",
      titleLabel: "Elite Producer",
    },
  ]);
  assert.deepEqual(
    listNewlyEarnedProducerMeritTitles({
      sex: "F",
      previousChampionOffspringCount: 4,
      nextChampionOffspringCount: 10,
    }),
    [
      {
        titleCode: "DOM",
        titleLabel: "Dam of Merit",
      },
      {
        titleCode: "DOMX",
        titleLabel: "Excellent Producer",
      },
    ],
    "crossing multiple thresholds yields one newly earned title per canonical tier"
  );

  const activeOwnerKennel: FakeKennel = {
    id: "owner-kennel",
    userId: "owner-user",
    isNpc: false,
    moderationStatus: "ACTIVE",
    user: { moderationStatus: "ACTIVE" },
  };
  const fake = createFakeClient({
    dog: {
      id: "dog-1",
      ownerKennelId: activeOwnerKennel.id,
      registeredName: "Harvest Moon",
      callName: "Harvey",
      regNumber: "SRG-100",
      visibleTitlePrefix: "CH",
      visibleTitleSuffix: null,
      sex: "F",
      championOffspringCount: 4,
      producerMeritLevel: "NONE",
      producerMeritSuffix: null,
      producerMeritLabel: null,
    },
    championOffspringCount: 10,
    kennels: [
      activeOwnerKennel,
      {
        id: "former-owner",
        userId: "former-user",
        isNpc: false,
        moderationStatus: "ACTIVE",
        user: { moderationStatus: "ACTIVE" },
      },
    ],
  });
  const firstMerit = await recalculateProducerMeritForDog({
    tx: fake.client as never,
    dogId: "dog-1",
    currentEpoch: 12345,
  });

  assert.equal(firstMerit?.producerMeritSuffix, "DOMX", "highest earned title is still persisted");
  assert.equal(fake.notices.length, 2, "two distinct newly earned progeny titles create two notices");
  assert.deepEqual(
    fake.notices.map((notice) => notice.type),
    ["DOG_PROGENY_TITLE_EARNED", "DOG_PROGENY_TITLE_EARNED"],
    "the canonical progeny notice type is used"
  );
  assert.deepEqual(
    fake.notices.map((notice) => notice.linkedDogId),
    ["dog-1", "dog-1"],
    "each notice links to the titled dog"
  );
  assert.deepEqual(
    fake.notices.map((notice) => notice.kennelId),
    ["owner-kennel", "owner-kennel"],
    "only the current owner kennel receives the notices"
  );
  assert.deepEqual(
    fake.notices.map((notice) => notice.sourceKey),
    [
      "dog-title:dog-1:DOM:owner-kennel",
      "dog-title:dog-1:DOMX:owner-kennel",
    ],
    "source keys include the dog ID, canonical title code, and recipient kennel ID"
  );
  assert.equal(fake.notices[0]?.title, "New DOM title", "producer notice title follows the CH/GCH style");
  assert.equal(
    fake.notices[0]?.body,
    "CH Harvest Moon DOM has earned the Dam of Merit title.",
    "DOM notice body uses the dog display helper and canonical title label"
  );
  assert.equal(
    fake.notices[1]?.body,
    "CH Harvest Moon DOMX has earned the Excellent Producer title.",
    "higher-tier notice body uses the dog display helper and canonical title label"
  );

  fake.state.championOffspringCount = 10;
  await recalculateProducerMeritForDog({
    tx: fake.client as never,
    dogId: "dog-1",
    currentEpoch: 12345,
  });
  assert.equal(fake.notices.length, 2, "reprocessing an already-earned title creates no duplicate");

  const somClient = createFakeClient({
    dog: {
      id: "dog-2",
      ownerKennelId: activeOwnerKennel.id,
      registeredName: "North Wind",
      callName: "Wynn",
      regNumber: "SRG-200",
      visibleTitlePrefix: "CH",
      visibleTitleSuffix: null,
      sex: "M",
      championOffspringCount: 9,
      producerMeritLevel: "NONE",
      producerMeritSuffix: null,
      producerMeritLabel: null,
    },
    championOffspringCount: 10,
    kennels: [activeOwnerKennel],
  });
  await recalculateProducerMeritForDog({
    tx: somClient.client as never,
    dogId: "dog-2",
    currentEpoch: 12345,
  });
  assert.equal(somClient.notices.length, 1, "a newly awarded SOM creates exactly one notice");
  assert.equal(
    somClient.notices[0]?.body,
    "CH North Wind SOM has earned the Sire of Merit title.",
    "SOM uses the same shared notice path"
  );

  const inactiveOwnerCases: Array<{
    label: string;
    kennel: FakeKennel;
  }> = [
    {
      label: "closed kennel",
      kennel: {
        id: "closed-owner",
        userId: "closed-user",
        isNpc: false,
        moderationStatus: "CLOSED",
        user: { moderationStatus: "ACTIVE" },
      },
    },
    {
      label: "banned user kennel",
      kennel: {
        id: "banned-owner",
        userId: "banned-user",
        isNpc: false,
        moderationStatus: "ACTIVE",
        user: { moderationStatus: "BANNED" },
      },
    },
    {
      label: "NPC kennel",
      kennel: {
        id: "npc-owner",
        userId: "npc-user",
        isNpc: true,
        moderationStatus: "ACTIVE",
        user: { moderationStatus: "ACTIVE" },
      },
    },
    {
      label: "system kennel",
      kennel: {
        id: "system-owner",
        userId: null,
        isNpc: false,
        moderationStatus: "ACTIVE",
        user: null,
      },
    },
  ];

  for (const testCase of inactiveOwnerCases) {
    const client = createFakeClient({
      dog: {
        id: `dog-${testCase.kennel.id}`,
        ownerKennelId: testCase.kennel.id,
        registeredName: "Case Dog",
        callName: null,
        regNumber: `SRG-${testCase.kennel.id}`,
        visibleTitlePrefix: "CH",
        visibleTitleSuffix: null,
        sex: "F",
        championOffspringCount: 4,
        producerMeritLevel: "NONE",
        producerMeritSuffix: null,
        producerMeritLabel: null,
      },
      championOffspringCount: 5,
      kennels: [testCase.kennel],
    });
    await recalculateProducerMeritForDog({
      tx: client.client as never,
      dogId: `dog-${testCase.kennel.id}`,
      currentEpoch: 12345,
    });

    assert.equal(client.notices.length, 0, `${testCase.label} does not receive a notice`);
  }

  const producerMeritSource = source("apps/web/server/services/producerMerit.service.ts");
  assertIncludes(
    producerMeritSource,
    "listNewlyEarnedProducerMeritTitles",
    "producer merit uses a shared newly-earned title seam"
  );
  assertIncludes(
    producerMeritSource,
    "createDogProgenyTitleEarnedNotice({",
    "producer merit still creates notices immediately after canonical title persistence"
  );
  assertIncludes(
    producerMeritSource,
    "currentEpoch: args.currentEpoch",
    "producer merit notice timing uses the canonical award epoch"
  );

  const noticeServiceSource = source("apps/web/server/services/kennelNotice.service.ts");
  assertIncludes(
    noticeServiceSource,
    'noticeType: "DOG_PROGENY_TITLE_EARNED"',
    "progeny title notices preserve the dedicated notice enum when using the shared helper"
  );
  assertIncludes(
    noticeServiceSource,
    'dog-title:${args.dogId}:${args.titleCode}:${args.kennelId}',
    "source key semantics match the consolidated required format"
  );
  assertIncludes(
    noticeServiceSource,
    'linkedDogId: args.dogId',
    "progeny title notices link to the dog page"
  );
  assertIncludes(
    noticeServiceSource,
    "createDogTitleNotice({",
    "progeny title notices use the shared dog title helper"
  );

  const noticesPageSource = source("apps/web/app/notices/page.tsx");
  assertIncludes(
    noticesPageSource,
    "if (notice.linkedDogId) return `/dogs/${notice.linkedDogId}`;",
    "existing linkedDogId notice routing opens the dog page"
  );

  console.log("Dog progeny title notice checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
