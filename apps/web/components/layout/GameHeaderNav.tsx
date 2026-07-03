"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import LogoutButton from "@/components/LogoutButton";

const navItems = [
  { label: "Home", href: "/" },
  { label: "My Kennel", href: "/kennel" },
  { label: "Shows", href: "/shows" },
  { label: "My Results", href: "/my-results" },
  { label: "Litters", href: "/litters" },
  { label: "Market", href: "/market" },
  { label: "Services", href: "/kennel/services" },
  { label: "Community", href: "/community" },
] as const;

const accountItems = [
  { label: "Region", href: "/travel-map" },
  { label: "Prestige", href: "/kennel/prestige" },
  { label: "In Memoriam", href: "/memorium" },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/kennel") return pathname === "/kennel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navClass(active: boolean): string {
  return [
    "rounded-xl px-3 py-2 text-sm font-semibold transition",
    active ? "game-header__link game-header__link--active" : "game-header__link",
  ].join(" ");
}

export default function GameHeaderNav() {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const accountActive = accountItems.some((item) =>
    isActivePath(pathname, item.href)
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setAccountOpen(false), 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        accountRef.current &&
        !accountRef.current.contains(target)
      ) {
        setAccountOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen]);

  return (
    <nav
      aria-label="Game navigation"
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={navClass(isActivePath(pathname, item.href))}
        >
          {item.label}
        </Link>
      ))}

      <div ref={accountRef} className="relative">
        <button
          type="button"
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          onClick={() => setAccountOpen((current) => !current)}
          className={[
            "rounded-xl px-3 py-2 text-sm font-semibold transition",
            accountActive
              ? "game-header__account-button game-header__account-button--active"
              : "game-header__account-button",
          ].join(" ")}
        >
          Account
        </button>

        {accountOpen ? (
          <div
            role="menu"
            className="game-header__menu absolute right-0 top-full z-[70] mt-2 min-w-48 rounded-2xl p-2 text-sm backdrop-blur"
          >
            {accountItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setAccountOpen(false)}
                className={[
                  "game-header__menu-item block rounded-xl px-3 py-2 font-semibold transition",
                  isActivePath(pathname, item.href)
                    ? "game-header__menu-item--active"
                    : "",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
            <div
              className="game-header__menu-divider mt-2 border-t pt-2"
              onClickCapture={() => setAccountOpen(false)}
            >
              <LogoutButton />
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
