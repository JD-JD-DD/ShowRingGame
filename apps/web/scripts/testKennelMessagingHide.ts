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
  const hideRoute = source("apps/web/app/api/inbox/messages/[conversationId]/hide/route.ts");
  const control = source("apps/web/components/messages/ConversationHideControl.tsx");
  const thread = source("apps/web/app/inbox/messages/[conversationId]/page.tsx");

  assert.ok(service.includes("hideKennelConversation"), "hide is a canonical messaging service operation");
  assert.ok(service.includes("hiddenAt: new Date()"), "hide uses server-side real-world time");
  assert.ok(service.includes("hiddenAt: null"), "repeat hide only updates currently visible participant state");
  assert.ok(service.includes("kennelId: args.requestingKennelId"), "hide targets only the requesting participant");
  assert.ok(hideRoute.includes("getSessionUserId"), "hide endpoint authenticates");
  assert.ok(hideRoute.includes("getKennelForUser"), "hide endpoint derives the current kennel server-side");
  assert.ok(hideRoute.includes("hideKennelConversation"), "hide endpoint delegates to canonical service logic");
  assert.ok(!hideRoute.includes("request.json"), "hide endpoint accepts no client participant or timestamp fields");
  assert.ok(thread.includes("ConversationHideControl"), "thread exposes the hide control");
  assert.ok(control.includes("Hide Conversation"), "hide control uses the canonical label");
  assert.ok(control.includes("The message history will be kept."), "confirmation preserves history explicitly");
  assert.ok(control.includes("conversation will return to your inbox"), "confirmation explains automatic restoration");
  assert.ok(control.includes('router.push("/inbox/messages")'), "successful hide routes back to the message inbox");
  assert.ok(control.includes("focus-visible:outline"), "hide controls have visible keyboard focus");
  assert.ok(!control.includes("Delete"), "hide UI introduces no deletion action");
  assert.ok(!control.includes("Unhide"), "hide UI introduces no manual unhide action");

  console.log("Kennel messaging hide checks passed.");
}

main();
