"use client";

import Link from "next/link";
import { useState } from "react";

type CoreLoopStep = {
  title: string;
  body: string;
  actions: Array<{
    label: string;
    href: string;
  }>;
  continueLabel?: string;
};

const coreLoopSteps: CoreLoopStep[] = [
  {
    title: "Create Kennel",
    body: "Your kennel is your home base. Once it exists, you can start buying dogs, organizing runs, breeding, and entering shows.",
    actions: [{ label: "My Kennel", href: "/kennel" }],
    continueLabel: "Continue to buying dogs",
  },
  {
    title: "Buy Dogs",
    body: "Start with foundation dogs or dogs from the market. You do not need perfect dogs to begin; part of the game is learning what your kennel produces over time.",
    actions: [{ label: "Browse Market", href: "/market" }],
    continueLabel: "Continue to viewing a dog",
  },
  {
    title: "View Dog",
    body: "Dog pages show the details that matter over time: traits, condition, health testing, show record, breeding status, and current Kennel Run.",
    actions: [{ label: "My Kennel", href: "/kennel" }],
    continueLabel: "Continue to breeding or showing",
  },
  {
    title: "Breed or Show",
    body: "You can build through breeding, campaigning, selling, grooming, and choosing which dogs to keep. Dogs are not single scores; different judges and situations matter.",
    actions: [
      { label: "Shows", href: "/shows" },
      { label: "My Kennel", href: "/kennel" },
    ],
    continueLabel: "Continue to results",
  },
  {
    title: "Check Results",
    body: "Results, titles, puppies, sales, and reputation build over time. The game clock keeps moving, so check back and adjust your kennel plans.",
    actions: [
      { label: "My Results", href: "/my-results" },
      { label: "My Kennel", href: "/kennel" },
    ],
  },
];

export default function CoreLoopStepper() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [furthestViewedIndex, setFurthestViewedIndex] = useState(0);

  function selectStep(index: number) {
    setActiveIndex(index);
    setFurthestViewedIndex((current) => Math.max(current, index));
  }

  function continueToNextStep() {
    const nextIndex = Math.min(activeIndex + 1, coreLoopSteps.length - 1);
    selectStep(nextIndex);
  }

  return (
    <section className="mb-8 rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-panel)] p-6 shadow-[var(--dog-shadow)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            The Core Loop
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--dog-copy)]">
            Move through the basics at your own pace. These steps guide your
            first decisions, but nothing here blocks play.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-5">
        {coreLoopSteps.map((step, index) => {
          const isActive = activeIndex === index;
          const isCompleted = index < furthestViewedIndex;
          const isFuture = index > furthestViewedIndex;

          return (
            <article
              key={step.title}
              className={[
                "rounded-2xl border p-4 transition",
                isActive
                  ? "border-purple-300/70 bg-purple-500/20 shadow-[var(--dog-shadow)]"
                  : isCompleted
                    ? "border-emerald-300/30 bg-white/[0.04]"
                    : "border-[var(--dog-border)] bg-[var(--dog-card)] opacity-80",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => selectStep(index)}
                aria-current={isActive ? "step" : undefined}
                className="block w-full rounded-xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="theme-label text-xs font-semibold uppercase tracking-[0.16em]">
                    Step {index + 1}
                  </div>
                  <span className="text-xs font-semibold text-[var(--dog-copy)]">
                    {isCompleted ? "Done" : isActive ? "Current Step" : "Next"}
                  </span>
                </div>
                <h3 className="theme-heading mt-2 text-base font-semibold">
                  {step.title}
                </h3>
              </button>

              <div
                className={[
                  "mt-3 grid gap-3",
                  isActive ? "" : isFuture ? "gap-2" : "",
                ].join(" ")}
              >
                {isActive || isCompleted ? (
                  <p className="text-sm leading-6 text-[var(--dog-copy)]">
                    {step.body}
                  </p>
                ) : (
                  <p className="text-xs leading-5 text-[var(--dog-copy)]">
                    Open this step when you are ready.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {step.actions.map((action) => (
                    <Link
                      key={`${step.title}-${action.href}-${action.label}`}
                      href={action.href}
                      className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>

                {index < coreLoopSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={continueToNextStep}
                    className={[
                      "rounded-xl px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300",
                      isActive
                        ? "bg-white text-purple-800 hover:bg-purple-50"
                        : "border border-[var(--dog-border)] text-[var(--dog-heading)] hover:bg-white/10",
                    ].join(" ")}
                  >
                    {step.continueLabel}
                  </button>
                ) : (
                  <Link
                    href="/kennel"
                    className="rounded-xl bg-white px-3 py-2 text-center text-xs font-semibold text-purple-800 transition hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                  >
                    Start Playing
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
