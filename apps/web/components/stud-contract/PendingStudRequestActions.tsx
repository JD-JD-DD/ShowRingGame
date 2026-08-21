"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function PendingStudRequestActions({ contractId, canApprove }: { contractId: string; canApprove: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  async function act(action: "approve" | "decline") {
    setPending(true); setMessage("");
    try { const response = await fetch(`/api/stud-contracts/${contractId}/${action}`, { method: "POST" }); const data = await response.json(); if (!response.ok || !data?.ok) { setMessage(data?.error ?? "Unable to update request."); return; } router.refresh(); } catch { setMessage("Unable to update request."); } finally { setPending(false); }
  }
  return <div className="flex flex-wrap gap-2"><button type="button" className="theme-primary-button rounded-xl px-3 py-2 text-sm font-semibold" onClick={() => act("approve")} disabled={pending || !canApprove} aria-busy={pending}>Approve &amp; Breed</button><button type="button" className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold" onClick={() => act("decline")} disabled={pending}>Decline</button>{message ? <p role="status" aria-live="polite" className="theme-copy text-sm">{message}</p> : null}</div>;
}
