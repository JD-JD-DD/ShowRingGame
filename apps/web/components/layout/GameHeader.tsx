import { Suspense } from "react";

import EmergencyCareLink from "@/components/EmergencyCareLink";
import GlobalUtcClock from "@/components/GlobalUtcClock";
import NotificationInboxLink from "@/components/NotificationInboxLink";
import { db } from "@/lib/db";
import { peekSessionUserId } from "@/lib/session";
import GameHeaderNav from "./GameHeaderNav";

export default async function GameHeader() {
  const userId = await peekSessionUserId();
  const kennel = userId
    ? await db.kennel.findUnique({
        where: { userId },
        select: { balance: true },
      })
    : null;

  return (
    <header className="game-header sticky top-0 z-40 px-3 py-2 backdrop-blur-xl sm:px-4">
      <div className="game-header__inner mx-auto flex max-w-none flex-wrap items-center gap-2">
        <GameHeaderNav
          balance={kennel?.balance ?? null}
          gameTime={<GlobalUtcClock />}
          inbox={
            <Suspense fallback={null}>
              <NotificationInboxLink />
            </Suspense>
          }
        />
      </div>

      <Suspense fallback={null}>
        <EmergencyCareLink />
      </Suspense>
    </header>
  );
}
