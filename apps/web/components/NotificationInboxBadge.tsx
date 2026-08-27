export default function NotificationInboxBadge({
  unreadCount,
}: {
  unreadCount: number;
}) {
  if (unreadCount <= 0) {
    return null;
  }

  return (
    <span
      className="theme-status-danger ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      aria-label={`${unreadCount} unread Inbox items`}
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}
