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
  const presentation = source("apps/web/lib/kennelCommunicationReports.ts");
  const thread = source("apps/web/app/inbox/messages/[conversationId]/page.tsx");
  const control = source("apps/web/components/messages/ConversationReportControl.tsx");
  const messageRoute = source("apps/web/app/api/inbox/messages/[conversationId]/report-message/route.ts");
  const conversationRoute = source("apps/web/app/api/inbox/messages/[conversationId]/report-conversation/route.ts");

  assert.ok(presentation.includes("MAX_KENNEL_REPORT_DETAIL_LENGTH = 2000"), "report details have one shared limit");
  assert.ok(service.includes("normalizeKennelCommunicationReportReason"), "report reasons are validated canonically");
  assert.ok(service.includes("normalizeKennelCommunicationReportDetail"), "optional detail is normalized canonically");
  assert.ok(service.includes("reportKennelConversationMessage"), "received-message reports use the service");
  assert.ok(service.includes("message.senderKennel.id === args.requestingKennelId"), "own messages cannot be reported");
  assert.ok(service.includes("conversationId: conversation.id"), "message reports retain conversation evidence");
  assert.ok(service.includes("messageId: message.id"), "message reports retain exact message evidence");
  assert.ok(service.includes("messageId: null"), "conversation reports have no selected message");
  assert.ok(service.includes('status: "OPEN"'), "new reports use the existing initial status");
  assert.ok(!service.includes("createKennelNotice"), "report submission does not create notices");

  assert.ok(presentation.includes('"HARASSMENT"'), "presentation uses the existing report reason values");
  assert.ok(presentation.includes('label: "Hate speech"'), "presentation shows player-facing reason labels");
  assert.ok(!presentation.includes("INAPPROPRIATE_CONTENT"), "no replacement reason enum was introduced");

  for (const route of [messageRoute, conversationRoute]) {
    assert.ok(route.includes("getSessionUserId"), "report mutation authenticates");
    assert.ok(route.includes("getKennelForUser"), "report mutation derives the requesting kennel");
    assert.ok(!route.includes("reportedKennelId"), "client cannot supply a reported kennel");
  }
  assert.ok(messageRoute.includes("reportKennelConversationMessage"), "message route delegates authorization and evidence derivation to the service");
  assert.ok(conversationRoute.includes("reportKennelConversation"), "conversation route delegates authorization and evidence derivation to the service");

  assert.ok(thread.includes("ConversationReportControl"), "thread renders the shared reporting control");
  assert.ok(thread.includes("!isCurrentKennel"), "only received messages have a Report action");
  assert.ok(control.includes("Report Message"), "shared form identifies message reports");
  assert.ok(control.includes("Report Conversation"), "shared form identifies conversation reports");
  assert.ok(control.includes("Submit Report"), "shared form has a semantic submission action");
  assert.ok(control.includes("Cancel"), "shared form can be cancelled");
  assert.ok(control.includes("focus-visible:outline"), "report controls have visible keyboard focus");

  console.log("Kennel messaging report checks passed.");
}

main();
