"use client";

import { useState } from "react";

export default function DeleteReadNoticesForm() {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <form action="/api/notices/delete-read" method="post">
      {isConfirming ? (
        <div className="theme-status-danger rounded-xl p-3">
          <p className="max-w-xs text-sm font-semibold">
            Delete all read inbox notices? Unread notices will be kept.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              className="theme-secondary-button rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="theme-status-danger rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Delete Read
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className="theme-secondary-button rounded-xl px-6 py-3 text-sm font-semibold"
        >
          Delete Read
        </button>
      )}
    </form>
  );
}
