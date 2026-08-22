"use client";

import Link from "next/link";
import { useState } from "react";

type Item = Awaited<ReturnType<typeof import("@/server/services/studContractHistory.service").listStudContractsForKennel>>["items"][number];

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
function formatDate(value: string | null) { return value ? dateFormatter.format(new Date(value)) : "Not recorded"; }

export function StudContractHistoryClient(props: { initialItems: Item[]; initialCursor: string | null; initialHasMore: boolean }) {
  const [items, setItems] = useState(props.initialItems);
  const [cursor, setCursor] = useState(props.initialCursor);
  const [hasMore, setHasMore] = useState(props.initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/stud-contracts/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cursor }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to load more Stud Contracts.");
      setItems((current) => [...current, ...payload.items.filter((item: Item) => !current.some((existing) => existing.id === item.id))]);
      setCursor(payload.nextCursor ?? null); setHasMore(payload.hasMore === true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load more Stud Contracts."); }
    finally { setLoading(false); }
  }
  if (items.length === 0) return <p className="theme-copy mt-6 rounded-2xl border border-white/10 p-4">Your accepted and pending Stud Contracts will appear here.</p>;
  return <div className="mt-6 grid gap-4">{items.map((item) => <article key={item.id} className="theme-card rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="theme-heading text-xl font-semibold">{item.sire.name} × {item.dam.name}</h2><p className="theme-copy mt-1 text-sm">{item.role} · Contract with {item.otherKennel}</p></div><span className="theme-status-info rounded-full px-3 py-1 text-sm font-semibold">{item.lifecycleLabel}</span></div><dl className="theme-copy mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4"><div><dt className="theme-label">Agreement</dt><dd className="mt-1">{item.compensationSummary}{item.puppyTermsSummary ? ` · ${item.puppyTermsSummary}` : ""}</dd></div><div><dt className="theme-label">Requested</dt><dd className="mt-1">{formatDate(item.requestedAt)}</dd></div><div><dt className="theme-label">Return Service</dt><dd className="mt-1">{item.returnService ? `${item.returnService.label}${item.returnService.status === "AVAILABLE" ? ` — expires ${formatDate(item.returnService.expiresAt)} (real time)` : ""}` : "None recorded"}</dd></div><div><dt className="theme-label">Puppy Back</dt><dd className="mt-1">{item.puppySelection ? item.puppySelection.status.replaceAll("_", " ") : "Not applicable"}</dd></div></dl><Link href={`/stud-contracts/${item.id}`} className="theme-secondary-button mt-4 inline-flex rounded-xl px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">View Contract</Link></article>)}{error ? <p className="theme-status-danger rounded-xl p-3 text-sm" role="alert">{error}</p> : null}{hasMore ? <button type="button" onClick={loadMore} disabled={loading} className="theme-primary-button rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">{loading ? "Loading…" : "Load More"}</button> : null}</div>;
}
