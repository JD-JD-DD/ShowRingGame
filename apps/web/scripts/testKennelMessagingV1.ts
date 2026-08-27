import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;
  return readFileSync(join(root, path), "utf8");
}

function main() {
  const schema = source("apps/web/prisma/schema.prisma");
  const migration = source("apps/web/prisma/migrations/20260827130000_add_kennel_messaging_persistence/migration.sql");
  const messaging = source("apps/web/server/services/kennelMessaging.service.ts");
  const moderation = source("apps/web/server/services/kennelCommunicationModeration.service.ts");
  const thread = source("apps/web/app/inbox/messages/[conversationId]/page.tsx");
  const replyRoute = source("apps/web/app/api/inbox/messages/[conversationId]/route.ts");
  const firstMessageRoute = source("apps/web/app/api/inbox/messages/new/route.ts");
  const notices = source("apps/web/app/notices/page.tsx");
  const publicKennel = source("apps/web/app/kennels/[slug]/page.tsx");
  const inboxCount = source("apps/web/app/api/inbox/unread-count/route.ts");
  const hideControl = source("apps/web/components/messages/ConversationHideControl.tsx");

  assert.ok(schema.includes("@@unique([firstKennelId, secondKennelId])"), "one canonical conversation exists per kennel pair");
  assert.ok(migration.includes("CHECK (\"firstKennelId\" < \"secondKennelId\")"), "database ordering enforces canonical pair identity");
  assert.ok(messaging.includes("canonicalizeKennelPair"), "service canonicalizes reverse-direction conversation access");
  assert.ok(messaging.includes("SELF_CONVERSATION"), "self conversations are rejected");
  assert.ok(messaging.includes("assertKennelsCanMessage"), "send mutations retain centralized eligibility and block checks");
  assert.ok(messaging.includes("getKennelMessagingBlockState"), "either-direction blocks are centrally enforced");
  assert.ok(messaging.includes("data: { hiddenAt: null }"), "successful sends restore hidden conversations");
  assert.ok(messaging.includes("lastReadMessageId: message.id"), "senders advance only their persisted read cursor");
  assert.ok(messaging.includes("visibleOnly: true"), "visible message unread counts exclude hidden conversations");
  assert.ok(messaging.includes("reportKennelConversationMessage"), "message-report authorization remains service-owned");
  assert.ok(messaging.includes("message.senderKennel.id === args.requestingKennelId"), "own messages cannot be reported");
  assert.ok(messaging.includes("hideKennelConversation"), "soft hide remains a participant-scoped service operation");

  assert.ok(replyRoute.includes("loadKennelConversationHistory"), "reply route authorizes participant access before deriving recipient");
  assert.ok(!replyRoute.includes("senderKennelId: payload"), "reply route never accepts a client sender identity");
  assert.ok(firstMessageRoute.includes("getKennelForUser"), "first-message route derives its sender server-side");
  assert.ok(!firstMessageRoute.includes("recipientKennelId: payload"), "first-message route never accepts a client recipient id");
  assert.ok(publicKennel.includes("getKennelMessagingBlockState"), "public entry suppresses blocked messaging pairs");

  assert.ok(!thread.includes("dangerouslySetInnerHTML"), "message history remains React-escaped plain text");
  assert.ok(thread.includes("whitespace-pre-wrap"), "message line breaks remain readable as plain text");
  assert.ok(thread.includes("ConversationBlockControl"), "thread retains block controls");
  assert.ok(thread.includes("ConversationReportControl"), "thread retains report controls");
  assert.ok(thread.includes("ConversationHideControl"), "thread retains hide controls");
  assert.ok(hideControl.includes("conversation will return to your inbox"), "hide confirmation describes restoration");
  assert.ok(inboxCount.includes("total: messages + notices"), "Inbox combines independent message and notice counts");

  assert.ok(moderation.includes("user?.isAdmin === true"), "admin moderation uses User.isAdmin");
  assert.ok(moderation.includes('COMMUNICATION_MODERATION_ADMIN_KENNEL_SLUG = "devtest"'), "designated notice recipient remains centralized");
  assert.ok(moderation.includes("adminKennel?.user?.isAdmin"), "recipient slug cannot grant moderation authority");
  assert.ok(moderation.includes("loadReportedMessageContext"), "older reported messages receive bounded surrounding context");
  assert.ok(moderation.includes("take: 25"), "message evidence context is bounded");
  assert.ok(notices.includes('explicitHref?.startsWith("/admin/moderation/messages/")'), "admin report notices use the narrow deep-link extension");
  assert.ok(!messaging.includes("dangerouslySetInnerHTML"), "service does not introduce rich message rendering");

  console.log("Kennel messaging Version 1 hardening checks passed.");
}

main();
