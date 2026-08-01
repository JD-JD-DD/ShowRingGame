"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getReproductiveEmergencyPresentation } from "@/lib/reproductiveEmergencyPresentation";
import type { DogProfileReproductiveEmergencyDto } from "@/server/mappers/dog.mapper";

export default function ReproductiveEmergencyPanel({ dogName, emergency, className }: { dogName: string; emergency: DogProfileReproductiveEmergencyDto; className?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = emergency.status === "PENDING";
  const presentation = getReproductiveEmergencyPresentation(emergency);

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

  return <section id="whelping-emergency" className={`${className ?? ""} border border-red-500/30 bg-red-500/10`} aria-labelledby="whelping-emergency-heading">
    <p className="dog-label text-xs uppercase tracking-wide text-red-700 dark:text-red-200">{pending ? "Pending care" : "Whelping outcome"}</p>
    <h2 id="whelping-emergency-heading" className="dog-heading mt-1 text-2xl font-bold">Whelping Emergency</h2>
    {pending ? <><p className="dog-copy mt-3 text-sm leading-6">{dogName} has a whelping complication. Emergency treatment costs <strong>{emergency.treatmentCostLabel}</strong>. Emergency treatment greatly improves the chances of saving the dam and puppies, but survival is not guaranteed.</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><div><dt className="font-semibold">Dam</dt><dd>{dogName}</dd></div><div><dt className="font-semibold">Expected at whelping</dt><dd>{emergency.intendedPuppyCount}</dd></div><div><dt className="font-semibold">Response deadline</dt><dd>{emergency.deadlineLabel}</dd></div></dl></> : emergency.status === "TREATMENT_AUTHORIZED" ? <><p className="dog-copy mt-3 text-sm leading-6">Emergency treatment has been authorized. The dam and litter outcome is still being resolved.</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Treatment cost paid</dt><dd>{emergency.treatmentCostLabel}</dd></div><div><dt className="font-semibold">Expected at whelping</dt><dd>{emergency.intendedPuppyCount}</dd></div></dl></> : <><p className="dog-copy mt-3 text-sm leading-6">{presentation.treatmentLabel}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Dam outcome</dt><dd>{presentation.damOutcomeLabel}</dd></div><div><dt className="font-semibold">Expected at whelping</dt><dd>{emergency.intendedPuppyCount}</dd></div><div><dt className="font-semibold">Survived the whelping emergency</dt><dd>{emergency.survivingPuppyCount}</dd></div>{presentation.recoveryUntilLabel ? <div><dt className="font-semibold">Recovery completes</dt><dd>{presentation.recoveryUntilLabel}</dd></div> : null}</dl><p className="dog-copy mt-3 text-sm leading-6">{presentation.puppyOutcome}</p>{presentation.consequenceMessage ? <p className="dog-copy mt-2 text-sm leading-6">{presentation.consequenceMessage}</p> : null}{presentation.litterHref ? <Link className="mt-3 inline-block text-sm font-semibold underline" href={presentation.litterHref}>View surviving litter</Link> : null}</>}
    {error ? <div role="alert" className="mt-4 rounded-2xl border border-red-400/30 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-100">{error}</div> : null}
    {pending && (confirming ? <div className="mt-5 rounded-2xl border border-red-400/30 bg-white/75 p-4 dark:bg-black/20"><h3 className="dog-heading text-lg font-semibold">Authorize Treatment</h3><p className="dog-copy mt-2 text-sm">This will debit {emergency.treatmentCostLabel}. Treatment improves survival chances but does not guarantee survival.</p><div className="mt-4 flex gap-3"><button type="button" onClick={authorize} disabled={submitting} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{submitting ? "Submitting..." : "Confirm Treatment"}</button><button type="button" onClick={() => { setConfirming(false); setError(null); }} disabled={submitting} className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Keep Deciding</button></div></div> : <button type="button" onClick={() => setConfirming(true)} className="mt-5 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">Authorize Treatment</button>)}
  </section>;
}
