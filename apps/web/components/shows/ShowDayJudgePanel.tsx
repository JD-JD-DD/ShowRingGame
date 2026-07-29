import Link from "next/link";

export type ShowDayJudgePanelDto = {
  assignments: Array<{ groupCode: string; groupLabel: string; judgeName: string; judgeProfileUrl: string; isBestInShowJudge: boolean }>;
  bestInShowJudge: { judgeName: string; judgeProfileUrl: string } | null;
  unavailable: boolean;
};

export function ShowDayJudgePanel({ panel }: { panel: ShowDayJudgePanelDto }) {
  if (panel.unavailable) return <p className="theme-copy text-sm">Judge assignments are not available for this show day yet.</p>;
  return <section aria-label="Judging panel" className="space-y-2"><h3 className="theme-heading text-sm font-semibold">Group Judges</h3><div className="grid gap-1 text-sm sm:grid-cols-2">{panel.assignments.map((assignment) => <div key={assignment.groupCode}><span className="theme-copy">{assignment.groupLabel} — </span><Link href={assignment.judgeProfileUrl} className="theme-heading font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">{assignment.judgeName}</Link>{assignment.isBestInShowJudge ? <span className="theme-copy ml-1 text-xs">(BIS Judge)</span> : null}</div>)}</div>{panel.bestInShowJudge ? <div className="theme-copy text-sm">Best in Show — <Link href={panel.bestInShowJudge.judgeProfileUrl} className="theme-heading font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">{panel.bestInShowJudge.judgeName}</Link></div> : null}<p className="theme-copy text-xs">Select a judge&apos;s name to view their biography and judging preferences.</p></section>;
}
