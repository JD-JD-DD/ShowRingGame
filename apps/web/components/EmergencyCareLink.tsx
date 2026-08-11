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

  const ordinaryEmergencies = await db.dogEmergencyCareEvent.findMany({
    where: {
      status: "PENDING",
      dog: {
        ownerKennelId: kennel.id,
      },
    },
    orderBy: [{ createdAtEpoch: "asc" }, { createdAt: "asc" }],
    take: 2,
    select: {
      id: true,
      dogId: true,
      createdAtEpoch: true,
      responseDeadlineEpoch: true,
    },
  });
  const reproductiveEmergencies = await db.reproductiveEmergencyEvent.findMany({
        where: { status: { in: ["PENDING", "TREATMENT_AUTHORIZED", "TREATMENT_DECLINED"] }, dam: { ownerKennelId: kennel.id } },
        orderBy: [{ responseDeadlineEpoch: "asc" }, { createdAtEpoch: "asc" }],
        take: 2,
        select: { id: true, damId: true, createdAtEpoch: true, responseDeadlineEpoch: true },
      });
  const pendingEmergencies = [
    ...ordinaryEmergencies.map((event) => ({
      id: event.id, dogId: event.dogId, createdAtEpoch: event.createdAtEpoch,
      responseDeadlineEpoch: event.responseDeadlineEpoch, href: `/dogs/${event.dogId}`,
    })),
    ...reproductiveEmergencies.map((event) => ({
      id: event.id, dogId: event.damId, createdAtEpoch: event.createdAtEpoch,
      responseDeadlineEpoch: event.responseDeadlineEpoch, href: `/dogs/${event.damId}#whelping-emergency`,
    })),
  ].sort((left, right) =>
    left.responseDeadlineEpoch - right.responseDeadlineEpoch ||
    left.createdAtEpoch - right.createdAtEpoch || left.id.localeCompare(right.id)
  );

  if (pendingEmergencies.length === 0) {
    return null;
  }

  // TODO: Link multiple pending emergencies to a dedicated emergency list page.
  return (
    <Link
      href={pendingEmergencies[0].href}
      className="game-header__emergency fixed right-4 top-[7.55rem] z-50 rounded-2xl px-3 py-1.5 text-right text-[11px] font-bold leading-4 backdrop-blur"
    >
      Emergency
    </Link>
  );
}
