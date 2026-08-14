"use client";

import { useEffect, useState } from "react";

import {
  MAX_CALL_NAME_LENGTH,
} from "@/server/validation/dogName.validation";

type BulkNamingDog = {
  dogId: string;
  regNumber: string;
  sex: "M" | "F";
  registeredName: string | null;
  callName: string | null;
};

type Props = {
  kennelRunId: string;
  runName: string;
  dogs: BulkNamingDog[];
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function BulkCallNameEditor({
  kennelRunId,
  runName,
  dogs,
  onClose,
  onSaved,
}: Props) {
  const [callNames, setCallNames] = useState<Record<string, string>>({});
  const [registeredNames, setRegisteredNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingRegisteredNames, setConfirmingRegisteredNames] = useState(false);

  useEffect(() => {
    setCallNames(
      Object.fromEntries(dogs.map((dog) => [dog.dogId, dog.callName ?? ""]))
    );
    setRegisteredNames({});
    setError(null);
    setConfirmingRegisteredNames(false);
  }, [dogs]);

  const hasNewRegisteredNames = dogs.some(
    (dog) => !dog.registeredName && Boolean(registeredNames[dog.dogId]?.trim())
  );

  async function save() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/kennel/dogs/bulk-call-names", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kennelRunId,
          updates: dogs.map((dog) => ({
            dogId: dog.dogId,
            callName: callNames[dog.dogId] ?? "",
            ...(!dog.registeredName && registeredNames[dog.dogId]?.trim()
              ? { registeredName: registeredNames[dog.dogId] }
              : {}),
          })),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        updatedCount?: number;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to update call names.");
      }

      await onSaved();
      setMessage(
        `Updated ${data.updatedCount ?? dogs.length} dog name${
          (data.updatedCount ?? dogs.length) === 1 ? "" : "s"
        }.`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update names."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (hasNewRegisteredNames && !confirmingRegisteredNames) {
      setConfirmingRegisteredNames(true);
      return;
    }

    void save();
  }

  return (
    <section className="theme-card mb-4 rounded-2xl p-4" aria-labelledby="bulk-naming-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="bulk-naming-heading" className="theme-heading text-sm font-semibold">
            Bulk Naming
          </h2>
          <p className="theme-copy mt-1 text-xs">
            Edit call names for every dog in {runName}. Registered names are permanent once assigned.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={submit} className="mt-4">
        {dogs.length === 0 ? (
          <p className="theme-copy rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm">
            This run is empty.
          </p>
        ) : (
          <div className="grid gap-2">
            <div className="hidden grid-cols-[minmax(9rem,1fr)_minmax(12rem,1.5fr)_minmax(12rem,1.5fr)] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] md:grid">
              <span>Registration</span>
              <span>Registered Name</span>
              <span>Call Name</span>
            </div>
            {dogs.map((dog) => (
              <div
                key={dog.dogId}
                className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 md:grid-cols-[minmax(9rem,1fr)_minmax(12rem,1.5fr)_minmax(12rem,1.5fr)] md:items-center md:gap-3"
              >
                <div className="min-w-0 text-sm">
                  <span className="theme-label mr-2 text-[0.68rem] uppercase tracking-wide md:hidden">Registration</span>
                  <span className="font-semibold">{dog.regNumber}</span>
                  <span className="theme-copy ml-2">&middot; {dog.sex}</span>
                </div>
                <div className="min-w-0 text-sm">
                  <span className="theme-label mr-2 text-[0.68rem] uppercase tracking-wide md:hidden">Registered Name</span>
                  {dog.registeredName ? (
                    <span className="theme-copy">{dog.registeredName}</span>
                  ) : (
                    <label className="grid gap-1">
                      <span className="theme-label text-[0.68rem] uppercase tracking-wide md:sr-only">Registered Name</span>
                      <input
                        type="text"
                        value={registeredNames[dog.dogId] ?? ""}
                        maxLength={45}
                        onChange={(event) => {
                          setRegisteredNames((current) => ({
                            ...current,
                            [dog.dogId]: event.target.value,
                          }));
                          setConfirmingRegisteredNames(false);
                        }}
                        className="theme-control w-full rounded-lg px-3 py-2 text-sm outline-none"
                        placeholder="Registered name"
                      />
                    </label>
                  )}
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="theme-label text-[0.68rem] uppercase tracking-wide md:sr-only">Call Name</span>
                  <input
                    type="text"
                    value={callNames[dog.dogId] ?? ""}
                    maxLength={MAX_CALL_NAME_LENGTH}
                    onChange={(event) =>
                      setCallNames((current) => ({
                        ...current,
                        [dog.dogId]: event.target.value,
                      }))
                    }
                    className="theme-control w-full rounded-lg px-3 py-2 text-sm outline-none"
                    placeholder="Call name"
                  />
                </label>
              </div>
            ))}
          </div>
        )}

        {error ? (
          <p className="theme-status-danger mt-3 rounded-xl px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="theme-status-success mt-3 rounded-xl px-3 py-2 text-sm" role="status">
            {message}
          </p>
        ) : null}

        {confirmingRegisteredNames ? (
          <div className="theme-status-danger mt-3 rounded-xl px-3 py-3 text-sm">
            <p className="font-semibold">Confirm permanent registered names.</p>
            <p className="mt-1">
              Registered names cannot be changed after confirmation. Call names remain editable.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={isSaving}
                className="theme-status-danger rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                Confirm and Submit
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRegisteredNames(false)}
                disabled={isSaving}
                className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                Back
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving || dogs.length === 0}
            className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSaving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </section>
  );
}
