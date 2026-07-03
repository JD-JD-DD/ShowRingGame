"use client";

import { useState } from "react";

type DogPrivateNotesEditorProps = {
  action: string;
  initialNotes: string;
  notesError: string | null;
  notesMessage: string | null;
};

export default function DogPrivateNotesEditor({
  action,
  initialNotes,
  notesError,
  notesMessage,
}: DogPrivateNotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <section className="dog-card rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="dog-heading text-xl font-semibold">Private Notes</h2>
          <p className="dog-copy mt-2 text-sm leading-6">
            Your kennel notepad for this dog. Only you can view these notes.
          </p>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
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
          <textarea
            name="notes"
            defaultValue={initialNotes}
            maxLength={5000}
            rows={8}
            className="dog-control w-full resize-y rounded-2xl px-4 py-3 text-sm leading-7 outline-none placeholder:text-purple-400/60 focus:border-purple-400"
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
              className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="dog-card dog-copy mt-4 whitespace-pre-wrap rounded-2xl p-4 text-sm leading-7">
          {initialNotes || "No private notes yet."}
        </div>
      )}
    </section>
  );
}
