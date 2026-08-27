"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  KENNEL_COMMUNICATION_REPORT_REASONS,
  MAX_KENNEL_REPORT_DETAIL_LENGTH,
  type KennelCommunicationReportReason,
} from "@/lib/kennelCommunicationReports";

export function ConversationReportControl({
  conversationId,
  otherKennelName,
  message,
}: {
  conversationId: string;
  otherKennelName: string;
  message?: { id: string; body: string };
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<KennelCommunicationReportReason>("HARASSMENT");
  const [detail, setDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const isMessageReport = Boolean(message);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/inbox/messages/${conversationId}/${isMessageReport ? "report-message" : "report-conversation"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(message ? { messageId: message.id } : {}), reason, detail }),
        }
      );
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Unable to submit this report right now.");
        return;
      }
      setIsComplete(true);
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Unable to submit this report right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return <p className="theme-copy mt-3 text-sm" role="status">Report submitted.</p>;
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="theme-secondary-button mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={isMessageReport ? "Report this message" : `Report conversation with ${otherKennelName}`}
      >
        {isMessageReport ? "Report" : "Report Conversation"}
      </button>
    );
  }

  return (
    <form className="theme-card mt-3 grid gap-3 rounded-xl p-4" onSubmit={submit}>
      <h2 className="theme-heading text-base font-semibold">
        {isMessageReport ? "Report Message" : "Report Conversation"}
      </h2>
      {message ? (
        <p className="theme-copy whitespace-pre-wrap break-words text-sm">{message.body}</p>
      ) : (
        <p className="theme-copy text-sm">Report the conversation with {otherKennelName}.</p>
      )}
      <label className="theme-label grid gap-2 text-sm font-semibold">
        Reason
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value as KennelCommunicationReportReason)}
          className="theme-control rounded-lg px-3 py-2 text-sm font-normal"
        >
          {KENNEL_COMMUNICATION_REPORT_REASONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="theme-label grid gap-2 text-sm font-semibold">
        Details (optional)
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={4}
          maxLength={MAX_KENNEL_REPORT_DETAIL_LENGTH}
          className="theme-control rounded-lg px-3 py-2 text-sm font-normal"
        />
      </label>
      {error ? <p className="theme-status-danger rounded-lg px-3 py-2 text-sm" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setIsOpen(false); setError(""); }}
          disabled={isSubmitting}
          className="theme-secondary-button rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="theme-primary-button rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          {isSubmitting ? "Submitting…" : "Submit Report"}
        </button>
      </div>
    </form>
  );
}
