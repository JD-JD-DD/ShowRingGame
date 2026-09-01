"use client";

import { useState } from "react";

type Action = { label: string; href: string };
type FormState = { broadcastKey: string; title: string; body: string; actions: [Action, Action] };
type Preview = { eligibleRecipients: number; alreadyHasBroadcast: number; wouldCreate: number; title: string; body: string; actions: Action[] };

const initialState: FormState = {
  broadcastKey: "support-and-breed-art-launch-v1",
  title: "Two ways to support ShowRing",
  body: "ShowRing remains free to play. Optional monthly Support helps with development and operating costs, while the Breed Art Fund lets players help commission original artwork for the breed collection.",
  actions: [{ label: "Support ShowRing", href: "/support" }, { label: "Explore the Breed Art Fund", href: "/breed-art" }],
};

function payload(state: FormState) {
  return { ...state, actions: state.actions.filter((action) => action.label.trim() || action.href.trim()) };
}

export default function SystemBroadcastForm() {
  const [state, setState] = useState<FormState>(initialState);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const update = (next: Partial<FormState>) => { setState((current) => ({ ...current, ...next })); setPreview(null); setConfirmed(false); setMessage(""); };
  const updateAction = (index: 0 | 1, field: keyof Action, value: string) => update({ actions: state.actions.map((action, actionIndex) => actionIndex === index ? { ...action, [field]: value } : action) as [Action, Action] });

  async function request(path: string) {
    setSubmitting(true); setMessage("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(state)) });
      const result = await response.json().catch(() => null) as { error?: string; preview?: Preview; summary?: { created: number; skippedExisting: number; eligibleRecipients: number } } | null;
      if (!response.ok || !result) { setMessage(result?.error ?? "Unable to process the broadcast."); return; }
      if (result.preview) { setPreview(result.preview); setMessage("Preview ready. Review the recipient count, then confirm before sending."); }
      if (result.summary) { setPreview(null); setConfirmed(false); setMessage(`Broadcast sent: ${result.summary.created} created, ${result.summary.skippedExisting} existing, ${result.summary.eligibleRecipients} eligible.`); }
    } catch { setMessage("Unable to process the broadcast."); }
    finally { setSubmitting(false); }
  }

  return <form onSubmit={(event) => event.preventDefault()} className="theme-card mt-6 rounded-2xl p-5 sm:p-6">
    <div className="grid gap-4"><label className="theme-label grid gap-1 text-sm">Broadcast Key<input value={state.broadcastKey} onChange={(event) => update({ broadcastKey: event.target.value })} className="theme-control rounded-xl px-3 py-2 text-sm" required maxLength={80} /></label>
      <label className="theme-label grid gap-1 text-sm">Title<input value={state.title} onChange={(event) => update({ title: event.target.value })} className="theme-control rounded-xl px-3 py-2 text-sm" required maxLength={160} /></label>
      <label className="theme-label grid gap-1 text-sm">Body<textarea value={state.body} onChange={(event) => update({ body: event.target.value })} className="theme-control min-h-28 rounded-xl px-3 py-2 text-sm" required maxLength={2000} /></label>
      {state.actions.map((action, index) => <fieldset key={index} className="theme-panel grid gap-3 rounded-xl p-4 sm:grid-cols-2"><legend className="theme-label px-1 text-sm">Action {index + 1} {index === 1 ? "(optional)" : ""}</legend><label className="theme-label grid gap-1 text-sm">Label<input value={action.label} onChange={(event) => updateAction(index as 0 | 1, "label", event.target.value)} className="theme-control rounded-xl px-3 py-2 text-sm" maxLength={80} /></label><label className="theme-label grid gap-1 text-sm">Internal path<input value={action.href} onChange={(event) => updateAction(index as 0 | 1, "href", event.target.value)} className="theme-control rounded-xl px-3 py-2 text-sm" placeholder="/support" /></label></fieldset>)}</div>
    <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={() => request("/api/admin/system-broadcasts/preview")} disabled={submitting} className="theme-secondary-button rounded-xl border border-[var(--dog-border-strong)] px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">Preview</button></div>
    {preview ? <section className="theme-status-info mt-5 rounded-xl p-4" aria-live="polite"><h2 className="theme-heading font-semibold">Broadcast preview</h2><p className="theme-copy mt-2 text-sm">Eligible kennels: {preview.eligibleRecipients}. Existing recipients: {preview.alreadyHasBroadcast}. Would create: {preview.wouldCreate}.</p><p className="theme-copy mt-2 text-sm font-semibold">{preview.title}</p><p className="theme-copy mt-1 text-sm">{preview.body}</p><div className="theme-copy mt-3 flex flex-wrap gap-2 text-sm">{preview.actions.map((action) => <span key={`${action.label}:${action.href}`} className="rounded-lg border border-[var(--dog-border-strong)] px-3 py-1">{action.label} → {action.href}</span>)}</div><label className="theme-copy mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />I have reviewed this broadcast and want to send it.</label><button type="button" onClick={() => request("/api/admin/system-broadcasts/send")} disabled={!confirmed || submitting} className="theme-primary-button mt-4 rounded-xl border border-[var(--dog-border-strong)] px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">Send to {preview.wouldCreate} kennels</button></section> : null}
    {message ? <p className="theme-copy mt-4 text-sm" role="status">{message}</p> : null}
  </form>;
}
