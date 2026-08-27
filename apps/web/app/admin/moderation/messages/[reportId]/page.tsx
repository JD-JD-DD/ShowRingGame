import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatFriendlyTimestamp } from "@/lib/friendlyTimestamp";
import { KENNEL_COMMUNICATION_REPORT_REASONS } from "@/lib/kennelCommunicationReports";
import { getSessionUserId } from "@/lib/session";
import {
  getCommunicationReportDetail,
  isCommunicationModerationAdmin,
} from "@/server/services/kennelCommunicationModeration.service";

function reasonLabel(reason: string): string {
  return KENNEL_COMMUNICATION_REPORT_REASONS.find((option) => option.value === reason)?.label ?? reason;
}

export default async function CommunicationReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (!(await isCommunicationModerationAdmin(userId))) notFound();

  const { reportId } = await params;
  const report = await getCommunicationReportDetail(reportId);
  if (!report) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <nav className="theme-copy text-sm"><Link href="/admin/moderation/messages" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Kennel Communication Reports</Link></nav>
      <section className="theme-panel mt-5 rounded-2xl p-8">
        <h1 className="theme-heading text-3xl font-semibold">{report.reportType === "MESSAGE" ? "Message Report" : "Conversation Report"}</h1>
        <dl className="theme-copy mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="theme-label font-semibold">Reason</dt><dd className="mt-1">{reasonLabel(report.reason)}</dd></div>
          <div><dt className="theme-label font-semibold">Status</dt><dd className="mt-1">{report.status}</dd></div>
          <div><dt className="theme-label font-semibold">Reporter</dt><dd className="mt-1">{report.reporterKennel.name}</dd></div>
          <div><dt className="theme-label font-semibold">Reported kennel</dt><dd className="mt-1">{report.reportedKennel.name}</dd></div>
          <div><dt className="theme-label font-semibold">Submitted</dt><dd className="mt-1"><time dateTime={report.createdAt.toISOString()}>{formatFriendlyTimestamp(report.createdAt)}</time></dd></div>
          {report.resolvedAt ? <div><dt className="theme-label font-semibold">Resolved</dt><dd className="mt-1"><time dateTime={report.resolvedAt.toISOString()}>{formatFriendlyTimestamp(report.resolvedAt)}</time></dd></div> : null}
        </dl>
        {report.detail ? <div className="theme-card mt-6 rounded-xl p-4"><h2 className="theme-heading font-semibold">Reporter details</h2><p className="theme-copy mt-2 whitespace-pre-wrap break-words text-sm">{report.detail}</p></div> : null}
        {report.message ? <div className="theme-status-info mt-6 rounded-xl p-4"><h2 className="theme-heading font-semibold">Reported message</h2><p className="theme-copy mt-2 whitespace-pre-wrap break-words text-sm">{report.message.body}</p><p className="theme-label mt-3 text-xs">{report.message.senderKennel.name} · <time dateTime={report.message.createdAt.toISOString()}>{formatFriendlyTimestamp(report.message.createdAt)}</time></p></div> : null}
        <section className="mt-6"><h2 className="theme-heading text-xl font-semibold">Conversation context</h2>{report.conversation ? <ol className="mt-4 grid gap-3">{report.conversation.messages.map((message) => <li key={message.id} className="theme-card rounded-xl p-4"><p className="theme-label text-xs font-semibold">{message.senderKennel.name} · <time dateTime={message.createdAt.toISOString()}>{formatFriendlyTimestamp(message.createdAt)}</time></p><p className="theme-copy mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p></li>)}</ol> : <p className="theme-copy mt-3 text-sm">Conversation evidence is unavailable.</p>}</section>
        {report.status === "OPEN" ? <form action={`/api/admin/moderation/messages/${report.id}/resolve`} method="post" className="mt-6"><button type="submit" className="theme-primary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Mark Resolved</button></form> : null}
      </section>
    </main>
  );
}
