"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationInboxLink from "@/components/NotificationInboxLink";
import { formatInboxUnreadCount } from "@/components/NotificationInboxBadge";

const primaryNavItems = [{ label: "Home", href: "/" }] as const;

const primaryNavMenus = [
  {
    label: "My Kennel",
    activeHref: "/kennel",
    items: [
      { label: "My Kennel", href: "/kennel" },
      { label: "Prestige", href: "/kennel/prestige" },
      { label: "In Memoriam", href: "/memorium" },
      { label: "Ledger", href: "/ledger" },
    ],
  },
  {
    label: "Shows",
    activeHref: "/shows",
    items: [
      { label: "Shows", href: "/shows" },
      { label: "My Results", href: "/my-results" },
      { label: "Point Schedules", href: "/point-schedules" },
    ],
  },
  {
    label: "Breeding",
    activeHref: "/breed",
    items: [
      { label: "Plan a Litter", href: "/plan-a-litter" },
      { label: "Litters", href: "/litters" },
      { label: "Stud Contracts", href: "/stud-contracts" },
    ],
  },
  {
    label: "Market",
    activeHref: "/market",
    items: [
      { label: "Market", href: "/market" },
      { label: "Services", href: "/kennel/services" },
    ],
  },
  {
    label: "Community",
    activeHref: "/community",
    items: [
      { label: "Community", href: "/community" },
      { label: "Players", href: "/districts/kennels" },
    ],
  },
] as const;

const accountItems = [
  { label: "Settings", href: "/account" },
  { label: "Support", href: "/support" },
  { label: "FAQ", href: "/faq" },
  { label: "Map", href: "/travel-map" },
  { label: "Start Up Guide", href: "/start-up-guide" },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/kennel") return pathname === "/kennel";
  return pathname === href || pathname.startsWith(href + "/");
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
  isAuthenticated: boolean;
};

function formatMoney(amount: number): string {
  return "$" + amount.toLocaleString();
}

export default function GameHeaderNav({
  balance,
  gameTime,
  isAuthenticated,
}: GameHeaderNavProps) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileCollapsed, setMobileCollapsed] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const accountActive = accountItems.some((item) =>
    isActivePath(pathname, item.href)
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setOpenMenu(null), 0);
    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        navigationRef.current &&
        !navigationRef.current.contains(target)
      ) {
        setOpenMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const menu = openMenu;
      if (event.key !== "Escape" || menu === null) return;

      const trigger = triggerRefs.current[menu];
      setOpenMenu(null);
      trigger?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  return (
    <>
      <div
        className={[
          "game-header__brand mr-1 shrink-0 rounded-xl px-3 py-2 text-sm font-black uppercase tracking-[0.18em]",
          mobileCollapsed ? "hidden lg:block" : "",
        ].join(" ")}
      >
        ShowRing
      </div>
      <nav aria-label="Game navigation" className="flex min-w-0 flex-1 items-center gap-1.5">
        <div
          ref={navigationRef}
          id="game-header-navigation"
          className={[
            "min-w-0 flex-1 flex-wrap items-center gap-1.5",
            mobileCollapsed ? "hidden lg:flex" : "flex",
          ].join(" ")}
        >
          {primaryNavItems.map((item) => (
            <Link key={item.href} href={item.href} className={navClass(isActivePath(pathname, item.href))}>
              {item.label}
            </Link>
          ))}

          {primaryNavMenus.map((menu) => {
            const isOpen = openMenu === menu.label;
            const active =
              (menu.activeHref !== undefined &&
                isActivePath(pathname, menu.activeHref)) ||
              menu.items.some((item) => isActivePath(pathname, item.href));
            const menuId =
              "game-header-" +
              menu.label.toLowerCase().replace(/\s+/g, "-") +
              "-menu";

            return (
              <div key={menu.label} className="relative">
                <button
                  ref={(element) => {
                    triggerRefs.current[menu.label] = element;
                  }}
                  id={menuId + "-trigger"}
                  type="button"
                  aria-controls={menuId}
                  aria-expanded={isOpen}
                  onClick={() => setOpenMenu((current) => current === menu.label ? null : menu.label)}
                  className={navClass(active)}
                >
                  {menu.label}
                </button>

                {isOpen ? (
                  <div
                    id={menuId}
                    className="game-header__menu absolute left-0 top-full z-[70] mt-2 min-w-48 max-w-[calc(100vw-1.5rem)] rounded-2xl p-2 text-sm backdrop-blur"
                  >
                    {menu.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenMenu(null)}
                        className={[
                          "game-header__menu-item block rounded-xl px-3 py-2 font-semibold transition",
                          isActivePath(pathname, item.href) ? "game-header__menu-item--active" : "",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="game-header__utilities ml-auto flex flex-wrap items-center gap-1.5">
            {balance !== null ? (
              <div className="game-header__balance rounded-xl px-2.5 py-1.5 text-sm font-semibold">
                Balance: {formatMoney(balance)}
              </div>
            ) : null}
            {gameTime}

            <div className="relative">
              <button
                ref={(element) => {
                  triggerRefs.current.Account = element;
                }}
                id="game-header-account-trigger"
                type="button"
                aria-controls="game-header-account-menu"
                aria-expanded={openMenu === "Account"}
                onClick={() => setOpenMenu((current) => current === "Account" ? null : "Account")}
                className={[
                  "rounded-xl px-2.5 py-1.5 text-sm font-semibold transition",
                  accountActive
                    ? "game-header__account-button game-header__account-button--active"
                    : "game-header__account-button",
                ].join(" ")}
              >
                Account
              </button>

              {openMenu === "Account" ? (
                <div
                  id="game-header-account-menu"
                  className="game-header__menu absolute right-0 top-full z-[70] mt-2 min-w-48 max-w-[calc(100vw-1.5rem)] rounded-2xl p-2 text-sm backdrop-blur"
                >
                  {accountItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenMenu(null)}
                      className={[
                        "game-header__menu-item block rounded-xl px-3 py-2 font-semibold transition",
                        isActivePath(pathname, item.href) ? "game-header__menu-item--active" : "",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div className="game-header__menu-divider mt-2 border-t pt-2"><ThemeToggle /></div>
                  {isAuthenticated ? (
                    <div className="game-header__menu-divider mt-2 border-t pt-2"><LogoutButton /></div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <NotificationInboxLink onUnreadCountChange={setUnreadCount} />
          </div>
        </div>

        {mobileCollapsed ? (
          <div className="game-header__utilities ml-auto flex min-w-0 flex-1 flex-wrap items-center gap-1 lg:hidden">
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
            {unreadCount > 0 ? (
              <Link
                href="/inbox"
                aria-label={formatInboxUnreadCount(unreadCount) + " unread messages. Open Inbox"}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="theme-status-danger inline-flex min-h-7 min-w-7 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {formatInboxUnreadCount(unreadCount)}
                </span>
              </Link>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          aria-controls="game-header-navigation"
          aria-expanded={!mobileCollapsed}
          aria-label={mobileCollapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => {
            setMobileCollapsed((current) => !current);
            setOpenMenu(null);
          }}
          className="game-header__account-button rounded-xl px-2.5 py-1.5 text-sm font-semibold transition lg:hidden"
        >
          <span aria-hidden="true">{mobileCollapsed ? "⌄" : "⌃"}</span>
        </button>
      </nav>
    </>
  );
}
