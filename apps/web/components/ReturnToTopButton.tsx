"use client";

import { useEffect, useState } from "react";

const SCROLL_THRESHOLD_PX = 300;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ReturnToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

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
    <button
      type="button"
      aria-label="Return to top"
      onClick={() => {
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }}
      className={`fixed bottom-6 right-4 z-50 rounded-full border border-purple-300/25 bg-purple-950/80 px-4 py-2 text-sm font-semibold text-purple-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur transition duration-200 hover:bg-purple-800/80 focus:outline-none focus:ring-2 focus:ring-amber-300/70 focus:ring-offset-2 focus:ring-offset-purple-950 motion-reduce:transition-none sm:bottom-8 sm:right-6 ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      ↑ Top
    </button>
  );
}
