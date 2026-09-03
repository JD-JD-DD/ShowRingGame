import Link from "next/link";
import BulletinBadges from "@/components/bulletin/BulletinBadges";
import SupporterBadge from "@/components/support/SupporterBadge";
import type { SupportPresentationTierValue } from "@/lib/supportPresentation";
import type { KennelPrestigeBadges } from "@/server/services/bulletin.service";

export default function CommunityAuthor({
  kennel,
  badges,
  supporterTier,
  currentKennelId,
  sourceType,
}: {
  kennel: {
    id: string;
    name: string;
    slug: string;
  };
  badges: KennelPrestigeBadges;
  supporterTier: SupportPresentationTierValue | null;
  currentKennelId: string;
  sourceType: string;
}) {
  const canMessagePlayer = sourceType === "PLAYER" && kennel.id !== currentKennelId;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/kennels/${kennel.slug}`}
        className="theme-heading font-semibold underline-offset-4 hover:underline"
      >
        {kennel.name}
      </Link>
      {canMessagePlayer ? (
        <Link
          href={`/inbox/messages/start/${kennel.slug}`}
          className="theme-accent-link text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Message Player
        </Link>
      ) : null}
      <span className="theme-copy text-sm" aria-hidden="true">·</span>
      <BulletinBadges badges={badges} />
      {supporterTier ? <SupporterBadge tier={supporterTier} /> : null}
    </div>
  );
}
