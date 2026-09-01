import { notFound, redirect } from "next/navigation";

import SystemBroadcastForm from "@/components/admin/SystemBroadcastForm";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export default async function SystemBroadcastsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const user = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) notFound();
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6"><section className="theme-panel rounded-2xl p-5 sm:p-6"><p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Administration</p><h1 className="theme-heading mt-2 text-3xl font-semibold">System Broadcasts</h1><p className="theme-copy mt-3 text-sm leading-6">Preview a plain-text Notice before sending it to eligible player kennels. Sending creates ordinary kennel Notices and cannot be undone from this page.</p><SystemBroadcastForm /></section></main>;
}
