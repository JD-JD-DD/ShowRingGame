"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ConversationReplyForm({
  conversationId,
  maxLength,
}: {
  conversationId: string;
  maxLength: number;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;

    setError("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/inbox/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? "Unable to send your message right now.");
        return;
      }

      setBody("");
      router.refresh();
    } catch {
      setError("Unable to send your message right now.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form className="theme-card mt-6 grid gap-3 rounded-xl p-5" onSubmit={handleSubmit} aria-describedby={error ? "message-reply-error" : undefined}>
      <label className="theme-label grid gap-2 text-sm font-semibold" htmlFor="message-reply-body">
        Reply
        <textarea
          id="message-reply-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={maxLength}
          rows={5}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "message-reply-error" : undefined}
          className="theme-control rounded-xl px-4 py-3 text-base font-normal leading-6"
        />
      </label>
      <p className="theme-copy text-sm">Up to {maxLength.toLocaleString()} characters.</p>
      {error ? (
        <p id="message-reply-error" className="theme-status-danger rounded-xl px-4 py-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={isSending}
          className="theme-primary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          {isSending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
