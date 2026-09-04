import type { DogProfileDto } from "@/server/mappers/dog.mapper";

import DogPrivateNotesEditor from "./DogPrivateNotesEditor";

type Props = {
  profile: DogProfileDto;
  kennelRunId: string | null;
  notesMessage: string | null;
  notesError: string | null;
};

function withKennelRunContext(action: string, kennelRunId: string | null) {
  if (!kennelRunId) return action;

  const url = new URL(action, "http://dog-page.local");
  url.searchParams.set("kennelRunId", kennelRunId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function DogProfilePrivatePlanning({
  profile,
  kennelRunId,
  notesMessage,
  notesError,
}: Props) {
  const planning = profile.privatePlanning;

  if (!profile.viewerContext.canViewPrivatePlanning || !planning) return null;

  return (
    <section className="mt-8 border-t border-[var(--color-border)] pt-6" aria-labelledby="private-kennel-notes-heading">
      <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Owner only</p>
      <h3 id="private-kennel-notes-heading" className="theme-heading mt-2 text-xl font-semibold">Private Kennel Notes</h3>
      {planning.programPlannerTags.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {planning.programPlannerTags.map((tag) => (
            <div key={`${tag.tagTypeLabel}-${tag.updatedAt}`} className="dog-card rounded-xl px-4 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="dog-heading font-semibold">{tag.tagTypeLabel}</span>
                <span className="dog-label text-xs">{tag.goalLabel}</span>
              </div>
              <div className="dog-copy mt-2 whitespace-pre-wrap">{tag.note ?? "No planner note saved."}</div>
            </div>
          ))}
        </div>
      ) : null}
      {planning.canEditNotes ? (
        <div className="mt-4">
          <DogPrivateNotesEditor
            action={withKennelRunContext(`/api/dogs/${profile.header.dogId}/notes`, kennelRunId)}
            initialNotes={planning.notes ?? ""}
            notesError={notesError}
            notesMessage={notesMessage}
          />
        </div>
      ) : null}
    </section>
  );
}
