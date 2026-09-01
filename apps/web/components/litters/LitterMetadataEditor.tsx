"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { getLitterDisplayName } from "@/lib/litterDisplayName";

type Props = {
  litterId: string;
  customName: string | null;
  breederNote: string | null;
  serial7: string;
};

export function LitterMetadataEditor({
  litterId,
  customName: initialCustomName,
  breederNote: initialBreederNote,
  serial7,
}: Props) {
  const router = useRouter();
  const [customName, setCustomName] = useState(initialCustomName);
  const [breederNote, setBreederNote] = useState(initialBreederNote);
  const [nameInput, setNameInput] = useState(initialCustomName ?? "");
  const [noteInput, setNoteInput] = useState(initialBreederNote ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function beginEditing() {
    setNameInput(customName ?? "");
    setNoteInput(breederNote ?? "");
    setError("");
    setSuccess("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setNameInput(customName ?? "");
    setNoteInput(breederNote ?? "");
    setError("");
    setIsEditing(false);
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/litters/${litterId}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customName: nameInput, breederNote: noteInput }),
      });
      const payload = (await response.json().catch(() => null)) as {
        customName?: unknown;
        breederNote?: unknown;
        error?: unknown;
      } | null;

      if (!response.ok) {
        setError(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to save litter details."
        );
        return;
      }

      const nextCustomName =
        typeof payload?.customName === "string" ? payload.customName : null;
      const nextBreederNote =
        typeof payload?.breederNote === "string" ? payload.breederNote : null;
      setCustomName(nextCustomName);
      setBreederNote(nextBreederNote);
      setNameInput(nextCustomName ?? "");
      setNoteInput(nextBreederNote ?? "");
      setIsEditing(false);
      setSuccess("Litter details saved.");
      router.refresh();
    } catch {
      setError("Unable to save litter details.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-2">
      {isEditing ? (
        <form onSubmit={saveMetadata} className="grid max-w-2xl gap-4">
          <label className="grid gap-2" htmlFor="litter-name">
            <span className="theme-heading text-sm font-semibold">Litter name</span>
            <input
              id="litter-name"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              maxLength={25}
              className="theme-control rounded-xl px-3 py-2"
            />
          </label>

          <div className="grid gap-2">
            <label htmlFor="litter-breeder-note" className="theme-heading text-sm font-semibold">
              Private breeder note
            </label>
            <p id="litter-breeder-note-help" className="theme-copy text-sm">
              Only your kennel can see this note.
            </p>
            <textarea
              id="litter-breeder-note"
              value={noteInput}
              onChange={(event) => setNoteInput(event.target.value)}
              maxLength={2000}
              aria-describedby="litter-breeder-note-help"
              className="theme-control min-h-32 rounded-xl px-3 py-2"
            />
          </div>

          {error ? (
            <p role="alert" className="theme-status-danger rounded-2xl px-4 py-3 text-sm font-medium">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="theme-control rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="theme-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                {getLitterDisplayName(customName, serial7)}
              </h1>
              {customName ? (
                <p className="theme-copy mt-1 text-sm">Serial {serial7}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={beginEditing}
              className="theme-control rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            >
              Edit
            </button>
          </div>

          <div className="mt-4">
            <div className="theme-heading text-sm font-semibold">Private breeder note</div>
            <p className="theme-copy mt-1 text-sm">Only your kennel can see this note.</p>
            {breederNote ? (
              <p className="theme-copy mt-2 whitespace-pre-wrap text-sm leading-6">{breederNote}</p>
            ) : (
              <p className="theme-copy mt-2 text-sm">No private note.</p>
            )}
          </div>
        </div>
      )}

      {success ? (
        <p role="status" aria-live="polite" className="theme-status-success mt-4 rounded-2xl px-4 py-3 text-sm font-medium">
          {success}
        </p>
      ) : null}
    </section>
  );
}
