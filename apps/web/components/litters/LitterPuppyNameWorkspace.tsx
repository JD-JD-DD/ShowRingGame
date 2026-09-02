"use client";

import { useMemo, useState } from "react";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";
import {
  MAX_CALL_NAME_LENGTH,
  MAX_REGISTERED_NAME_LENGTH,
} from "@/server/validation/dogName.validation";

type NameDraft = { callName: string; registeredName: string };
export type LitterPuppyNamingResult = {
  updatedCount: number;
  skipped: { dogId: string; reason: string }[];
};

export function LitterPuppyNameWorkspace({
  litterId,
  eligiblePuppies,
  skippedPuppies: _skippedPuppies,
  onClose,
  onComplete,
}: {
  litterId: string;
  eligiblePuppies: LitterPuppyDto[];
  skippedPuppies: LitterPuppyDto[];
  onClose: () => void;
  onComplete: (result: LitterPuppyNamingResult) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, NameDraft>>(() =>
    Object.fromEntries(eligiblePuppies.map((puppy) => [puppy.dogId, {
      callName: puppy.callName ?? "", registeredName: "",
    }]))
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingRegisteredNames, setConfirmingRegisteredNames] = useState(false);

  const updates = useMemo(() => eligiblePuppies.flatMap((puppy) => {
    const draft = drafts[puppy.dogId] ?? { callName: puppy.callName ?? "", registeredName: "" };
    const callNameChanged = draft.callName !== (puppy.callName ?? "");
    const hasNewRegisteredName = !puppy.registeredName &&
      puppy.actionEligibility.canAssignRegisteredName && Boolean(draft.registeredName.trim());
    if (!callNameChanged && !hasNewRegisteredName) return [];
    return [{
      dogId: puppy.dogId,
      ...(callNameChanged ? { callName: draft.callName } : {}),
      ...(hasNewRegisteredName ? { registeredName: draft.registeredName } : {}),
    }];
  }), [drafts, eligiblePuppies]);
  const hasNewRegisteredNames = updates.some((update) => update.registeredName?.trim());

  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/litters/${litterId}/puppies/bulk-name`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates }),
      });
      const result = (await response.json()) as LitterPuppyNamingResult & { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Failed to update puppy names.");
        return;
      }
      onComplete(result);
    } catch {
      setError("Failed to update puppy names.");
    } finally {
      setIsSaving(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (updates.length === 0 || eligiblePuppies.length === 0) return;
    if (hasNewRegisteredNames && !confirmingRegisteredNames) {
      setConfirmingRegisteredNames(true);
      return;
    }
    void save();
  }

  function updateDraft(puppyId: string, field: keyof NameDraft, value: string) {
    setDrafts((current) => ({ ...current, [puppyId]: {
      ...(current[puppyId] ?? { callName: "", registeredName: "" }), [field]: value,
    }}));
    if (field === "registeredName") setConfirmingRegisteredNames(false);
  }

  return (
    <section className="theme-card mt-5 rounded-2xl p-5" aria-labelledby="name-puppy-heading">
      <h3 id="name-puppy-heading" className="theme-heading text-lg font-semibold">Name Puppies</h3>
      <p className="theme-copy mt-1 text-sm">Give each puppy an independent call name and, where available, registered name.</p>

      {eligiblePuppies.length === 0 ? (
        <div className="mt-5 grid gap-3">
          <p className="theme-copy rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">No selected puppies can be named.</p>
          <div><button type="button" onClick={onClose} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Close</button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 grid gap-4">
          <div className="grid gap-3">
            {eligiblePuppies.map((puppy) => {
              const draft = drafts[puppy.dogId] ?? { callName: puppy.callName ?? "", registeredName: "" };
              return (
                <div key={puppy.dogId} className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 md:grid-cols-2">
                  <div className="md:col-span-2"><p className="font-semibold">{puppy.displayName}</p><p className="theme-copy text-sm">{puppy.regNumber}</p></div>
                  <label className="grid gap-2 text-sm font-semibold">Call name
                    <input type="text" value={draft.callName} maxLength={MAX_CALL_NAME_LENGTH} onChange={(event) => updateDraft(puppy.dogId, "callName", event.target.value)} aria-label={`Call name for ${puppy.displayName}, ${puppy.regNumber}`} className="dog-control rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200" />
                  </label>
                  {puppy.registeredName ? (
                    <div className="grid gap-1 text-sm"><span className="font-semibold">Registered name</span><span className="theme-copy">{puppy.registeredName}</span><span className="theme-copy text-xs">Registered name is permanent once assigned.</span></div>
                  ) : puppy.actionEligibility.canAssignRegisteredName ? (
                    <label className="grid gap-2 text-sm font-semibold">Registered name
                      <input type="text" value={draft.registeredName} maxLength={MAX_REGISTERED_NAME_LENGTH} onChange={(event) => updateDraft(puppy.dogId, "registeredName", event.target.value)} aria-label={`Registered name for ${puppy.displayName}, ${puppy.regNumber}`} className="dog-control rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200" />
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
          {updates.length === 0 ? <p className="theme-copy text-sm">No name changes to save.</p> : null}
          {error ? <p className="theme-status-danger rounded-xl px-3 py-2 text-sm" role="alert">{error}</p> : null}
          {confirmingRegisteredNames ? (
            <div className="theme-status-danger rounded-xl px-3 py-3 text-sm"><p className="font-semibold">Confirm permanent registered names.</p><p className="mt-1">Registered names cannot be changed after confirmation. Call names remain editable.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void save()} disabled={isSaving} className="theme-status-danger rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Confirm and Save</button><button type="button" onClick={() => setConfirmingRegisteredNames(false)} disabled={isSaving} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Back</button></div></div>
          ) : null}
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={isSaving || updates.length === 0} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">{isSaving ? "Saving..." : "Save"}</button><button type="button" disabled={isSaving} onClick={onClose} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Cancel</button></div>
        </form>
      )}
    </section>
  );
}
