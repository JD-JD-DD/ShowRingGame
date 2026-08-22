import { redirect } from "next/navigation";
import { StudContractHistoryClient } from "@/components/stud-contract/StudContractHistoryClient";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listStudContractsForKennel } from "@/server/services/studContractHistory.service";

export default async function StudContractsPage() {
  const userId = await getSessionUserId(); if (!userId) redirect("/login");
  const kennel = await getKennelForUser(userId); if (!kennel) redirect("/onboarding");
  const page = await listStudContractsForKennel({ kennelId: kennel.id });
  return <main className="min-h-screen px-6 py-8"><section className="theme-panel mx-auto max-w-6xl rounded-[28px] px-6 py-8"><p className="theme-label text-sm uppercase tracking-[0.22em]">Stud Contracts</p><h1 className="theme-heading mt-2 text-4xl font-bold">My Stud Contracts</h1><p className="theme-copy mt-3">Your permanent history as a stud owner or dam owner.</p><StudContractHistoryClient initialItems={page.items} initialCursor={page.nextCursor} initialHasMore={page.hasMore} /></section></main>;
}
