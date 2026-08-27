"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import NotificationInboxBadge from "./NotificationInboxBadge";

type InboxUnreadCountResponse = {
  total?: number;
};

type NotificationInboxLinkProps = {
  onUnreadCountChange?: (unreadCount: number) => void;
};

export default function NotificationInboxLink({
  onUnreadCountChange,
}: NotificationInboxLinkProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const shouldRefreshOnFocusRef = useRef(false);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUnreadCount() {
      if (isRefreshingRef.current) return;
      isRefreshingRef.current = true;

      try {
        const response = await fetch("/api/inbox/unread-count", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as InboxUnreadCountResponse;

        if (isMounted && typeof data.total === "number") {
          setUnreadCount(data.total);
          onUnreadCountChange?.(data.total);
        }
      } catch {
        // The inbox link remains useful if the unread-count request fails.
      } finally {
        isRefreshingRef.current = false;
      }
    }

    loadUnreadCount();

    function markTabInactive() {
      shouldRefreshOnFocusRef.current = true;
    }

    function refreshOnTabReturn() {
      if (!document.hidden && shouldRefreshOnFocusRef.current) {
        shouldRefreshOnFocusRef.current = false;
        loadUnreadCount();
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        markTabInactive();
        return;
      }
      refreshOnTabReturn();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", markTabInactive);
    window.addEventListener("focus", refreshOnTabReturn);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", markTabInactive);
      window.removeEventListener("focus", refreshOnTabReturn);
    };
  }, [onUnreadCountChange]);

  return (
    <Link
      href="/inbox"
      className="game-header__inbox rounded-xl px-2.5 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span>Inbox</span>
      <NotificationInboxBadge unreadCount={unreadCount} />
    </Link>
  );
}
