"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConversationBlockControl({
  conversationId,
  isRequesterBlocker,
}: {
  conversationId: string;
  isRequesterBlocker: boolean;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(path: "block" | "unblock") {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/inbox/messages/${conversationId}/${path}`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Unable to update messaging availability right now.");
        return;
      }
      setIsConfirming(false);
      router.refresh();
    } catch {
      setError("Unable to update messaging availability right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isRequesterBlocker) {
    return (
      <div className="mt-6">
        {error ? <p className="theme-status-danger mb-3 rounded-xl px-4 py-3 text-sm" role="alert">{error}</p> : null}
        <button
          type="button"
          onClick={() => submit("unblock")}
          disabled={isSubmitting}
          className="theme-secondary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          {isSubmitting ? "Unblocking…" : "Unblock Kennel"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {error ? <p className="theme-status-danger mb-3 rounded-xl px-4 py-3 text-sm" role="alert">{error}</p> : null}
      {isConfirming ? (
        <div className="theme-status-danger rounded-xl p-4">
          <p className="text-sm leading-6">
            This kennel will no longer be able to exchange new messages with you. Existing message history will remain visible, and you can unblock this kennel later.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              disabled={isSubmitting}
              className="theme-secondary-button rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => submit("block")}
              disabled={isSubmitting}
              className="theme-status-danger rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            >
              {isSubmitting ? "Blocking…" : "Confirm Block"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className="theme-secondary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Block Kennel
        </button>
      )}
    </div>
  );
}
