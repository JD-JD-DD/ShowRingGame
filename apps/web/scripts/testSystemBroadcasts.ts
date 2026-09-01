import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createSystemKennelBroadcast, getSystemBroadcastNoticeActions, isSafeSystemBroadcastHref, parseSystemBroadcastInput, previewSystemKennelBroadcast } from "../server/services/kennelNotice.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const input = {
  broadcastKey: "support-and-breed-art-launch-v1",
  title: "Two ways to support ShowRing",
  body: "ShowRing remains free to play.",
  actions: [{ label: "Support ShowRing", href: "/support" }, { label: "Explore the Breed Art Fund", href: "/breed-art" }],
};

type Kennel = { id: string; isNpc: boolean; userId: string | null; moderationStatus: "ACTIVE" | "CLOSED"; user: { moderationStatus: "ACTIVE" | "BANNED" } | null };
type Notice = { kennelId: string; sourceKey: string; type: string; title: string; body: string; createdAtEpoch: number; metadataJson: any };

function fakeClient(kennels: Kennel[]) {
  const notices: Notice[] = [];
  const createManyCalls: Array<{ data: Notice[]; skipDuplicates?: boolean }> = [];
  return {
    kennels, notices, createManyCalls,
    client: {
      kennel: { findMany: async () => kennels.filter((kennel) => !kennel.isNpc && kennel.userId !== null && kennel.moderationStatus === "ACTIVE" && kennel.user?.moderationStatus === "ACTIVE").sort((a, b) => a.id.localeCompare(b.id)).map((kennel) => ({ id: kennel.id })) },
      kennelNotice: {
        count: async ({ where }: { where: { sourceKey: { in: string[] } } }) => notices.filter((notice) => where.sourceKey.in.includes(notice.sourceKey)).length,
        createMany: async (args: { data: Notice[]; skipDuplicates?: boolean }) => {
          createManyCalls.push(args);
          let count = 0;
          for (const notice of args.data) {
            if (notices.some((existing) => existing.sourceKey === notice.sourceKey)) continue;
            notices.push(notice); count += 1;
          }
          return { count };
        },
      },
    },
  };
}

async function main() {
  const activeKennels: Kennel[] = Array.from({ length: 501 }, (_, index) => ({ id: `active-${String(index).padStart(3, "0")}`, isNpc: false, userId: `user-${index}`, moderationStatus: "ACTIVE", user: { moderationStatus: "ACTIVE" } }));
  const fake = fakeClient([...activeKennels,
    { id: "npc", isNpc: true, userId: "npc-user", moderationStatus: "ACTIVE", user: { moderationStatus: "ACTIVE" } },
    { id: "no-user", isNpc: false, userId: null, moderationStatus: "ACTIVE", user: null },
    { id: "closed", isNpc: false, userId: "closed-user", moderationStatus: "CLOSED", user: { moderationStatus: "ACTIVE" } },
    { id: "banned", isNpc: false, userId: "banned-user", moderationStatus: "ACTIVE", user: { moderationStatus: "BANNED" } },
  ]);

  const preview = await previewSystemKennelBroadcast({ input, client: fake.client });
  assert.deepEqual({ eligibleRecipients: preview.eligibleRecipients, alreadyHasBroadcast: preview.alreadyHasBroadcast, wouldCreate: preview.wouldCreate }, { eligibleRecipients: 501, alreadyHasBroadcast: 0, wouldCreate: 501 }, "preview selects only active player kennels and writes nothing");
  assert.equal(fake.notices.length, 0, "preview does not create notices");
  const first = await createSystemKennelBroadcast({ input, currentEpoch: 100, client: fake.client });
  assert.deepEqual(first, { broadcastKey: input.broadcastKey, eligibleRecipients: 501, created: 501, skippedExisting: 0, batches: 2 }, "send creates one notice per eligible kennel in bounded batches");
  assert.equal(fake.createManyCalls.every((call) => call.skipDuplicates === true), true, "bulk inserts use database duplicate protection");
  assert.equal(fake.notices.every((notice) => notice.type === "KENNEL_SERVICE" && notice.title === input.title && notice.body === input.body), true, "broadcast notices preserve plain-text copy and type");
  assert.equal(fake.notices.every((notice) => notice.sourceKey === `system-broadcast:${input.broadcastKey}:${notice.kennelId}`), true, "source key contains broadcast and recipient identity");
  assert.deepEqual(fake.notices[0].metadataJson, { systemBroadcast: { key: input.broadcastKey, actions: input.actions } }, "actions use scoped notice metadata");
  const second = await createSystemKennelBroadcast({ input, currentEpoch: 101, client: fake.client });
  assert.equal(second.created, 0, "same key never duplicates current recipients");
  fake.kennels.push({ id: "newly-eligible", isNpc: false, userId: "new-user", moderationStatus: "ACTIVE", user: { moderationStatus: "ACTIVE" } });
  const third = await createSystemKennelBroadcast({ input, currentEpoch: 102, client: fake.client });
  assert.deepEqual({ created: third.created, skippedExisting: third.skippedExisting }, { created: 1, skippedExisting: 501 }, "intentional rerun reaches a newly eligible kennel without duplicating prior recipients");

  assert.equal(isSafeSystemBroadcastHref("/support"), true);
  assert.equal(isSafeSystemBroadcastHref("/breed-art"), true);
  for (const unsafe of ["https://example.com", "//example.com", "javascript:alert(1)", "data:text/html,unsafe", "/\\evil.example", "/%5Cevil.example"]) assert.equal(isSafeSystemBroadcastHref(unsafe), false, `${unsafe} is rejected`);
  assert.throws(() => parseSystemBroadcastInput({ ...input, broadcastKey: "Not safe" }));
  assert.throws(() => parseSystemBroadcastInput({ ...input, actions: [...input.actions, { label: "Third", href: "/" }] }));
  assert.deepEqual(getSystemBroadcastNoticeActions({ type: "KENNEL_SERVICE" as any, metadataJson: { systemBroadcast: { actions: [{ label: "Safe", href: "/support" }, { label: "Unsafe", href: "https://evil.example" }, { label: "Ignored", href: "/breed-art" }] } } }), [{ label: "Safe", href: "/support" }], "renderer fails closed and limits action metadata to two entries");

  const service = source("apps/web/server/services/kennelNotice.service.ts");
  const noticesPage = source("apps/web/app/notices/page.tsx");
  const form = source("apps/web/components/admin/SystemBroadcastForm.tsx");
  const previewRoute = source("apps/web/app/api/admin/system-broadcasts/preview/route.ts");
  const sendRoute = source("apps/web/app/api/admin/system-broadcasts/send/route.ts");
  assert.match(service, /SYSTEM_BROADCAST_BATCH_SIZE = 500/);
  assert.match(service, /isNpc: false[\s\S]*userId: \{ not: null \}[\s\S]*moderationStatus: "ACTIVE"[\s\S]*user: \{ is: \{ moderationStatus: "ACTIVE" \} \}/);
  assert.match(service, /skipDuplicates: true/);
  assert.match(noticesPage, /getSystemBroadcastNoticeActions/);
  assert.match(noticesPage, /border border-\[var\(--dog-border-strong\)\][\s\S]*focus-visible:outline/);
  assert.match(form, /type="button"[\s\S]*Preview/);
  assert.match(form, /disabled=!confirmed \|\| submitting/);
  for (const route of [previewRoute, sendRoute]) { assert.match(route, /getSessionUserId/); assert.match(route, /isAdmin/); assert.match(route, /Forbidden/); }
  assert.doesNotMatch(service + form, /KennelConversation|SupportSubscription|ArtPaymentAttempt|LedgerTransaction/);
  console.log("System broadcast checks passed.");
}

void main();
