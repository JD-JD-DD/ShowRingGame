"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import NotificationInboxBadge from "./NotificationInboxBadge";

type UnreadCountResponse = {
  unreadCount?: number;
};

export default function NotificationInboxLink() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadUnreadCount() {
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
        // The inbox link remains useful if the unread-count request fails.
      }
    }

    loadUnreadCount();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Link
      href="/notices"
      className="game-header__inbox fixed right-4 top-[4.75rem] z-50 rounded-2xl px-3 py-1.5 text-right text-[11px] font-semibold leading-4 backdrop-blur"
    >
      <span>Inbox</span>
      <NotificationInboxBadge initialUnreadCount={unreadCount} />
    </Link>
  );
}
