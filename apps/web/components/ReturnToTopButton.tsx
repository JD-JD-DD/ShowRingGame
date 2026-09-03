"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const SCROLL_THRESHOLD_PX = 300;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ReturnToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();
  const hasBottomScrollControl =
    pathname === "/plan-a-litter" || /^\/shows\/[^/]+$/.test(pathname);

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(window.scrollY >= SCROLL_THRESHOLD_PX);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateVisibility);
    };
  }, []);

  return (
    <>
      {hasBottomScrollControl ? (
        <button
          type="button"
          aria-label="Scroll to bottom"
          onClick={() => {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: prefersReducedMotion() ? "auto" : "smooth",
            });
          }}
          className="theme-floating-button fixed bottom-20 right-4 z-50 rounded-full px-4 py-2 text-sm font-semibold motion-reduce:transition-none sm:bottom-24 sm:right-6"
        >
          Bottom
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Return to top"
        onClick={() => {
          window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        }}
        className={`theme-floating-button fixed bottom-6 right-4 z-50 rounded-full px-4 py-2 text-sm font-semibold motion-reduce:transition-none sm:bottom-8 sm:right-6 ${
          isVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        Top
      </button>
    </>
  );
}
