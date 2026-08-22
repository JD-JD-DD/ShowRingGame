"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { PendingStudRequestActions } from "@/components/stud-contract/PendingStudRequestActions";
import { StudContractReturnServiceAction } from "@/components/stud-contract/StudContractReturnServiceAction";
import type { StudContractActionFilter, StudContractSortOrder, StudContractStatusFilter } from "@/server/services/studContractHistory.service";

type Item = Awaited<ReturnType<typeof import("@/server/services/studContractHistory.service").listStudContractsForKennel>>["items"][number];
type Filters = { statusFilter: StudContractStatusFilter; actionFilter: StudContractActionFilter; sortOrder: StudContractSortOrder };

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
function formatDate(value: string | null) { return value ? dateFormatter.format(new Date(value)) : "Not recorded"; }
function deadlineLabel(kind: "APPROVAL" | "PUPPY_SELECTION" | "RETURN_SERVICE") { return kind === "APPROVAL" ? "Approval deadline" : kind === "PUPPY_SELECTION" ? "Selection deadline" : "Return Service expiry"; }

export function StudContractHistoryClient(props: { initialItems: Item[]; initialCursor: string | null; initialHasMore: boolean; filters: Filters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState(props.initialItems);
  const [cursor, setCursor] = useState(props.initialCursor);
  const [hasMore, setHasMore] = useState(props.initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/stud-contracts/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cursor, status: props.filters.statusFilter, action: props.filters.actionFilter, sort: props.filters.sortOrder }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to load more Stud Contracts.");
      setItems((current) => [...current, ...payload.items.filter((item: Item) => !current.some((existing) => existing.id === item.id))]);
      setCursor(payload.nextCursor ?? null); setHasMore(payload.hasMore === true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load more Stud Contracts."); }
    finally { setLoading(false); }
  }
  function updateFilters(next: Filters) {
    const params = new URLSearchParams();
    if (next.statusFilter !== "all") params.set("status", next.statusFilter);
    if (next.actionFilter !== "all") params.set("action", next.actionFilter);
    if (next.sortOrder !== "newest") params.set("sort", next.sortOrder);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }
  return <div className="mt-6 grid gap-4"><fieldset className="theme-card grid gap-3 rounded-2xl p-4 sm:grid-cols-3"><legend className="sr-only">Contract workspace filters</legend><label className="theme-label grid gap-1 text-sm">Status<select value={props.filters.statusFilter} onChange={(event) => updateFilters({ ...props.filters, statusFilter: event.target.value === "pending" || event.target.value === "active" || event.target.value === "complete" || event.target.value === "declined" || event.target.value === "expired" ? event.target.value : "all" })} className="theme-input rounded-lg px-3 py-2 text-sm"><option value="all">All</option><option value="pending">Pending</option><option value="active">Active</option><option value="complete">Complete</option><option value="declined">Declined</option><option value="expired">Expired</option></select></label><label className="theme-label grid gap-1 text-sm">Action<select value={props.filters.actionFilter} onChange={(event) => updateFilters({ ...props.filters, actionFilter: event.target.value === "needs-action" || event.target.value === "manual-approval" || event.target.value === "puppy-selection" || event.target.value === "return-service" ? event.target.value : "all" })} className="theme-input rounded-lg px-3 py-2 text-sm"><option value="all">All</option><option value="needs-action">Needs Action</option><option value="manual-approval">Approve Request</option><option value="puppy-selection">Pick Puppy</option><option value="return-service">Return Service</option></select></label><label className="theme-label grid gap-1 text-sm">Sort<select value={props.filters.sortOrder} onChange={(event) => updateFilters({ ...props.filters, sortOrder: event.target.value === "oldest" ? "oldest" : "newest" })} className="theme-input rounded-lg px-3 py-2 text-sm"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></fieldset>{items.length === 0 ? <p className="theme-copy rounded-2xl border border-white/10 p-4">No contracts match these filters. <Link href="/stud-contracts" className="underline">Show all contracts</Link>.</p> : items.map((item) => <article key={item.id} className="theme-card rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-wrap items-start gap-4"><Link href={`/stud-contracts/${item.id}`} className="theme-secondary-button inline-flex rounded-xl px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Open<span className="sr-only"> contract for {item.sire.name} and {item.dam.name}</span></Link><div><h2 className="theme-heading text-xl font-semibold">{item.sire.name} × {item.dam.name}</h2><p className="theme-copy mt-1 text-sm">{item.role} · Contract with {item.otherKennel}</p></div></div><span className="theme-status-info rounded-full px-3 py-1 text-sm font-semibold">Status: {item.lifecycleLabel}</span></div><dl className="theme-copy mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5"><div><dt className="theme-label">Current state</dt><dd className="mt-1">{item.currentState}{item.currentDeadline?.kind === "APPROVAL" ? ` — expires ${formatDate(item.currentDeadline.at)}` : ""}{item.secondaryStates.length > 0 ? <ul className="mt-1 list-disc pl-5" aria-label="Additional contract states">{item.secondaryStates.map((state) => <li key={state}>{state}</li>)}</ul> : null}</dd></div><div><dt className="theme-label">Action</dt><dd className="mt-1"><div className="flex flex-wrap gap-2">{item.actions.includes("MANUAL_APPROVAL") && item.manualApproval ? <PendingStudRequestActions contractId={item.id} canApprove={item.manualApproval.canApprove} approveDisabledReason={item.manualApproval.canApprove ? null : item.manualApproval.availabilityReason} /> : null}{item.actions.includes("PUPPY_SELECTION") && item.puppySelection ? <Link href={`/litters#stud-contract-selection-${item.puppySelection.litterId}`} className="theme-primary-button inline-flex rounded-xl px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Pick Puppy<span className="sr-only"> from this Stud Contract litter</span></Link> : null}{item.actions.includes("RETURN_SERVICE") && item.returnService ? <StudContractReturnServiceAction returnServiceId={item.returnService.id} expiresAt={item.returnService.expiresAt} canAttempt={item.returnService.canAttempt} unavailableReason={item.returnService.unavailableReason} /> : null}{item.actions.length === 0 ? "No action available" : null}</div></dd></div><div><dt className="theme-label">{item.currentDeadline ? deadlineLabel(item.currentDeadline.kind) : "Requested"}</dt><dd className="mt-1">{item.currentDeadline ? formatDate(item.currentDeadline.at) : formatDate(item.requestedAt)}</dd></div><div><dt className="theme-label">Agreement</dt><dd className="mt-1">{item.compensationSummary}{item.puppyTermsSummary ? ` · ${item.puppyTermsSummary}` : ""}</dd></div><div><dt className="theme-label">Return Service</dt><dd className="mt-1">{item.returnService ? `${item.returnService.label}${item.returnService.status === "AVAILABLE" ? ` — expires ${formatDate(item.returnService.expiresAt)} (real time)` : ""}` : "None recorded"}</dd></div></dl></article>)}{error ? <p className="theme-status-danger rounded-xl p-3 text-sm" role="alert">{error}</p> : null}{hasMore ? <button type="button" onClick={loadMore} disabled={loading} className="theme-primary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">{loading ? "Loading…" : "Load More"}</button> : null}</div>;
}
