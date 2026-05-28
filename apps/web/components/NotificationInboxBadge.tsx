"use client";

import { useEffect, useState } from "react";

type UnreadCountResponse = {
  unreadCount?: number;
};

export default function NotificationInboxBadge({
  initialUnreadCount,
}: {
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    let isMounted = true;

    async function refreshUnreadCount() {
      try {
        const response = await fetch("/api/notices/unread-count", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as UnreadCountResponse;

        if (isMounted && typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // The server-rendered count remains useful if a background poll fails.
      }
    }

    refreshUnreadCount();

    const intervalId = window.setInterval(refreshUnreadCount, 30_000);

    function refreshOnFocus() {
      if (!document.hidden) {
        refreshUnreadCount();
      }
    }

    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshUnreadCount);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshUnreadCount);
    };
  }, []);

  if (unreadCount <= 0) {
    return null;
  }

  return (
    <span className="ml-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] text-white">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}
