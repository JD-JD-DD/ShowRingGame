"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshSupportStatusButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  return <button type="button" onClick={() => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 500);
  }} disabled={refreshing} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
    {refreshing ? "Refreshing…" : "Refresh Support Status"}
  </button>;
}
