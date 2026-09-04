"use client";

import { type ReactNode, useId, useState } from "react";

type ManageDogPanelProps = {
  identity: ReactNode;
  kennel: ReactNode;
  breeding: ReactNode;
  grooming: ReactNode;
  shows: ReactNode;
  stud: ReactNode;
  market: ReactNode;
};

type ManageDogGroupProps = {
  title: string;
  children: ReactNode;
};

function ManageDogGroup({ title, children }: ManageDogGroupProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="theme-label text-xs font-semibold uppercase tracking-[0.16em]"
      >
        {title}
      </h3>
      {children ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}

export default function ManageDogPanel({
  identity,
  kennel,
  breeding,
  grooming,
  shows,
  stud,
  market,
}: ManageDogPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Manage Dog
      </button>
      {isOpen ? (
        <section
          id={panelId}
          aria-label="Manage Dog"
          className="theme-panel basis-full rounded-2xl p-5 lg:absolute lg:right-0 lg:top-full lg:z-10 lg:mt-3 lg:w-[min(42rem,calc(100vw-3rem))]"
        >
          <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
            <ManageDogGroup title="Identity">{identity}</ManageDogGroup>
            <ManageDogGroup title="Kennel">{kennel}</ManageDogGroup>
            <ManageDogGroup title="Breeding">{breeding}</ManageDogGroup>
            <ManageDogGroup title="Grooming">{grooming}</ManageDogGroup>
            <div className="sm:col-span-2"><ManageDogGroup title="Shows">{shows}</ManageDogGroup></div>
            <ManageDogGroup title="Stud">{stud}</ManageDogGroup>
            <ManageDogGroup title="Market">{market}</ManageDogGroup>
          </div>
        </section>
      ) : null}
    </>
  );
}
