import { Suspense } from "react";

import EmergencyCareLink from "@/components/EmergencyCareLink";
import GlobalUtcClock from "@/components/GlobalUtcClock";
import NotificationInboxLink from "@/components/NotificationInboxLink";
import { getSessionUserId } from "@/lib/session";
import GameHeaderNav from "./GameHeaderNav";

export default async function GameHeader() {
  const userId = await getSessionUserId();

  return (
    <header className="sticky top-0 z-40 border-b border-purple-200/15 bg-[#160b25]/85 px-4 py-3 shadow-[0_12px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-6 lg:pr-72">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <LinkBrand />
        <GameHeaderNav isLoggedIn={Boolean(userId)} />
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
    <div className="mr-1 shrink-0 rounded-xl border border-purple-200/15 bg-white/5 px-3 py-2 text-sm font-black uppercase tracking-[0.18em] text-purple-50">
      ShowRing
    </div>
  );
}
