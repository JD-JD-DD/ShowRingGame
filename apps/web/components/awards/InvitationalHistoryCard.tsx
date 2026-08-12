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
    <article className="theme-card rounded-[24px] p-4">
      <div className="theme-label text-[0.68rem] font-semibold uppercase tracking-[0.18em]">
        Year {record.year}, Week {record.week}
      </div>
      <div className="mt-4 flex items-center gap-4 sm:gap-5">
        {assetPath ? (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-surface-inset)] p-2">
            <img
              src={assetPath}
              alt={`${label} invitational ribbon`}
              className="h-24 w-24 shrink-0 object-contain"
            />
          </div>
        ) : (
          <InvitationalRecognitionBadge label={label} />
        )}
        <div className="min-w-0">
          <div className="theme-heading text-lg font-semibold tracking-tight">
            {label}
          </div>
          <div className="theme-copy mt-1 text-sm leading-6">
            Invitational Hall record
          </div>
        </div>
      </div>
    </article>
  );
}
