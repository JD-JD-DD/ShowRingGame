import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;
  return readFileSync(join(root, path), "utf8");
}

function main() {
  const inboxLink = source("apps/web/components/NotificationInboxLink.tsx");
  const inboxBadge = source("apps/web/components/NotificationInboxBadge.tsx");
  const inboxPage = source("apps/web/app/inbox/page.tsx");
  const messagesPage = source("apps/web/app/inbox/messages/page.tsx");
  const noticesPage = source("apps/web/app/inbox/notices/page.tsx");
  const combinedRoute = source("apps/web/app/api/inbox/unread-count/route.ts");
  const noticeRoute = source("apps/web/app/api/notices/unread-count/route.ts");
  const noticesPageSource = source("apps/web/app/notices/page.tsx");

  assert.ok(inboxLink.includes('href="/inbox"'), "global Inbox link points to the Inbox parent");
  assert.ok(!inboxLink.includes('href="/notices"'), "global Inbox link no longer points directly to Notices");
  assert.ok(inboxLink.includes('fetch("/api/inbox/unread-count"'), "global Inbox uses one combined unread-count request");
  assert.ok(!inboxLink.includes("/api/notices/unread-count"), "global Inbox does not duplicate the notices-only request");
  assert.ok(inboxBadge.includes("aria-label"), "global unread badge has accessible count text");

  assert.ok(inboxPage.includes("<h1"), "Inbox parent has a semantic heading");
  assert.ok(inboxPage.includes("Inbox"), "Inbox parent uses the canonical Inbox label");
  assert.ok(inboxPage.includes('href="/inbox/messages"'), "Inbox parent links to Messages");
  assert.ok(inboxPage.includes('href="/inbox/notices"'), "Inbox parent links to Notices");
  assert.ok(inboxPage.includes("aria-label=\"Inbox sections\""), "Inbox section navigation is labelled");
  assert.ok(inboxPage.includes("focus-visible:outline"), "Inbox section links have visible focus styling");
  assert.ok(inboxPage.includes("getUnreadKennelConversationCount"), "Inbox loads Messages unread conversations");
  assert.ok(inboxPage.includes("getUnreadKennelNoticeCount"), "Inbox retains canonical Notices unread counts");

  assert.ok(messagesPage.includes("Kennel messages will appear here."), "Messages destination is a minimal placeholder");
  assert.ok(!messagesPage.includes("listKennelConversationSummaries"), "Messages placeholder does not implement the conversation list early");
  assert.ok(!messagesPage.includes("sendKennelMessage"), "Messages placeholder does not implement message sending early");
  assert.ok(noticesPage.includes('redirect("/notices")'), "Inbox Notices redirects to the canonical Notices page");
  assert.ok(noticesPageSource.includes("listKennelNotices"), "existing Notices page remains the canonical notice renderer");

  assert.ok(noticeRoute.includes("getUnreadKennelNoticeCount"), "existing notices unread route remains intact");
  assert.ok(combinedRoute.includes("getSessionUserId"), "combined unread route authenticates");
  assert.ok(combinedRoute.includes("getKennelForUser"), "combined unread route resolves the kennel once");
  assert.ok(combinedRoute.includes("getUnreadKennelConversationCount"), "combined route uses canonical Messages unread service");
  assert.ok(combinedRoute.includes("getUnreadKennelNoticeCount"), "combined route uses canonical Notices unread service");
  assert.ok(combinedRoute.includes("{ messages, notices, total: messages + notices }"), "combined route returns separate and combined counts");
  assert.ok(!combinedRoute.includes("markKennelConversationRead"), "combined route does not mutate message read state");

  console.log("Inbox navigation checks passed.");
}

main();
