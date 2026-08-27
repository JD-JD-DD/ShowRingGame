import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;
  return readFileSync(join(root, path), "utf8");
}

function main() {
  const service = source("apps/web/server/services/kennelMessaging.service.ts");
  const thread = source("apps/web/app/inbox/messages/[conversationId]/page.tsx");
  const control = source("apps/web/components/messages/ConversationBlockControl.tsx");
  const blockRoute = source("apps/web/app/api/inbox/messages/[conversationId]/block/route.ts");
  const unblockRoute = source("apps/web/app/api/inbox/messages/[conversationId]/unblock/route.ts");

  assert.ok(service.includes("getKennelMessagingBlockState"), "block state is a canonical service helper");
  assert.ok(service.includes("OR:"), "block state checks both directional records");
  assert.ok(service.includes("assertKennelsCanMessage"), "sends use centralized eligibility and block enforcement");
  assert.ok(service.includes("await assertKennelsCanMessage"), "block check occurs before conversation mutation");
  assert.ok(service.includes("kennelBlock.upsert"), "block creation is idempotent");
  assert.ok(service.includes("kennelBlock.deleteMany"), "unblock removes only a directional record");
  assert.ok(!service.includes("KennelNotice"), "blocking does not create notices");

  for (const route of [blockRoute, unblockRoute]) {
    assert.ok(route.includes("getSessionUserId"), "block mutation authenticates");
    assert.ok(route.includes("getKennelForUser"), "block mutation derives the current kennel");
    assert.ok(route.includes("loadKennelConversationHistory"), "block mutation authorizes conversation participation");
    assert.ok(!route.includes("request.json"), "block mutation accepts no arbitrary kennel ids");
  }
  assert.ok(blockRoute.includes("blockKennelMessaging"), "block route creates the requester's directional record");
  assert.ok(unblockRoute.includes("unblockKennelMessaging"), "unblock route removes only the requester's directional record");

  assert.ok(thread.includes("Messaging is currently unavailable for this conversation."), "blocked thread state is textual and neutral");
  assert.ok(thread.includes("You have blocked this kennel."), "blocker may see their own action");
  assert.ok(thread.includes("blockState.isBlocked ? ("), "thread conditionally omits the reply composer while blocked");
  assert.ok(control.includes("Block Kennel"), "block control has the canonical label");
  assert.ok(control.includes("Unblock Kennel"), "unblock control has the canonical label");
  assert.ok(control.includes("Existing message history will remain visible"), "confirmation describes preserved history");
  assert.ok(control.includes("focus-visible:outline"), "controls have visible keyboard focus");
  assert.ok(!control.includes("window.confirm"), "confirmation is rendered accessibly inline");

  console.log("Kennel messaging block checks passed.");
}

main();
