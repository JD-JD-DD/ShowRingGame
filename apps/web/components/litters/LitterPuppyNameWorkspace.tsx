"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";
import {
  MAX_CALL_NAME_LENGTH,
  MAX_REGISTERED_NAME_LENGTH,
} from "@/server/validation/dogName.validation";

export function LitterPuppyNameWorkspace({
  litterId,
  puppy,
  onClose,
}: {
  litterId: string;
  puppy: LitterPuppyDto;
  onClose: () => void;
}) {
  const router = useRouter();
  const [callName, setCallName] = useState(puppy.callName ?? "");
  const [registeredName, setRegisteredName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/litters/${litterId}/puppies/${puppy.dogId}/name`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callName,
            ...(registeredName.trim() ? { registeredName } : {}),
          }),
        }
      );
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Failed to update puppy name.");
        if (response.status === 403 || response.status === 404) {
          router.refresh();
        }
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Failed to update puppy name.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="theme-card mt-5 rounded-2xl p-5" aria-labelledby="name-puppy-heading">
      <h3 id="name-puppy-heading" className="theme-heading text-lg font-semibold">
        Name Puppy
      </h3>
      <p className="theme-copy mt-1 text-sm">
        {puppy.displayName} · {puppy.regNumber}
      </p>

      <form onSubmit={save} className="mt-5 grid max-w-xl gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Call name
          <input
            type="text"
            value={callName}
            maxLength={MAX_CALL_NAME_LENGTH}
            onChange={(event) => setCallName(event.target.value)}
            className="dog-control rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          />
        </label>

        {puppy.registeredName ? (
          <div className="grid gap-1 text-sm">
            <span className="font-semibold">Registered name</span>
            <span className="theme-copy">{puppy.registeredName}</span>
            <span className="theme-copy text-xs">
              Registered name is permanent once assigned.
            </span>
          </div>
        ) : puppy.actionEligibility.canAssignRegisteredName ? (
          <label className="grid gap-2 text-sm font-semibold">
            Registered name
            <input
              type="text"
              value={registeredName}
              maxLength={MAX_REGISTERED_NAME_LENGTH}
              onChange={(event) => setRegisteredName(event.target.value)}
              className="dog-control rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            />
          </label>
        ) : null}

        {error ? (
          <p className="theme-status-danger rounded-xl px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
