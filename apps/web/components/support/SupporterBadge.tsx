import Link from "next/link";

import type { SupportPresentationTierValue } from "@/lib/supportPresentation";

const TIER_PRESENTATION: Record<SupportPresentationTierValue, { label: string; className: string }> = {
  BRONZE: { label: "Bronze Supporter", className: "border-amber-800 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100" },
  SILVER: { label: "Silver Supporter", className: "border-slate-500 bg-slate-100 text-slate-950 dark:border-slate-400 dark:bg-slate-800 dark:text-slate-100" },
  GOLD: { label: "Gold Supporter", className: "border-yellow-700 bg-yellow-100 text-yellow-950 dark:border-yellow-400 dark:bg-yellow-950 dark:text-yellow-100" },
};

export default function SupporterBadge({ tier }: { tier: SupportPresentationTierValue }) {
  const presentation = TIER_PRESENTATION[tier];
  return <Link href="/support" title="Support ShowRing" aria-label={presentation.label} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${presentation.className}`}>
    <span aria-hidden="true" className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
    Supporter
  </Link>;
}
