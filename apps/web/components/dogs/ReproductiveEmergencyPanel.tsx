"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getReproductiveEmergencyPresentation } from "@/lib/reproductiveEmergencyPresentation";
import type { DogProfileReproductiveEmergencyDto } from "@/server/mappers/dog.mapper";

type ConfirmationMode = "treat" | "decline" | null;

export default function ReproductiveEmergencyPanel({ dogName, emergency, className }: { dogName: string; emergency: DogProfileReproductiveEmergencyDto; className?: string }) {
  const router = useRouter();
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = emergency.status === "PENDING";
  const declined = emergency.status === "TREATMENT_DECLINED";
  const presentation = getReproductiveEmergencyPresentation(emergency);

  async function submitDecision(mode: Exclude<ConfirmationMode, null>) {
    setSubmitting(true);
    setError(null);
    try {
      const path = mode === "treat" ? "authorize-treatment" : "decline-treatment";
      const response = await fetch(`/api/reproductive-emergencies/${emergency.eventId}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Unable to record emergency treatment decision.");
      setConfirmationMode(null);
      if (mode === "treat") setAuthorizationConfirmed(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record emergency treatment decision.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section id="whelping-emergency" className={`${className ?? ""} border border-red-500/30 bg-red-500/10`} aria-labelledby="whelping-emergency-heading">
    <p className="dog-label text-xs uppercase tracking-wide text-red-700 dark:text-red-200">{pending ? "Decision required" : declined ? "Treatment declined" : emergency.status === "TREATMENT_AUTHORIZED" ? "Treatment in progress" : "Whelping outcome"}</p>
    <h2 id="whelping-emergency-heading" className="dog-heading mt-1 text-2xl font-bold">Whelping Emergency</h2>
    {authorizationConfirmed ? <div role="status" className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-50"><h3 className="font-semibold">Treatment authorized</h3><p className="mt-1">Emergency veterinary treatment is now underway. The outcome will be resolved within one game day — up to 1 real hour.</p><p className="mt-2">You do not need to take any further action. Return to this dog’s page after treatment is complete to see the outcome.</p></div> : null}
    {pending ? <><p className="dog-copy mt-3 text-sm leading-6">You have 48 real hours to choose whether to authorize emergency veterinary treatment. <strong>{emergency.deadlineLabel}</strong></p><p className="dog-copy mt-2 text-sm leading-6">You do not need to remain online. If you make no choice before the deadline, the emergency will resolve without treatment.</p><p className="dog-copy mt-3 text-sm leading-6">{dogName} has a whelping complication. Emergency treatment costs <strong>{emergency.treatmentCostLabel}</strong>. Emergency treatment greatly improves the chances of saving the dam and puppies, but survival is not guaranteed.</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Dam</dt><dd>{dogName}</dd></div><div><dt className="font-semibold">Expected at whelping</dt><dd>{emergency.intendedPuppyCount}</dd></div></dl></> : declined ? <><h3 className="dog-heading mt-3 text-lg font-semibold">Treatment declined</h3><p className="dog-copy mt-2 text-sm leading-6">No emergency treatment will be provided. The outcome is being resolved and will be available within one game day (up to 1 real hour).</p><p className="dog-copy mt-2 text-sm leading-6">You do not need to take any further action.</p></> : emergency.status === "TREATMENT_AUTHORIZED" ? <><h3 className="dog-heading mt-3 text-lg font-semibold">Treatment in progress</h3><p className="dog-copy mt-2 text-sm leading-6">Veterinary care has been authorized. The outcome will be available within one game day (up to 1 real hour).</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Treatment cost paid</dt><dd>{emergency.treatmentCostLabel}</dd></div><div><dt className="font-semibold">Expected at whelping</dt><dd>{emergency.intendedPuppyCount}</dd></div></dl></> : <><p className="dog-copy mt-3 text-sm leading-6">{presentation.treatmentLabel}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Dam outcome</dt><dd>{presentation.damOutcomeLabel}</dd></div><div><dt className="font-semibold">Expected at whelping</dt><dd>{emergency.intendedPuppyCount}</dd></div><div><dt className="font-semibold">Survived the whelping emergency</dt><dd>{emergency.survivingPuppyCount}</dd></div>{presentation.recoveryUntilLabel ? <div><dt className="font-semibold">Recovery completes</dt><dd>{presentation.recoveryUntilLabel}</dd></div> : null}</dl><p className="dog-copy mt-3 text-sm leading-6">{presentation.puppyOutcome}</p>{presentation.consequenceMessage ? <p className="dog-copy mt-2 text-sm leading-6">{presentation.consequenceMessage}</p> : null}{presentation.litterHref ? <Link className="mt-3 inline-block text-sm font-semibold underline" href={presentation.litterHref}>View surviving litter</Link> : null}</>}
    {error ? <div role="alert" className="mt-4 rounded-2xl border border-red-400/30 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-100">{error}</div> : null}
    {pending && (confirmationMode ? <div className="mt-5 rounded-2xl border border-red-400/30 bg-white/75 p-4 dark:bg-black/20"><h3 className="dog-heading text-lg font-semibold">{confirmationMode === "treat" ? "Authorize Treatment" : "Decline emergency treatment"}</h3><p className="dog-copy mt-2 text-sm leading-6">{confirmationMode === "treat" ? `If you authorize treatment, veterinary care will begin and the outcome will be resolved within one game day — up to 1 real hour. This will debit ${emergency.treatmentCostLabel}.` : "Without emergency treatment, the risk of losing the dam and puppies is much higher, but survival is still possible."}</p>{confirmationMode === "decline" ? <p className="dog-copy mt-2 text-sm leading-6">If you decline treatment, no veterinary treatment will be provided. The outcome will be resolved within one game day — up to 1 real hour.</p> : null}<div className="mt-4 flex gap-3"><button type="button" onClick={() => submitDecision(confirmationMode)} disabled={submitting} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{submitting ? "Submitting..." : confirmationMode === "treat" ? "Confirm Treatment" : "Confirm Decline"}</button><button type="button" onClick={() => { setConfirmationMode(null); setError(null); }} disabled={submitting} className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Keep Deciding</button></div></div> : <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => setConfirmationMode("treat")} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">Authorize Treatment</button><button type="button" onClick={() => setConfirmationMode("decline")} className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Do not treat</button></div>)}
  </section>;
}
