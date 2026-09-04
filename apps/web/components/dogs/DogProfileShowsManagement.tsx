import Link from "next/link";

import type { DogProfileDto } from "@/server/mappers/dog.mapper";

type Props = {
  dogId: string;
  entries: DogProfileDto["entries"];
  kennelRunId: string | null;
  showMessage: string | null;
  showError: string | null;
};

function withKennelRunContext(action: string, kennelRunId: string | null) {
  if (!kennelRunId) return action;

  const url = new URL(action, "http://dog-page.local");
  url.searchParams.set("kennelRunId", kennelRunId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function DogProfileShowsManagement({
  dogId,
  entries,
  kennelRunId,
  showMessage,
  showError,
}: Props) {
  if (!entries) return null;

  return (
    <div className="space-y-3">
      <p className="theme-copy text-sm">
        {entries.currentEntriesCount} current {entries.currentEntriesCount === 1 ? "entry" : "entries"}
      </p>
      {showMessage ? <div className="theme-notice theme-notice--success rounded-xl px-4 py-3 text-sm">{showMessage}</div> : null}
      {showError ? <div className="theme-notice theme-notice--danger rounded-xl px-4 py-3 text-sm">{showError}</div> : null}
      {entries.nextEntries.length > 0 ? (
        entries.nextEntries.map((entry) => (
          <div key={entry.entryId} className="dog-card rounded-xl px-4 py-3 text-sm">
            <Link href={entry.showUrl} className="dog-heading font-semibold hover:underline">
              {entry.showName}
            </Link>
            <div className="dog-copy mt-1 text-xs">
              {entry.showDateLabel} · Day {entry.showDayNumber} · {entry.district}
            </div>
            {entry.canPullEntry && entry.pullEntryActionUrl ? (
              <form
                action={withKennelRunContext(entry.pullEntryActionUrl, kennelRunId)}
                method="post"
                className="mt-2"
              >
                <input type="hidden" name="dogId" value={dogId} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-700 dark:text-red-200"
                >
                  Pull entry
                </button>
              </form>
            ) : null}
          </div>
        ))
      ) : (
        <div className="dog-card dog-copy rounded-xl p-4 text-sm">No upcoming show entries.</div>
      )}
    </div>
  );
}
