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
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={isOpen}
        >
          <h2 className={`${titleClassName} dog-heading font-semibold`}>{title}</h2>
          {description ? (
            <p className="dog-copy mt-2 text-sm leading-7">
              {description}
            </p>
          ) : null}
        </button>

        {badge ? <div className="shrink-0">{badge}</div> : null}
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="shrink-0"
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
          aria-expanded={isOpen}
        >
          <span
            className={`dog-section-toggle inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
            aria-hidden="true"
          >
            &gt;
          </span>
        </button>
      </div>

      {isOpen ? <div className={contentClassName}>{children}</div> : null}
    </section>
  );
}
