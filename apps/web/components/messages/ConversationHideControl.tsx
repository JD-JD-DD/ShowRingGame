"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConversationHideControl({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function hideConversation() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/inbox/messages/${conversationId}/hide`, { method: "POST" });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Unable to hide this conversation right now.");
        return;
      }
      router.push("/inbox/messages");
      router.refresh();
    } catch {
      setError("Unable to hide this conversation right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      {error ? <p className="theme-status-danger mb-3 rounded-xl px-4 py-3 text-sm" role="alert">{error}</p> : null}
      {isConfirming ? (
        <div className="theme-card rounded-xl p-4">
          <p className="theme-copy text-sm leading-6">Hide this conversation from your Messages inbox? The message history will be kept. If either kennel sends another message later, the conversation will return to your inbox.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setIsConfirming(false)} disabled={isSubmitting} className="theme-secondary-button rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Cancel</button>
            <button type="button" onClick={hideConversation} disabled={isSubmitting} className="theme-secondary-button rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">{isSubmitting ? "Hiding…" : "Hide Conversation"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setIsConfirming(true)} className="theme-secondary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Hide Conversation</button>
      )}
    </div>
  );
}
