import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { createKennelNotice } from "@/server/services/kennelNotice.service";

export const COMMUNICATION_MODERATION_ADMIN_KENNEL_SLUG = "devtest";
export const COMMUNICATION_REPORT_QUEUE_LIMIT = 50;

type KennelIdentity = { id: string; name: string; slug: string };

export type CommunicationReportQueueItem = {
  id: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  createdAt: Date;
  reporterKennel: KennelIdentity;
  reportedKennel: KennelIdentity;
  reportType: "MESSAGE" | "CONVERSATION";
};

export type CommunicationReportDetail = CommunicationReportQueueItem & {
  detail: string | null;
  resolvedAt: Date | null;
  message: {
    id: string;
    body: string;
    createdAt: Date;
    senderKennel: KennelIdentity;
  } | null;
  conversation: {
    id: string;
    firstKennel: KennelIdentity;
    secondKennel: KennelIdentity;
    messages: Array<{
      id: string;
      body: string;
      createdAt: Date;
      senderKennel: KennelIdentity;
    }>;
  } | null;
};

type ModerationClient = {
  user: { findUnique(args: unknown): Promise<{ isAdmin: boolean } | null> };
  kennel: {
    findUnique(args: unknown): Promise<{
      id: string;
      user: { isAdmin: boolean } | null;
    } | null>;
  };
  kennelCommunicationReport: {
    findMany(args: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown | null>;
    update(args: unknown): Promise<unknown>;
  };
};

function client(): ModerationClient {
  return db as unknown as ModerationClient;
}

export async function isCommunicationModerationAdmin(userId: string): Promise<boolean> {
  const user = await client().user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  return user?.isAdmin === true;
}

function toQueueItem(report: {
  id: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  createdAt: Date;
  messageId: string | null;
  reporterKennel: KennelIdentity;
  reportedKennel: KennelIdentity;
}): CommunicationReportQueueItem {
  return {
    id: report.id,
    reason: report.reason,
    status: report.status,
    createdAt: report.createdAt,
    reporterKennel: report.reporterKennel,
    reportedKennel: report.reportedKennel,
    reportType: report.messageId ? "MESSAGE" : "CONVERSATION",
  };
}

export async function listCommunicationReports(): Promise<CommunicationReportQueueItem[]> {
  const reports = await client().kennelCommunicationReport.findMany({
    where: { status: "OPEN" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: COMMUNICATION_REPORT_QUEUE_LIMIT,
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      messageId: true,
      reporterKennel: { select: { id: true, name: true, slug: true } },
      reportedKennel: { select: { id: true, name: true, slug: true } },
    },
  }) as Array<Parameters<typeof toQueueItem>[0]>;
  return reports.map(toQueueItem);
}

export async function getCommunicationReportDetail(
  reportId: string
): Promise<CommunicationReportDetail | null> {
  const report = await client().kennelCommunicationReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      messageId: true,
      detail: true,
      reporterKennel: { select: { id: true, name: true, slug: true } },
      reportedKennel: { select: { id: true, name: true, slug: true } },
      message: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderKennel: { select: { id: true, name: true, slug: true } },
        },
      },
      conversation: {
        select: {
          id: true,
          firstKennel: { select: { id: true, name: true, slug: true } },
          secondKennel: { select: { id: true, name: true, slug: true } },
          messages: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 50,
            select: {
              id: true,
              body: true,
              createdAt: true,
              senderKennel: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
    },
  }) as (CommunicationReportDetail & { messageId: string | null }) | null;

  if (!report) return null;
  return {
    ...toQueueItem(report),
    detail: report.detail,
    resolvedAt: report.resolvedAt,
    message: report.message,
    conversation: report.conversation
      ? { ...report.conversation, messages: [...report.conversation.messages].reverse() }
      : null,
  };
}

export async function markCommunicationReportResolved(reportId: string): Promise<boolean> {
  const report = await client().kennelCommunicationReport.findUnique({
    where: { id: reportId },
    select: { id: true, status: true },
  }) as { id: string; status: "OPEN" | "RESOLVED" } | null;
  if (!report) return false;
  if (report.status === "RESOLVED") return true;

  await client().kennelCommunicationReport.update({
    where: { id: report.id },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  return true;
}

export async function createCommunicationReportAdminNotice(reportId: string): Promise<void> {
  try {
    const adminKennel = await client().kennel.findUnique({
      where: { slug: COMMUNICATION_MODERATION_ADMIN_KENNEL_SLUG },
      select: { id: true, user: { select: { isAdmin: true } } },
    });
    if (!adminKennel?.user?.isAdmin) {
      console.error("communication-report-notice-recipient-unavailable", { reportId });
      return;
    }

    const href = `/admin/moderation/messages/${reportId}`;
    await createKennelNotice({
      kennelId: adminKennel.id,
      sourceKey: `kennel-message-report:${reportId}:${adminKennel.id}`,
      type: "KENNEL_SERVICE",
      title: "Kennel messaging report requires review",
      body: "A kennel messaging report has been submitted for moderation review.",
      currentEpoch: getCurrentEpoch(),
      metadataJson: { href, reportId, kind: "KENNEL_COMMUNICATION_REPORT" },
    });
  } catch (error) {
    console.error("communication-report-notice-delivery-failed", {
      reportId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
