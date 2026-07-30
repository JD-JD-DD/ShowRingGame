"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const HIDDEN_HEADER_PATHNAMES = new Set(["/signup", "/login", "/onboarding"]);

type GameHeaderVisibilityProps = {
  children: ReactNode;
};

export default function GameHeaderVisibility({
  children,
}: GameHeaderVisibilityProps) {
  const pathname = usePathname();

  if (HIDDEN_HEADER_PATHNAMES.has(pathname)) {
    return null;
  }

  return <>{children}</>;
}
