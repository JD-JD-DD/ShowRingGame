import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createInvitationalResultsPublishedNotices } from "../server/services/kennelNotice.service";

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
  kennelId: string;
  sourceKey: string | null;
  type: string;
  title: string;
  body: string | null;
  createdAtEpoch: number;
  linkedShowId: string | null;
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
  const createManyCalls: Array<{ data: FakeNotice[]; skipDuplicates?: boolean }> = [];

  return {
    notices,
    createManyCalls,
    client: {
      kennel: {
        async findMany(args: {
          where: {
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
          return kennels
            .filter((kennel) => kennel.isNpc === args.where.isNpc)
            .filter((kennel) =>
              args.where.userId.not === null ? kennel.userId !== null : true
            )
            .filter(
              (kennel) => kennel.moderationStatus === args.where.moderationStatus
            )
            .filter(
              (kennel) =>
                kennel.user?.moderationStatus ===
                args.where.user.is.moderationStatus
            )
            .map((kennel) => ({ id: kennel.id }));
        },
      },
      kennelNotice: {
        async createMany(args: { data: FakeNotice[]; skipDuplicates?: boolean }) {
          createManyCalls.push(args);

          let count = 0;

          for (const notice of args.data) {
            const exists = notices.some(
              (existingNotice) => existingNotice.sourceKey === notice.sourceKey
            );

            if (exists && args.skipDuplicates) {
              continue;
            }

            notices.push(notice);
            count += 1;
          }

          return { count };
        },
      },
    },
  };
}

async function main() {
  const eligibleKennels = Array.from({ length: 501 }, (_, index) => ({
    id: `eligible-${String(index + 1).padStart(3, "0")}`,
    userId: `user-${index + 1}`,
    isNpc: false,
    moderationStatus: "ACTIVE" as const,
    user: {
      moderationStatus: "ACTIVE" as const,
    },
  }));
  const fake = createFakeClient([
    ...eligibleKennels,
    {
      id: "npc-kennel",
      userId: "npc-user",
      isNpc: true,
      moderationStatus: "ACTIVE",
      user: { moderationStatus: "ACTIVE" },
    },
    {
      id: "closed-kennel",
      userId: "closed-user",
      isNpc: false,
      moderationStatus: "CLOSED",
      user: { moderationStatus: "ACTIVE" },
    },
    {
      id: "banned-user-kennel",
      userId: "banned-user",
      isNpc: false,
      moderationStatus: "ACTIVE",
      user: { moderationStatus: "BANNED" },
    },
    {
      id: "system-kennel",
      userId: null,
      isNpc: false,
      moderationStatus: "ACTIVE",
      user: null,
    },
  ]);

  const firstResult = await createInvitationalResultsPublishedNotices({
    client: fake.client as never,
    clusterId: "invitational-year-15",
    clusterName: "Year 15 Invitational Show",
    invitationalYear: 15,
    currentEpoch: 150000,
  });

  assert.equal(firstResult.recipientCount, 501, "only active player kennels receive notices");
  assert.equal(firstResult.createdCount, 501, "one notice is created per eligible kennel");
  assert.equal(firstResult.batchCount, 2, "notices are inserted in safe batches");
  assert.equal(fake.createManyCalls.length, 2, "createMany is called once per batch");
  assert.equal(
    fake.createManyCalls.every((call) => call.skipDuplicates === true),
    true,
    "bulk notice inserts use skipDuplicates for retry safety"
  );

  for (const notice of fake.notices) {
    assert.equal(
      notice.type,
      "INVITATIONAL_RESULTS_PUBLISHED",
      "the dedicated notice type is used"
    );
    assert.equal(
      notice.title,
      "Invitational Results Are Available",
      "title matches the player-facing copy"
    );
    assert.equal(
      notice.body,
      "The Year 15 Invitational has finished judging. View the complete results.",
      "body matches the player-facing copy"
    );
    assert.equal(
      notice.linkedShowId,
      "invitational-year-15",
      "notice links to the invitational cluster"
    );
    assert.ok(
      notice.sourceKey?.startsWith("invitational-results:invitational-year-15:"),
      "source keys are durable and recipient-specific"
    );
    assert.equal(
      notice.sourceKey,
      `invitational-results:invitational-year-15:${notice.kennelId}`,
      "source keys match the required semantic shape"
    );
    assert.deepEqual(
      notice.metadataJson,
      {
        gameYear: 15,
        resultsPath: "/shows/invitational-year-15/results",
        clusterName: "Year 15 Invitational Show",
      },
      "notice metadata includes the direct results path"
    );
  }

  const secondResult = await createInvitationalResultsPublishedNotices({
    client: fake.client as never,
    clusterId: "invitational-year-15",
    clusterName: "Year 15 Invitational Show",
    invitationalYear: 15,
    currentEpoch: 150000,
  });

  assert.equal(secondResult.recipientCount, 501, "retries keep the same recipient scope");
  assert.equal(secondResult.createdCount, 0, "retries do not duplicate notices");
  assert.equal(fake.notices.length, 501, "stored notices remain unique after retry");

  const serviceSource = source("apps/web/server/services/kennelNotice.service.ts");
  assertIncludes(
    serviceSource,
    'type: "INVITATIONAL_RESULTS_PUBLISHED"',
    "service writes the dedicated invitational results notice type"
  );
  assertIncludes(
    serviceSource,
    'skipDuplicates: true',
    "service uses skipDuplicates when bulk inserting notices"
  );
  assertIncludes(
    serviceSource,
    'moderationStatus: "ACTIVE"',
    "service filters recipient kennels to active moderation state"
  );
  assertIncludes(
    serviceSource,
    'userId: { not: null }',
    "service excludes system kennels without a user"
  );
  assertIncludes(
    serviceSource,
    'Invitational Results Are Available',
    "service stores the finalized notice title"
  );
  assertIncludes(
    serviceSource,
    'The Year ${args.invitationalYear} Invitational has finished judging. View the complete results.',
    "service stores the finalized notice message"
  );

  const judgingSource = source("apps/web/server/services/judging.service.ts");
  assertIncludes(
    judgingSource,
    "createInvitationalResultsPublishedNotices({",
    "show day finalization triggers the invitational results notice helper"
  );
  assertIncludes(
    judgingSource,
    "getInvitationalClusterId(showDay.cluster.year)",
    "finalization uses the canonical invitational identity helper"
  );
  assertIncludes(
    judgingSource,
    'console.error(\n          "Unable to create invitational results published notices:"',
    "unexpected notice fan-out errors are logged without rolling back results"
  );

  const noticesPageSource = source("apps/web/app/notices/page.tsx");
  assertIncludes(
    noticesPageSource,
    'notice.type === "INVITATIONAL_RESULTS_PUBLISHED"',
    "notices page recognizes invitational results notices"
  );
  assertIncludes(
    noticesPageSource,
    '/results`;',
    "invitation results notices link directly to published results"
  );

  console.log("Invitational results published notice checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
