import type { KennelPrestigeBadges } from "@/server/services/bulletin.service";

export default function BulletinBadges({
  badges,
}: {
  badges: KennelPrestigeBadges;
}) {
  const visibleBadges = [
    badges.championCount > 0
      ? `${badges.championCount} champion${badges.championCount === 1 ? "" : "s"}`
      : null,
    badges.dogsAtStudCount > 0
      ? `${badges.dogsAtStudCount} at stud`
      : null,
    badges.dogsForSaleCount > 0
      ? `${badges.dogsForSaleCount} for sale`
      : null,
  ].filter((badge): badge is string => Boolean(badge));

  if (visibleBadges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleBadges.map((badge) => (
        <span
          key={badge}
          className="rounded-full border border-amber-200/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-100"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}
