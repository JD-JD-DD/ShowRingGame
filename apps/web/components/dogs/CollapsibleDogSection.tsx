"use client";

import { useState } from "react";

type CollapsibleDogSectionProps = {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  defaultOpen?: boolean;
};

export default function CollapsibleDogSection({
  title,
  description,
  badge,
  children,
  className = "",
  contentClassName = "",
  titleClassName = "text-2xl",
  defaultOpen = false,
}: CollapsibleDogSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={isOpen}
      >
        <div>
          <h2 className={`${titleClassName} dog-heading font-semibold`}>{title}</h2>
          {description ? (
            <p className="dog-copy mt-2 text-sm leading-7">
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {badge}
          <span
            className={`dog-section-toggle inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
            aria-hidden="true"
          >
            &gt;
          </span>
        </div>
      </button>

      {isOpen ? <div className={contentClassName}>{children}</div> : null}
    </section>
  );
}
