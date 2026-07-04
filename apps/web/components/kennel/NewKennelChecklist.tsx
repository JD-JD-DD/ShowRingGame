"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "showring.newKennelChecklist.dismissed";
const GUIDE_STORAGE_KEY = "showring.beginnerGuide.visited";

type ChecklistItem = {
  label: string;
  href: string;
  action: string;
  complete: boolean;
};

type NewKennelChecklistProps = {
  hasDogs: boolean;
  hasShowEntries: boolean;
  hasBreedingPlan: boolean;
  showByDefault: boolean;
};

export default function NewKennelChecklist({
  hasDogs,
  hasShowEntries,
  hasBreedingPlan,
  showByDefault,
}: NewKennelChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [guideVisited, setGuideVisited] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "true");
      setGuideVisited(window.localStorage.getItem(GUIDE_STORAGE_KEY) === "true");
    } finally {
      setLoaded(true);
    }
  }, []);

  const items = useMemo<ChecklistItem[]>(
    () => [
      {
        label: "Read the beginner guide",
        href: "/guide",
        action: "Open Guide",
        complete: guideVisited,
      },
      {
        label: "Visit the Market",
        href: "/market",
        action: "Browse Market",
        complete: hasDogs,
      },
      {
        label: "Buy your first dog",
        href: "/market",
        action: "Find Dogs",
        complete: hasDogs,
      },
      {
        label: "Open a dog profile",
        href: "/kennel",
        action: "View Roster",
        complete: hasDogs,
      },
      {
        label: "Enter a show",
        href: "/shows",
        action: "Find Shows",
        complete: hasShowEntries,
      },
      {
        label: "Plan a breeding",
        href: "/plan-a-litter",
        action: "Plan Litter",
        complete: hasBreedingPlan,
      },
    ],
    [guideVisited, hasBreedingPlan, hasDogs, hasShowEntries]
  );

  const completedCount = items.filter((item) => item.complete).length;
  const shouldShow =
    loaded && !dismissed && (showByDefault || completedCount < items.length);

  if (!shouldShow) {
    return null;
  }

  function dismissChecklist() {
    setDismissed(true);
    window.localStorage.setItem(STORAGE_KEY, "true");
  }

  function markGuideVisited(href: string) {
    if (href !== "/guide") {
      return;
    }

    setGuideVisited(true);
    window.localStorage.setItem(GUIDE_STORAGE_KEY, "true");
  }

  return (
    <section className="theme-panel mb-8 rounded-2xl p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
            New Kennel Checklist
          </p>
          <h2 className="theme-heading mt-2 text-xl font-semibold">
            Build your first loop without a forced tutorial
          </h2>
          <p className="theme-copy mt-2 max-w-3xl text-sm leading-6">
            Use these quick routes whenever you want direction. Nothing here
            blocks play, and you can dismiss it once your kennel has its footing.
          </p>
        </div>

        <button
          type="button"
          onClick={dismissChecklist}
          className="theme-secondary-button inline-flex self-start rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => markGuideVisited(item.href)}
            className="theme-card-interactive rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={[
                  "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black",
                  item.complete
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                    : "border-[var(--dog-border-strong)] bg-[var(--dog-card)] text-[var(--dog-label)]",
                ].join(" ")}
              >
                {item.complete ? "OK" : ""}
              </span>
              <span className="min-w-0">
                <span className="theme-heading block text-sm font-semibold">
                  {item.label}
                </span>
                <span className="theme-label mt-1 block text-xs font-semibold uppercase tracking-[0.14em]">
                  {item.complete ? "Complete" : item.action}
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
