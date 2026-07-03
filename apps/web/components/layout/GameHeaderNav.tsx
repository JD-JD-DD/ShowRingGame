"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    "rounded-xl border px-3 py-2 text-sm font-semibold transition",
    active
      ? "border-fuchsia-200/45 bg-fuchsia-500/25 text-white shadow-[0_8px_26px_rgba(168,85,247,0.22)]"
      : "border-purple-200/15 bg-white/5 text-purple-50/85 hover:border-purple-100/35 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

export default function GameHeaderNav({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();
  const accountActive = accountItems.some((item) =>
    isActivePath(pathname, item.href)
  );

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

      <details className="group relative">
        <summary
          className={[
            "list-none cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold transition marker:hidden",
            accountActive
              ? "border-fuchsia-200/45 bg-fuchsia-500/25 text-white shadow-[0_8px_26px_rgba(168,85,247,0.22)]"
              : "border-purple-200/15 bg-white/5 text-purple-50/85 hover:border-purple-100/35 hover:bg-white/10 hover:text-white",
          ].join(" ")}
        >
          Account
        </summary>

        <div className="absolute right-0 top-full z-[70] mt-2 min-w-48 rounded-2xl border border-purple-200/20 bg-[#1b102c]/95 p-2 text-sm shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur">
          {accountItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-xl px-3 py-2 font-semibold transition",
                isActivePath(pathname, item.href)
                  ? "bg-fuchsia-500/20 text-white"
                  : "text-purple-50/85 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
          {isLoggedIn ? (
            <div className="mt-2 border-t border-purple-200/15 pt-2">
              <LogoutButton />
            </div>
          ) : null}
        </div>
      </details>
    </nav>
  );
}
