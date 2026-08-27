import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatFriendlyTimestamp } from "@/lib/friendlyTimestamp";
import { KENNEL_COMMUNICATION_REPORT_REASONS } from "@/lib/kennelCommunicationReports";
import { getSessionUserId } from "@/lib/session";
import {
  isCommunicationModerationAdmin,
  listCommunicationReports,
} from "@/server/services/kennelCommunicationModeration.service";

function reasonLabel(reason: string): string {
  return KENNEL_COMMUNICATION_REPORT_REASONS.find((option) => option.value === reason)?.label ?? reason;
}

export default async function CommunicationModerationQueuePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (!(await isCommunicationModerationAdmin(userId))) notFound();

  const reports = await listCommunicationReports();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel rounded-2xl p-8">
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.25em]">Administration</p>
        <h1 className="theme-heading mt-2 text-3xl font-semibold">Kennel Communication Reports</h1>
        <p className="theme-copy mt-3 text-sm">Open reports, newest first.</p>
      </section>
      <section className="theme-panel mt-6 overflow-x-auto rounded-2xl p-5">
        {reports.length === 0 ? (
          <p className="theme-copy">No open communication reports.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="theme-label border-b border-[var(--color-border)] text-xs uppercase tracking-wide">
              <tr><th className="px-3 py-3">Submitted</th><th className="px-3 py-3">Reason</th><th className="px-3 py-3">Reporter</th><th className="px-3 py-3">Reported</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Status</th><th className="px-3 py-3"><span className="sr-only">Open report</span></th></tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="theme-copy px-3 py-3"><time dateTime={report.createdAt.toISOString()}>{formatFriendlyTimestamp(report.createdAt)}</time></td>
                  <td className="theme-copy px-3 py-3">{reasonLabel(report.reason)}</td>
                  <td className="theme-copy px-3 py-3">{report.reporterKennel.name}</td>
                  <td className="theme-copy px-3 py-3">{report.reportedKennel.name}</td>
                  <td className="theme-copy px-3 py-3">{report.reportType === "MESSAGE" ? "Message report" : "Conversation report"}</td>
                  <td className="theme-copy px-3 py-3">{report.status}</td>
                  <td className="px-3 py-3"><Link href={`/admin/moderation/messages/${report.id}`} className="theme-secondary-button rounded-lg px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
