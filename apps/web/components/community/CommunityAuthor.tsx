import Link from "next/link";
import BulletinBadges from "@/components/bulletin/BulletinBadges";
import type { KennelPrestigeBadges } from "@/server/services/bulletin.service";

export default function CommunityAuthor({
  kennel,
  badges,
}: {
  kennel: {
    name: string;
    slug: string;
    displayName: string | null;
  };
  badges: KennelPrestigeBadges;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/kennels/${kennel.slug}`}
        className="theme-heading font-semibold underline-offset-4 hover:underline"
      >
        {kennel.name}
      </Link>
      {kennel.displayName ? (
        <span className="theme-copy text-sm">· {kennel.displayName}</span>
      ) : null}
      <BulletinBadges badges={badges} />
    </div>
  );
}
