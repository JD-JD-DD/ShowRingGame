import Link from "next/link";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export default async function EmergencyCareLink() {
  const userId = await getSessionUserId();

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
      className="fixed right-4 top-[7.55rem] z-50 rounded-2xl border border-red-300/35 bg-red-950/75 px-3 py-1.5 text-right text-[11px] font-bold leading-4 text-red-100 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur hover:border-red-200/60 hover:text-white"
    >
      Emergency
    </Link>
  );
}
