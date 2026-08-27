import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;
  return readFileSync(join(root, path), "utf8");
}

function main() {
  const moderationService = source("apps/web/server/services/kennelCommunicationModeration.service.ts");
  const messagingService = source("apps/web/server/services/kennelMessaging.service.ts");
  const queuePage = source("apps/web/app/admin/moderation/messages/page.tsx");
  const detailPage = source("apps/web/app/admin/moderation/messages/[reportId]/page.tsx");
  const resolveRoute = source("apps/web/app/api/admin/moderation/messages/[reportId]/resolve/route.ts");
  const noticesPage = source("apps/web/app/notices/page.tsx");

  assert.ok(moderationService.includes('COMMUNICATION_MODERATION_ADMIN_KENNEL_SLUG = "devtest"'), "designated notice recipient is centralized");
  assert.ok(moderationService.includes("user?.isAdmin === true"), "admin authorization uses User.isAdmin");
  assert.ok(moderationService.includes("where: { slug: COMMUNICATION_MODERATION_ADMIN_KENNEL_SLUG }"), "notice recipient is resolved by the designated slug");
  assert.ok(moderationService.includes("adminKennel?.user?.isAdmin"), "designated recipient must belong to an admin user");
  assert.ok(moderationService.includes("kennel-message-report:${reportId}:${adminKennel.id}"), "notice source key is stable per report and recipient");
  assert.ok(moderationService.includes('type: "KENNEL_SERVICE"'), "existing generic service notice type is reused");
  assert.ok(moderationService.includes("metadataJson: { href, reportId"), "notice stores a server-constructed deep link");
  assert.ok(moderationService.includes("communication-report-notice-recipient-unavailable"), "missing recipient preserves the report and logs delivery failure");
  assert.ok(moderationService.includes("orderBy: [{ createdAt: \"desc\" }, { id: \"desc\" }]"), "queue order is newest first with deterministic ties");
  assert.ok(moderationService.includes("take: COMMUNICATION_REPORT_QUEUE_LIMIT"), "queue is bounded");
  assert.ok(moderationService.includes("take: 50"), "conversation evidence is bounded");
  assert.ok(moderationService.includes('data: { status: "RESOLVED", resolvedAt: new Date() }'), "resolution updates only the existing status lifecycle");
  assert.ok(!moderationService.includes("ban"), "moderation queue adds no sanctions");

  assert.ok(messagingService.includes("createCommunicationReportAdminNotice(report.id)"), "notice delivery is triggered from shared report creation");
  assert.ok(queuePage.includes("isCommunicationModerationAdmin"), "queue is server-side admin protected");
  assert.ok(detailPage.includes("isCommunicationModerationAdmin"), "detail is server-side admin protected");
  assert.ok(resolveRoute.includes("isCommunicationModerationAdmin"), "resolution API is server-side admin protected");
  assert.ok(resolveRoute.includes("markCommunicationReportResolved"), "resolution API delegates to the moderation service");
  assert.ok(noticesPage.includes('explicitHref?.startsWith("/admin/moderation/messages/")'), "Notices has a narrow admin report deep-link branch");

  console.log("Kennel communication moderation checks passed.");
}

main();
