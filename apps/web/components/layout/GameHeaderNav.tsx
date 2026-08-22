"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

const navItems = [
  { label: "Home", href: "/" },
  { label: "My Kennel", href: "/kennel" },
  { label: "Shows", href: "/shows" },
  { label: "My Results", href: "/my-results" },
  { label: "Litters", href: "/litters" },
  { label: "Market", href: "/market" },
  { label: "Services", href: "/kennel/services" },
  { label: "Community", href: "/community" },
  { label: "Start Up Guide", href: "/start-up-guide" },
] as const;

const accountItems = [
  { label: "Settings", href: "/account" },
  { label: "Prestige", href: "/kennel/prestige" },
  { label: "In Memoriam", href: "/memorium" },
  { label: "Ledger", href: "/ledger" },
  { label: "Stud Requests", href: "/stud-contracts/requests" },
  { label: "My Stud Contracts", href: "/stud-contracts" },
  { label: "FAQ", href: "/faq" },
  { label: "Map", href: "/travel-map" },
  { label: "Point Schedules", href: "/point-schedules" },
  { label: "Players", href: "/districts/kennels" },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/kennel") return pathname === "/kennel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navClass(active: boolean): string {
  return [
    "rounded-xl px-2.5 py-1.5 text-sm font-semibold transition",
    active ? "game-header__link game-header__link--active" : "game-header__link",
  ].join(" ");
}

type GameHeaderNavProps = {
  balance: number | null;
  gameTime: ReactNode;
  inbox: ReactNode;
};

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export default function GameHeaderNav({
  balance,
  gameTime,
  inbox,
}: GameHeaderNavProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileCollapsed, setMobileCollapsed] = useState(true);
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
    <>
      <div
        className={`game-header__brand mr-1 shrink-0 rounded-xl px-3 py-2 text-sm font-black uppercase tracking-[0.18em] ${
          mobileCollapsed ? "hidden lg:block" : ""
        }`}
      >
        ShowRing
      </div>
    <nav
      aria-label="Game navigation"
      className="flex min-w-0 flex-1 items-center gap-1.5"
    >
      <div
        id="game-header-navigation"
        className={[
          "min-w-0 flex-1 flex-wrap items-center gap-1.5",
          mobileCollapsed ? "hidden lg:flex" : "flex",
        ].join(" ")}
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

      <div className="game-header__utilities ml-auto flex flex-wrap items-center gap-1.5">
        {balance !== null ? (
          <div className="game-header__balance rounded-xl px-2.5 py-1.5 text-sm font-semibold">
            Balance: {formatMoney(balance)}
          </div>
        ) : null}
        {gameTime}

        <div ref={accountRef} className="relative">
          <button
            type="button"
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            onClick={() => setAccountOpen((current) => !current)}
            className={[
              "rounded-xl px-2.5 py-1.5 text-sm font-semibold transition",
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
              <div className="game-header__menu-divider mt-2 border-t pt-2">
                <ThemeToggle />
              </div>
              <div className="game-header__menu-divider mt-2 border-t pt-2">
                <LogoutButton />
              </div>
            </div>
          ) : null}
        </div>
        {inbox}
      </div>
      </div>

      {mobileCollapsed ? (
        <div className="game-header__utilities ml-auto flex min-w-0 flex-1 items-center gap-1 lg:hidden">
          <Link
            href="/kennel"
            className="game-header__link rounded-xl px-2 py-1.5 text-xs font-semibold transition"
          >
            My Kennel
          </Link>
          <Link
            href="/shows"
            className="game-header__link rounded-xl px-2 py-1.5 text-xs font-semibold transition"
          >
            Shows
          </Link>
          {gameTime}
        </div>
      ) : null}

      <button
        type="button"
        aria-controls="game-header-navigation"
        aria-expanded={!mobileCollapsed}
        aria-label={mobileCollapsed ? "Expand navigation" : "Collapse navigation"}
        onClick={() => {
          setMobileCollapsed((current) => !current);
          setAccountOpen(false);
        }}
        className="game-header__account-button rounded-xl px-2.5 py-1.5 text-sm font-semibold transition lg:hidden"
      >
        <span aria-hidden="true">{mobileCollapsed ? "⌄" : "⌃"}</span>
      </button>
    </nav>
    </>
  );
}
