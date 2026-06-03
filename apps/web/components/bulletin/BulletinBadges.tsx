import type { KennelPrestigeBadges } from "@/server/services/bulletin.service";

export default function BulletinBadges({
  badges,
}: {
  badges: KennelPrestigeBadges;
}) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100/70">
      {badges.prestigeRank}
    </div>
  );
}
