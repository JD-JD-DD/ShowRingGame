import { Suspense } from "react";

import EmergencyCareLink from "@/components/EmergencyCareLink";
import GlobalUtcClock from "@/components/GlobalUtcClock";
import NotificationInboxLink from "@/components/NotificationInboxLink";
import GameHeaderNav from "./GameHeaderNav";

export default function GameHeader() {
  return (
    <header className="game-header sticky top-0 z-40 px-4 py-3 backdrop-blur-xl sm:px-6 lg:pr-72">
      <div className="game-header__inner mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <LinkBrand />
        <GameHeaderNav />
      </div>

      <GlobalUtcClock />
      <Suspense fallback={null}>
        <NotificationInboxLink />
        <EmergencyCareLink />
      </Suspense>
    </header>
  );
}

function LinkBrand() {
  return (
    <div className="game-header__brand mr-1 shrink-0 rounded-xl px-3 py-2 text-sm font-black uppercase tracking-[0.18em]">
      ShowRing
    </div>
  );
}
