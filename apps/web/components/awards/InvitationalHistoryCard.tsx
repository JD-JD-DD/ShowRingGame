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
    <article className="rounded-[24px] border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(5,10,24,0.46))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
        Year {record.year}, Week {record.week}
      </div>
      <div className="mt-4 flex items-center gap-4 sm:gap-5">
        {assetPath ? (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[18px] bg-black/15 p-2">
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
          <div className="text-lg font-semibold tracking-tight text-white">
            {label}
          </div>
          <div className="mt-1 text-sm leading-6 text-[var(--dog-copy)]">
            Invitational Hall record
          </div>
        </div>
      </div>
    </article>
  );
}
