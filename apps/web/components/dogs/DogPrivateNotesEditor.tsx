"use client";

import { useState } from "react";

type DogPrivateNotesEditorProps = {
  action: string;
  areaId?: string | null;
  initialNotes: string;
  notesError: string | null;
  notesMessage: string | null;
};

export default function DogPrivateNotesEditor({
  action,
  areaId,
  initialNotes,
  notesError,
  notesMessage,
}: DogPrivateNotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <section className="mt-8 rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Private Notes</h2>
          <p className="mt-2 text-sm leading-6 text-purple-100/65">
            Your kennel notepad for this dog. Only you can view these notes.
          </p>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-xl border border-purple-300/25 bg-white/5 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Edit
          </button>
        ) : null}
      </div>

      {notesMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {notesMessage}
        </div>
      ) : null}

      {notesError ? (
        <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {notesError}
        </div>
      ) : null}

      {isEditing ? (
        <form action={action} method="post" className="mt-4">
          {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
          <textarea
            name="notes"
            defaultValue={initialNotes}
            maxLength={5000}
            rows={8}
            className="w-full resize-y rounded-2xl border border-purple-300/20 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-purple-100/35 focus:border-purple-300/50"
            placeholder="Keep private breeding plans, observations, or reminders here."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-purple-100/75">
          {initialNotes || "No private notes yet."}
        </div>
      )}
    </section>
  );
}
