import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;
  return readFileSync(join(root, path), "utf8");
}

function main() {
  const listPage = source("apps/web/app/inbox/messages/page.tsx");
  const conversationPage = source("apps/web/app/inbox/messages/[conversationId]/page.tsx");
  const replyForm = source("apps/web/components/messages/ConversationReplyForm.tsx");
  const sendRoute = source("apps/web/app/api/inbox/messages/[conversationId]/route.ts");

  assert.ok(listPage.includes("getSessionUserId"), "Messages inbox authenticates");
  assert.ok(listPage.includes("getKennelForUser"), "Messages inbox resolves the current kennel");
  assert.ok(listPage.includes("listKennelConversationSummaries"), "Messages inbox uses canonical summaries");
  assert.ok(listPage.includes("formatFriendlyTimestamp"), "Messages inbox uses the shared timestamp helper");
  assert.ok(listPage.includes("Unread"), "Messages inbox renders a non-color-only unread marker");
  assert.ok(listPage.includes("/inbox/messages/${conversation.id}"), "summary rows link to the canonical conversation route");
  assert.ok(listPage.includes("You do not have any kennel messages yet."), "Messages inbox has an empty state");
  assert.ok(!listPage.includes("New Message"), "Messages inbox does not add a new-conversation control");

  assert.ok(conversationPage.includes("loadKennelConversationHistory"), "conversation page loads canonical history");
  assert.ok(conversationPage.includes("markKennelConversationRead"), "opening a conversation marks only its participant read");
  assert.ok(conversationPage.includes("notFound()"), "unauthorized or unknown conversations do not leak details");
  assert.ok(conversationPage.includes("formatFriendlyTimestamp"), "thread timestamps use the shared helper");
  assert.ok(conversationPage.includes("whitespace-pre-wrap"), "thread rendering preserves line breaks as plain text");
  assert.ok(conversationPage.includes("You"), "thread labels current-kennel messages textually");
  assert.ok(!conversationPage.includes("dangerouslySetInnerHTML"), "thread does not render HTML payloads");

  assert.ok(replyForm.includes("<textarea"), "reply UI uses a textarea");
  assert.ok(replyForm.includes("htmlFor=\"message-reply-body\""), "textarea has an associated visible label");
  assert.ok(replyForm.includes("maxLength={maxLength}"), "reply UI uses the canonical message length limit");
  assert.ok(replyForm.includes("aria-invalid"), "reply errors are exposed to assistive technology");
  assert.ok(replyForm.includes("Sending…"), "pending send state is communicated textually");
  assert.ok(replyForm.includes("router.refresh()"), "successful replies refresh the thread");

  assert.ok(sendRoute.includes("getSessionUserId"), "reply route authenticates server-side");
  assert.ok(sendRoute.includes("getKennelForUser"), "reply route derives the sender kennel server-side");
  assert.ok(sendRoute.includes("loadKennelConversationHistory"), "reply route verifies conversation participation");
  assert.ok(sendRoute.includes("recipientKennel"), "reply route derives the other participant server-side");
  assert.ok(sendRoute.includes("sendKennelMessage"), "reply route delegates mutation to the canonical messaging service");
  assert.ok(!sendRoute.includes("senderKennelId: payload"), "client cannot impersonate a sender kennel");
  assert.ok(!sendRoute.includes("recipientKennelId: payload"), "client cannot choose an arbitrary recipient kennel");
  assert.ok(!sendRoute.includes("kennelBlock"), "reply route does not implement block behavior early");
  assert.ok(!sendRoute.includes("kennelCommunicationReport"), "reply route does not implement report behavior early");

  console.log("Messages UI checks passed.");
}

main();
