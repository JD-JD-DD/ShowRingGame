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
          className="dog-card grid gap-5 rounded-2xl p-4 sm:col-span-2 sm:grid-cols-2"
        >
          <ManageDogGroup title="Identity">{identity}</ManageDogGroup>
          <ManageDogGroup title="Kennel">{kennel}</ManageDogGroup>
          <ManageDogGroup title="Breeding">{breeding}</ManageDogGroup>
          <ManageDogGroup title="Grooming">{grooming}</ManageDogGroup>
          <ManageDogGroup title="Shows">{shows}</ManageDogGroup>
          <ManageDogGroup title="Stud">{stud}</ManageDogGroup>
          <ManageDogGroup title="Market">{market}</ManageDogGroup>
        </section>
      ) : null}
    </>
  );
}
