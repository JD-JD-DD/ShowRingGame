import { redirect } from "next/navigation";
import { StudContractHistoryClient } from "@/components/stud-contract/StudContractHistoryClient";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listStudContractsForKennel, parseStudContractHistoryFilters } from "@/server/services/studContractHistory.service";

type StudContractsPageProps = { searchParams?: Promise<{ status?: string | string[]; action?: string | string[]; sort?: string | string[] }> };
function first(value: string | string[] | undefined) { return typeof value === "string" ? value : null; }

export default async function StudContractsPage({ searchParams }: StudContractsPageProps) {
  const userId = await getSessionUserId(); if (!userId) redirect("/login");
  const kennel = await getKennelForUser(userId); if (!kennel) redirect("/onboarding");
  const query = await searchParams;
  const filters = parseStudContractHistoryFilters({ status: first(query?.status), action: first(query?.action), sort: first(query?.sort) });
  const page = await listStudContractsForKennel({ kennelId: kennel.id, ...filters });
  const filterKey = `${filters.statusFilter}:${filters.actionFilter}:${filters.sortOrder}`;
  return <main className="min-h-screen px-6 py-8"><section className="theme-panel mx-auto max-w-6xl rounded-[28px] px-6 py-8"><p className="theme-label text-sm uppercase tracking-[0.22em]">Stud Contracts</p><h1 className="theme-heading mt-2 text-4xl font-bold">My Stud Contracts</h1><p className="theme-copy mt-3">Your permanent history as a stud owner or dam owner.</p><StudContractHistoryClient key={filterKey} initialItems={page.items} initialCursor={page.nextCursor} initialHasMore={page.hasMore} filters={filters} /></section></main>;
}
