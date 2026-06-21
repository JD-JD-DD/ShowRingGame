"use client";

import { useState } from "react";

export default function VerificationActions() {
  const [message, setMessage] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendVerification() {
    setIsSending(true);
    setMessage("");
    setVerificationUrl("");

    try {
      const response = await fetch("/api/auth/email-verification/request", {
        method: "POST"
      });
      const data = await response.json();
      setMessage(data.message ?? data.error ?? "Unable to send verification email.");
      setVerificationUrl(data.verificationUrl ?? "");
    } catch {
      setMessage("Unable to send verification email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      <button
        type="button"
        onClick={sendVerification}
        disabled={isSending}
        className="rounded-2xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSending ? "Sending..." : "Send verification email"}
      </button>

      {message ? (
        <p className="rounded-2xl border border-purple-300/20 bg-white/5 px-4 py-3 text-sm text-purple-100">
          {message}
        </p>
      ) : null}

      {verificationUrl ? (
        <a
          href={verificationUrl}
          className="text-sm font-semibold text-purple-200 underline underline-offset-4"
        >
          Open local-development verification link
        </a>
      ) : null}
    </div>
  );
}
