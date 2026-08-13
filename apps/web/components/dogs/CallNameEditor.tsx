"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MAX_CALL_NAME_LENGTH } from "@/server/validation/dogName.validation";

type Props = {
  action: string;
  callName: string | null;
  canEdit: boolean;
};

export default function CallNameEditor({ action, callName, canEdit }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(callName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) setValue(callName ?? "");
  }, [callName, isEditing]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(action, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Failed to update call name.");
        return;
      }

      setIsEditing(false);
      router.refresh();
    } catch {
      setError("Failed to update call name.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <form onSubmit={save} className="mt-1 flex max-w-md flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="call-name">
          Call name
        </label>
        <input
          id="call-name"
          name="callName"
          type="text"
          value={value}
          maxLength={MAX_CALL_NAME_LENGTH}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          className="dog-control min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
          placeholder="Call name"
        />
        <button
          type="submit"
          disabled={isSaving}
          className="theme-primary-button rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            setValue(callName ?? "");
            setError(null);
            setIsEditing(false);
          }}
          className="dog-secondary-button rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        {error ? (
          <p className="theme-status-danger basis-full rounded-lg px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  if (!callName && !canEdit) return null;

  return (
    <div className="mt-1 flex items-center gap-1.5 text-lg text-[var(--color-text-secondary)]">
      {callName ? <span>&quot;{callName}&quot;</span> : <span className="text-sm">Add call name</span>}
      {canEdit ? (
        <button
          type="button"
          aria-label="Edit call name"
          onClick={() => setIsEditing(true)}
          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
