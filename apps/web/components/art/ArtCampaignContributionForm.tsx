"use client";

import { useRef, useState } from "react";

import { formatArtCurrency } from "@/lib/artCampaignPresentation";
import type { ArtCampaignReadDto } from "@/server/services/artCampaign.service";

const NON_REFUNDABLE_POLICY = "Contributions are final and non-refundable. Your contribution funds the ShowRing Breed Art Project. Reaching the funding goal means ShowRing will commission artwork for this breed; it does not guarantee a specific artist or completion date.";

function newClientRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `art-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ArtCampaignContributionForm({ campaign, creditKennelName }: { campaign: ArtCampaignReadDto; creditKennelName?: string | null }) {
  const [open, setOpen] = useState(false);
  const [unitChoice, setUnitChoice] = useState("1");
  const [recognition, setRecognition] = useState<"KENNEL_CREDIT" | "ANONYMOUS">("KENNEL_CREDIT");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const clientRequestId = useRef(newClientRequestId());
  const selectedUnits = unitChoice === "remaining" ? campaign.progress.unitsRemaining : Number(unitChoice);
  const selectedAmountCents = selectedUnits * campaign.progress.fundingUnitCents;

  async function startCheckout() {
    if (submitting || !acknowledged) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/art-campaigns/${campaign.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedUnits: selectedUnits, recognition, nonRefundableAcknowledged: acknowledged, clientRequestId: clientRequestId.current }),
      });
      const data = await response.json().catch(() => null) as { approvalUrl?: string; error?: string } | null;
      if (!response.ok || !data?.approvalUrl) {
        setError(data?.error ?? "Unable to start Breed Art checkout.");
        return;
      }
      window.location.assign(data.approvalUrl);
    } catch {
      setError("Unable to start Breed Art checkout.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="theme-primary-button mt-4 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Contribute</button>;

  return <section className="theme-panel mt-4 rounded-xl p-4" aria-labelledby={`contribute-${campaign.id}`}>
    <h4 id={`contribute-${campaign.id}`} className="theme-heading text-base font-semibold">Contribute to {campaign.breedName}</h4>
    <div className="mt-3 grid gap-3">
      <label className="theme-label grid gap-1 text-sm" htmlFor={`units-${campaign.id}`}>Funding units
        <select id={`units-${campaign.id}`} value={unitChoice} onChange={(event) => setUnitChoice(event.target.value)} className="theme-control rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          {Array.from({ length: campaign.progress.maxContributionUnits ?? 0 }, (_, index) => index + 1).map((units) => <option key={units} value={units}>{units} {units === 1 ? "unit" : "units"} — {formatArtCurrency(units * campaign.progress.fundingUnitCents)}</option>)}
          <option value="remaining">Fund Remaining — {campaign.progress.unitsRemaining} {campaign.progress.unitsRemaining === 1 ? "unit" : "units"} — {formatArtCurrency(campaign.progress.amountRemainingCents)}</option>
        </select>
      </label>
      <p className="theme-copy text-sm">Selected contribution: {selectedUnits} {selectedUnits === 1 ? "unit" : "units"} · {formatArtCurrency(selectedAmountCents)}</p>
      <fieldset className="grid gap-2"><legend className="theme-label text-sm">Recognition</legend><label className="theme-copy flex items-start gap-2 text-sm"><input type="radio" name={`recognition-${campaign.id}`} value="KENNEL_CREDIT" checked={recognition === "KENNEL_CREDIT"} onChange={() => setRecognition("KENNEL_CREDIT")} className="mt-1" />Credit my kennel: {creditKennelName ?? "your kennel"}</label><label className="theme-copy flex items-start gap-2 text-sm"><input type="radio" name={`recognition-${campaign.id}`} value="ANONYMOUS" checked={recognition === "ANONYMOUS"} onChange={() => setRecognition("ANONYMOUS")} className="mt-1" />Remain anonymous</label></fieldset>
      <p className="theme-copy text-sm leading-6">{NON_REFUNDABLE_POLICY}</p>
      <label className="theme-copy flex items-start gap-2 text-sm" htmlFor={`acknowledgment-${campaign.id}`}><input id={`acknowledgment-${campaign.id}`} type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1" />I understand that my contribution is non-refundable.</label>
      <p className="theme-copy text-sm">Funding availability is confirmed when your contribution is finalized.</p>
      {error ? <p className="theme-status-danger rounded-xl px-3 py-2 text-sm" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2"><button type="button" onClick={startCheckout} disabled={!acknowledged || submitting} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Starting checkout…" : "Continue to PayPal"}</button><button type="button" onClick={() => setOpen(false)} disabled={submitting} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Cancel</button></div>
    </div>
  </section>;
}
