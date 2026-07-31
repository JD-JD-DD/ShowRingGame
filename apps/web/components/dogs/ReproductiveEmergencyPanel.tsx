"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DogProfileReproductiveEmergencyDto } from "@/server/mappers/dog.mapper";

export default function ReproductiveEmergencyPanel({ dogName, emergency, className }: { dogName: string; emergency: DogProfileReproductiveEmergencyDto; className?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = emergency.status === "PENDING";

  async function authorize() {
    setSubmitting(true); setError(null);
    try {
      const response = await fetch(`/api/reproductive-emergencies/${emergency.eventId}/authorize-treatment`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Unable to authorize emergency treatment.");
      setConfirming(false); router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to authorize emergency treatment.");
    } finally { setSubmitting(false); }
  }

  const consequence = emergency.reproductiveConsequence === "EXTENDED_RECOVERY"
    ? "She requires an extended recovery and cannot be bred for 365 hours from the emergency resolution."
    : emergency.reproductiveConsequence === "PERMANENT_BREEDING_RESTRICTION"
      ? "Veterinary complications mean she cannot safely carry another litter and may not be bred again."
      : emergency.reproductiveConsequence === "NONE"
        ? "She has no lasting reproductive restriction and will use the normal 270-hour post-whelp recovery period."
        : null;
  return <section id="whelping-emergency" className={`${className ?? ""} border border-red-500/30 bg-red-500/10`} aria-labelledby="whelping-emergency-heading">
    <p className="dog-label text-xs uppercase tracking-wide text-red-700 dark:text-red-200">{pending ? "Pending care" : "Whelping outcome"}</p>
    <h2 id="whelping-emergency-heading" className="dog-heading mt-1 text-2xl font-bold">Whelping Emergency</h2>
    {pending ? <><p className="dog-copy mt-3 text-sm leading-6">{dogName} has a whelping complication. Emergency treatment costs <strong>{emergency.treatmentCostLabel}</strong>. Treatment improves survival chances but does not guarantee survival.</p>
      <p className="dog-copy mt-2 text-sm">Care deadline: <strong>{emergency.deadlineLabel}</strong>.</p></> : emergency.status === "TREATMENT_AUTHORIZED" ? <p className="dog-copy mt-3 text-sm leading-6">Emergency treatment authorized. Outcome resolution is pending.</p> : <><p className="dog-copy mt-3 text-sm leading-6">{emergency.status === "RESOLVED_TREATED" ? "Treatment authorized." : "Treatment deadline expired."} Dam outcome: <strong>{emergency.damOutcome === "SURVIVED" ? "Survived" : "Died"}</strong>. {emergency.survivingPuppyCount} of {emergency.intendedPuppyCount} puppies survived delivery.</p>{consequence ? <p className="dog-copy mt-2 text-sm leading-6">{consequence}</p> : null}{emergency.litterId ? <Link className="mt-3 inline-block text-sm font-semibold underline" href={`/litters/${emergency.litterId}`}>View litter</Link> : null}</>}
    {error ? <div role="alert" className="mt-4 rounded-2xl border border-red-400/30 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-100">{error}</div> : null}
    {pending && (confirming ? <div className="mt-5 rounded-2xl border border-red-400/30 bg-white/75 p-4 dark:bg-black/20"><h3 className="dog-heading text-lg font-semibold">Authorize Treatment</h3><p className="dog-copy mt-2 text-sm">This will debit {emergency.treatmentCostLabel}. Treatment improves survival chances but does not guarantee survival.</p><div className="mt-4 flex gap-3"><button type="button" onClick={authorize} disabled={submitting} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{submitting ? "Submitting..." : "Confirm Treatment"}</button><button type="button" onClick={() => { setConfirming(false); setError(null); }} disabled={submitting} className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Keep Deciding</button></div></div> : <button type="button" onClick={() => setConfirming(true)} className="mt-5 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">Authorize Treatment</button>)}
  </section>;
}
