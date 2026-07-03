import Link from "next/link";

import { db } from "@/lib/db";
import { peekSessionUserId } from "@/lib/session";

export default async function EmergencyCareLink() {
  const userId = await peekSessionUserId();

  if (!userId) {
    return null;
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!kennel) {
    return null;
  }

  const pendingEmergencies = await db.dogEmergencyCareEvent.findMany({
    where: {
      status: "PENDING",
      dog: {
        ownerKennelId: kennel.id,
      },
    },
    orderBy: [{ createdAtEpoch: "asc" }, { createdAt: "asc" }],
    take: 2,
    select: {
      dogId: true,
    },
  });

  if (pendingEmergencies.length === 0) {
    return null;
  }

  // TODO: Link multiple pending emergencies to a dedicated emergency list page.
  return (
    <Link
      href={`/dogs/${pendingEmergencies[0].dogId}`}
      className="game-header__emergency fixed right-4 top-[7.55rem] z-50 rounded-2xl px-3 py-1.5 text-right text-[11px] font-bold leading-4 backdrop-blur"
    >
      Emergency
    </Link>
  );
}
