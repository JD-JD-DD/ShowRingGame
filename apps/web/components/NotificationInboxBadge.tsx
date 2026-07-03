"use client";

import { useEffect, useRef, useState } from "react";

type UnreadCountResponse = {
  unreadCount?: number;
};

export default function NotificationInboxBadge({
  initialUnreadCount,
}: {
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const shouldRefreshOnFocusRef = useRef(false);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    let isMounted = true;
    let isRefreshing = false;

    async function refreshUnreadCount() {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;

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
      } finally {
        isRefreshing = false;
      }
    }

    function markTabInactive() {
      shouldRefreshOnFocusRef.current = true;
    }

    function refreshOnTabReturn() {
      if (!document.hidden && shouldRefreshOnFocusRef.current) {
        shouldRefreshOnFocusRef.current = false;
        refreshUnreadCount();
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        markTabInactive();
        return;
      }

      refreshOnTabReturn();
    }

    // The initial badge count is server-rendered in the root layout. Only
    // refresh after the user returns to the tab so we avoid steady polling.
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", markTabInactive);
    window.addEventListener("focus", refreshOnTabReturn);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", markTabInactive);
      window.removeEventListener("focus", refreshOnTabReturn);
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
