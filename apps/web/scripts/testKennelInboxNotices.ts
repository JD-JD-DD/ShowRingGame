import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deleteReadKennelInboxNotices } from "@/server/services/kennelNotice.service";

type FakeNotice = {
  id: string;
  kennelId: string;
  readAtEpoch: number | null;
  dismissedAtEpoch: number | null;
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

function createFakeNoticeClient(notices: FakeNotice[]) {
  const client = {
    kennelNotice: {
      async updateMany(args: {
        where: {
          kennelId: string;
          readAtEpoch?: { not: null };
          dismissedAtEpoch?: null;
        };
        data: { dismissedAtEpoch: number };
      }) {
        let count = 0;

        for (const notice of notices) {
          if (notice.kennelId !== args.where.kennelId) continue;
          if (args.where.readAtEpoch?.not === null && notice.readAtEpoch === null) {
            continue;
          }
          if (
            "dismissedAtEpoch" in args.where &&
            notice.dismissedAtEpoch !== args.where.dismissedAtEpoch
          ) {
            continue;
          }

          notice.dismissedAtEpoch = args.data.dismissedAtEpoch;
          count += 1;
        }

        return { count };
      },
    },
  };

  return client;
}

async function main() {
  const notices: FakeNotice[] = [
    {
      id: "read-current",
      kennelId: "kennel-a",
      readAtEpoch: 100,
      dismissedAtEpoch: null,
    },
    {
      id: "unread-current",
      kennelId: "kennel-a",
      readAtEpoch: null,
      dismissedAtEpoch: null,
    },
    {
      id: "already-dismissed-current",
      kennelId: "kennel-a",
      readAtEpoch: 90,
      dismissedAtEpoch: 120,
    },
    {
      id: "read-other",
      kennelId: "kennel-b",
      readAtEpoch: 100,
      dismissedAtEpoch: null,
    },
  ];
  const client = createFakeNoticeClient(notices);

  const result = await deleteReadKennelInboxNotices({
    kennelId: "kennel-a",
    currentEpoch: 200,
    client: client as never,
  });

  assert.equal(result.deletedCount, 1, "only read current-kennel notices are deleted");
  assert.equal(
    notices.find((notice) => notice.id === "read-current")?.dismissedAtEpoch,
    200,
    "read current-kennel notice is soft-deleted"
  );
  assert.equal(
    notices.find((notice) => notice.id === "unread-current")?.dismissedAtEpoch,
    null,
    "unread current-kennel notice is kept"
  );
  assert.equal(
    notices.find((notice) => notice.id === "already-dismissed-current")
      ?.dismissedAtEpoch,
    120,
    "already dismissed notices are left alone"
  );
  assert.equal(
    notices.find((notice) => notice.id === "read-other")?.dismissedAtEpoch,
    null,
    "another kennel's read notice is kept"
  );

  const secondResult = await deleteReadKennelInboxNotices({
    kennelId: "kennel-a",
    currentEpoch: 300,
    client: client as never,
  });

  assert.equal(secondResult.deletedCount, 0, "delete read action is idempotent");

  const routeSource = source("apps/web/app/api/notices/delete-read/route.ts");
  assertIncludes(routeSource, "getSessionUserId", "delete-read route authenticates");
  assertIncludes(routeSource, "getKennelForUser", "delete-read route scopes to current kennel");
  assertIncludes(
    routeSource,
    "deleteReadKennelInboxNotices",
    "delete-read route uses the kennel notice service"
  );
  assertIncludes(
    routeSource,
    "No read notices to delete.",
    "delete-read route returns friendly no-op message"
  );

  const serviceSource = source("apps/web/server/services/kennelNotice.service.ts");
  assertIncludes(
    serviceSource,
    "readAtEpoch: {\n        not: null,\n      }",
    "delete-read service filters to read notices"
  );
  assertIncludes(
    serviceSource,
    "dismissedAtEpoch: null",
    "delete-read service only mutates visible inbox notices"
  );
  assertExcludes(serviceSource, "communityPost", "delete-read service does not touch community posts");
  assertExcludes(serviceSource, "showResult", "delete-read service does not touch show results");
  assertExcludes(serviceSource, "ledger", "delete-read service does not touch ledger records");
  assertExcludes(serviceSource, "dog.update", "delete-read service does not update dogs");

  const pageSource = source("apps/web/app/notices/page.tsx");
  const formSource = source("apps/web/components/notices/DeleteReadNoticesForm.tsx");
  assertIncludes(pageSource, "<DeleteReadNoticesForm />", "notices page renders Delete Read control");
  assertIncludes(pageSource, "Mark All Read", "Mark All Read remains available");
  assertIncludes(pageSource, "My Kennel", "My Kennel navigation remains available");
  assertIncludes(formSource, "Delete Read", "Delete Read label is rendered");
  assertIncludes(
    formSource,
    "Delete all read inbox notices? Unread notices will be kept.",
    "inline confirmation copy is rendered"
  );
  assertExcludes(formSource, "window.confirm", "Delete Read does not use window.confirm");

  console.log("Kennel inbox notice checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
