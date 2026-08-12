import type { Metadata } from "next";
import Link from "next/link";

import TraitLine from "@/components/ui/TraitLine";
import CoreLoopStepper from "./CoreLoopStepper";
import GuideVisitedMarker from "./GuideVisitedMarker";
import { exampleVisibleCategories } from "./exampleDogData";

export const metadata: Metadata = {
  title: "New Player Guide | ShowRing Game",
  description:
    "A beginner guide to building a kennel, buying foundation dogs, reading dog pages, breeding, entering shows, and checking results in ShowRing.",
};

const overviewCards = [
  {
    title: "Build a Kennel",
    body: "Buy, breed, sell, campaign, and manage dogs over time.",
  },
  {
    title: "Dogs Are Not Single Scores",
    body: "Visible ring categories, judge preferences, condition, age, and hidden inheritance all matter.",
  },
  {
    title: "Time Moves Fast",
    body: "Shows, breedings, litters, grooming, and results move on the game clock.",
  },
];

const firstSteps = [
  {
    title: "Create your kennel",
    body: "Your kennel is the home base for dogs, litters, show entries, and reputation.",
    where: "My Kennel",
    href: "/kennel",
    action: "Go to My Kennel",
  },
  {
    title: "Go to Market",
    body: "The market is where new kennels browse foundation dogs and player listings.",
    where: "Market",
    href: "/market",
    action: "Browse Market",
  },
  {
    title: "Choose a breed",
    body: "Start narrow. Learning one breed makes judging categories and breeding goals easier to read.",
    where: "Market filters",
    href: "/market",
    action: "Compare Breeds",
  },
  {
    title: "Buy at least two dogs",
    body: "Foundation dogs are starter stock. Look for near-ideal areas or useful profiles you want to build around.",
    where: "Dog listing",
    href: "/market",
    action: "Find Dogs",
  },
  {
    title: "Open My Dogs",
    body: "Your kennel roster shows owned dogs and quick access to each profile.",
    where: "My Kennel",
    href: "/kennel",
    action: "View My Dogs",
  },
  {
    title: "Click a dog",
    body: "Dog pages are where you evaluate visible categories, age, condition, health, pedigree, and actions.",
    where: "Example dog page",
    href: "/start-up-guide/example-dog",
    action: "View Example Dog",
  },
  {
    title: "Enter a show or plan a breeding",
    body: "Shows prove dogs in the ring. Breeding turns your evaluation into the next generation.",
    where: "Shows or Plan A Litter",
    href: "/shows",
    action: "Find Shows",
  },
];

const dogPageNotes = [
  "Around 10 is near ideal.",
  "Under 10 means the dog appears under ideal in that area.",
  "Over 10 means the dog appears over ideal.",
  "Higher is not always better.",
  "Pairing dogs is about balance and goals, not maxing every bar.",
];

const foundationTips = [
  "Foundation dogs are starter stock, not finished perfection.",
  "Look for dogs with near-ideal areas or useful profiles you want to build around.",
  "Compare visible categories, age, sex, breed, and price.",
  "Buy more than one dog if you want to start breeding.",
];

const breedingBasics = [
  "Dogs must be eligible before they can be bred.",
  "Breedings need compatible dogs.",
  "Puppies take time.",
  "Puppies inherit from both parents with variation.",
  "The goal is to build a program, not simply pair the highest numbers.",
];

const showBasics = [
  "Find an upcoming show.",
  "Enter eligible dogs before entries close.",
  "Shows close before judging begins.",
  "Results publish after judging.",
  "Judges may prefer different things.",
];

const faqs = [
  {
    question: "Why can't I breed this dog?",
    answer:
      "It may be too young, too old if female, already pregnant, retired, or otherwise ineligible.",
  },
  {
    question: "Why can't I enter this dog?",
    answer:
      "It may be too young, too old, not alive or active, already entered, or the show may not be open.",
  },
  {
    question: "Why don't I see exact genetics?",
    answer:
      "ShowRing is about evaluating visible dogs and building breeding strategy. Hidden traits are part of the simulation.",
  },
  {
    question: "Why did my dog not win?",
    answer:
      "Judging uses multiple categories, judge preference, competition, condition, and small variance.",
  },
  {
    question: "What should I do first?",
    answer:
      "Buy a few foundation dogs, open their dog pages, compare visible categories, enter a show, and plan a breeding.",
  },
];

export default function GuidePage() {
  return (
    <main className="guide-page min-h-screen px-6 py-8 text-white">
      <GuideVisitedMarker />

      <div className="mx-auto max-w-7xl">
        <header className="theme-panel mb-8 rounded-[28px] px-6 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="theme-label text-sm font-semibold uppercase tracking-[0.22em]">
                New Player Guide
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Start Here
              </h1>
              <p className="theme-copy mt-4 max-w-3xl text-sm leading-7 sm:text-base">
                A practical path through your first kennel decisions, without a
                forced tutorial. Keep playing, come back when something feels
                murky, and use the direct links to jump into the game.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/kennel"
                className="theme-secondary-button rounded-xl px-5 py-3 text-sm font-semibold"
              >
                My Kennel
              </Link>
              <Link
                href="/market"
                className="theme-primary-button rounded-xl px-5 py-3 text-sm font-semibold"
              >
                Browse Market
              </Link>
            </div>
          </div>
        </header>

        <CoreLoopStepper />

        <section className="mb-8 grid gap-5 md:grid-cols-3">
          {overviewCards.map((card) => (
            <article
              key={card.title}
              className="theme-card rounded-[24px] p-5 shadow-[var(--dog-shadow)]"
            >
              <h2 className="theme-heading text-lg font-semibold">
                {card.title}
              </h2>
              <p className="theme-copy mt-3 text-sm leading-7">
                {card.body}
              </p>
            </article>
          ))}
        </section>

        <section
          id="first-useful-route"
          className="theme-panel mb-8 scroll-mt-6 rounded-[28px] p-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
                First 10 Minutes
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Your first useful route
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {firstSteps.map((step, index) => (
              <article key={step.title} className="theme-card rounded-2xl p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--dog-border-strong)] bg-[var(--dog-control)] text-sm font-bold text-[var(--dog-label)]">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="theme-copy mt-2 text-sm leading-6">
                      {step.body}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="theme-neutral-badge rounded-xl px-3 py-1.5 text-xs font-semibold">
                        Where: {step.where}
                      </span>
                      <Link
                        href={step.href}
                        className="theme-primary-button rounded-xl px-3 py-1.5 text-xs font-semibold"
                      >
                        {step.action}
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="theme-panel rounded-[28px] p-6">
            <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
              Understanding Dog Pages
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Visible categories are not exact genetics
            </h2>
            <p className="theme-copy mt-3 text-sm leading-7">
              They are what you can observe about the dog in the ring. Hidden
              inherited traits still exist, but the dog page is about practical
              evaluation: what appears under ideal, near ideal, over ideal,
              balanced, or extreme.
            </p>

            <div className="mt-5 grid gap-2">
              {dogPageNotes.map((note) => (
                <div
                  key={note}
                  className="theme-card theme-copy rounded-xl px-4 py-3 text-sm leading-6"
                >
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div className="theme-card rounded-[28px] p-6 shadow-[var(--dog-shadow)]">
            <h3 className="theme-heading text-lg font-semibold">
              Sample Visible Categories
            </h3>
            <p className="theme-copy mt-2 text-sm leading-6">
              This uses the same slider display as a real dog profile.
            </p>
            <div className="mt-5 grid gap-5">
              {exampleVisibleCategories.map((category) => (
                <TraitLine
                  key={category.key}
                  label={category.label}
                  value={category.numericScore}
                  min={category.min}
                  max={category.max}
                  ideal={category.ideal}
                  leftLabel={category.leftLabel}
                  centerLabel={category.centerLabel}
                  rightLabel={category.rightLabel}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          <GuideList
            title="Buying Foundation Dogs"
            body="Keep it practical: starter stock should give you something useful to build around."
            items={foundationTips}
            href="/market"
            action="Browse Foundation Dogs"
          />
          <GuideList
            title="Breeding Basics"
            body="Beginner breeding is about eligibility, compatibility, time, and a clear goal."
            items={breedingBasics}
            href="/plan-a-litter"
            action="Plan A Litter"
          />
          <GuideList
            title="Shows & Results"
            body="Shows turn your evaluation into public proof, titles, rankings, and future breeding clues."
            items={showBasics}
            href="/shows"
            action="Find Shows"
          />
        </section>

        <section className="theme-panel rounded-[28px] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
                Common Confusions
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Quick answers
              </h2>
            </div>
            <Link
              href="/faq"
              className="theme-secondary-button inline-flex self-start rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Full FAQ
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.question} className="theme-card rounded-2xl p-4">
                <h3 className="text-base font-semibold text-white">
                  {item.question}
                </h3>
                <p className="theme-copy mt-2 text-sm leading-7">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function GuideList({
  title,
  body,
  items,
  href,
  action,
}: {
  title: string;
  body: string;
  items: string[];
  href: string;
  action: string;
}) {
  return (
    <article className="theme-card rounded-[24px] p-5 shadow-[var(--dog-shadow)]">
      <h2 className="theme-heading text-xl font-semibold">{title}</h2>
      <p className="theme-copy mt-3 text-sm leading-7">{body}</p>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="theme-control px-3 py-2 text-sm leading-6"
          >
            {item}
          </div>
        ))}
      </div>
      <Link
        href={href}
        className="theme-primary-button mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
      >
        {action}
      </Link>
    </article>
  );
}
