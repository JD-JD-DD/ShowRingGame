import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;
  return readFileSync(join(root, path), "utf8");
}

function main() {
  const publicKennelPage = source("apps/web/app/kennels/[slug]/page.tsx");
  const messagingService = source("apps/web/server/services/kennelMessaging.service.ts");
  const startPage = source("apps/web/app/inbox/messages/start/[kennelSlug]/page.tsx");
  const newPage = source("apps/web/app/inbox/messages/new/[kennelSlug]/page.tsx");
  const newRoute = source("apps/web/app/api/inbox/messages/new/route.ts");
  const replyForm = source("apps/web/components/messages/ConversationReplyForm.tsx");

  assert.ok(publicKennelPage.includes("Message Kennel"), "public kennel page adds the canonical Message Kennel action");
  assert.ok(publicKennelPage.includes("currentKennel.id !== kennel.id"), "own kennel does not render a self-message action");
  assert.ok(publicKennelPage.includes("isMessageableKennel(kennel)"), "public action reuses canonical messageability logic");
  assert.ok(publicKennelPage.includes("/inbox/messages/start/${kennel.slug}"), "public action uses the canonical start route");
  assert.ok(!publicKennelPage.includes("kennelBlock"), "public action does not introduce blocks");

  assert.ok(messagingService.includes("export function isMessageableKennel"), "messageability rule is reusable from the messaging service");
  assert.ok(messagingService.includes("export async function getMessageableKennelBySlug"), "target lookup centralizes eligibility filtering");
  assert.ok(messagingService.includes('isNpc: false'), "canonical target lookup excludes NPC kennels");
  assert.ok(messagingService.includes('moderationStatus: "ACTIVE"'), "canonical target lookup requires active moderation state");

  assert.ok(startPage.includes("findKennelConversation"), "start route performs a read-only existing conversation lookup");
  assert.ok(startPage.includes("/inbox/messages/${conversation.id}"), "existing canonical conversations are reused");
  assert.ok(startPage.includes("/inbox/messages/new/${targetKennel.slug}"), "new conversations route to a fixed-target composer");
  assert.ok(newPage.includes("Message {targetKennel.name}"), "composer names the target kennel");
  assert.ok(newPage.includes("targetKennelSlug={targetKennel.slug}"), "composer fixes its known recipient");
  assert.ok(newPage.includes("MAX_KENNEL_MESSAGE_LENGTH"), "composer uses the canonical message maximum");
  assert.ok(!newPage.includes("recipient search"), "composer does not add recipient search");

  assert.ok(replyForm.includes("targetKennelSlug"), "shared form supports the narrow first-message target payload");
  assert.ok(replyForm.includes("redirectToConversation"), "first send routes into the canonical conversation");
  assert.ok(newRoute.includes("getSessionUserId"), "first-send route authenticates server-side");
  assert.ok(newRoute.includes("getKennelForUser"), "first-send route derives the sender kennel server-side");
  assert.ok(newRoute.includes("getMessageableKennelBySlug"), "first-send route revalidates recipient eligibility");
  assert.ok(newRoute.includes("sendKennelMessage"), "first-send route delegates creation/reuse to the canonical service");
  assert.ok(!newRoute.includes("senderKennelId: payload"), "client cannot supply a sender identity");
  assert.ok(!newRoute.includes("kennelBlock"), "first-send route does not implement blocking");
  assert.ok(!newRoute.includes("kennelCommunicationReport"), "first-send route does not implement reporting");

  console.log("Kennel messaging entry-point checks passed.");
}

main();
