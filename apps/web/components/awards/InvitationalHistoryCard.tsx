import { InvitationalRecognitionBadge } from "@/components/awards/InvitationalRecognitionBadge";
import type { RibbonRoomInvitationalDto } from "@/server/services/ribbonRoom.service";

import {
  getInvitationalRibbonAssetPath,
  INVITATIONAL_STATUS_LABELS,
} from "@/lib/awards/ribbonRoomUi";

type InvitationalHistoryCardProps = {
  record: RibbonRoomInvitationalDto;
};

export function InvitationalHistoryCard({
  record,
}: InvitationalHistoryCardProps) {
  const assetPath = getInvitationalRibbonAssetPath(record.status);
  const label = INVITATIONAL_STATUS_LABELS[record.status];

  return (
    <article className="rounded-2xl border border-[var(--dog-border)] bg-black/20 p-4">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--dog-label)]">
        Year {record.year}, Week {record.week}
      </div>
      <div className="mt-4 flex items-center gap-4">
        {assetPath ? (
          <img
            src={assetPath}
            alt={`${label} invitational ribbon`}
            className="h-24 w-24 shrink-0 object-contain"
          />
        ) : (
          <InvitationalRecognitionBadge label={label} />
        )}
        <div className="min-w-0">
          <div className="text-lg font-semibold text-white">{label}</div>
          <div className="mt-1 text-sm text-[var(--dog-copy)]">
            Invitational Hall record
          </div>
        </div>
      </div>
    </article>
  );
}
