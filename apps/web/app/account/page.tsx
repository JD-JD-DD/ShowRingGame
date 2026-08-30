import { redirect } from "next/navigation";

import KennelNameSettingsSection from "@/components/account/KennelNameSettingsSection";
import SupporterBadgePreference from "@/components/account/SupporterBadgePreference";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getSupporterBadgePresentation } from "@/lib/supporterBadgePresentation";
import { getCanonicalSupportSubscription } from "@/server/services/supportSubscription.service";

type AccountPageProps = {
  searchParams: Promise<{
    renamed?: string;
  }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      showSupporterBadge: true,
      renameHistory: {
        orderBy: {
          changedAt: "desc",
        },
        take: 1,
        select: {
          previousName: true,
          source: true,
        },
      },
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }
  const support = await getCanonicalSupportSubscription({ userId });
  const badge = getSupporterBadgePresentation({ tier: support?.currentTier, status: support?.status, showSupporterBadge: kennel.showSupporterBadge, currentPaidPeriodEnd: support?.currentPaidPeriodEnd });

  const selfServiceRename = await db.kennelRenameHistory.findFirst({
    where: {
      kennelId: kennel.id,
      source: "SELF_SERVICE",
    },
    select: {
      id: true,
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
          Account Settings
        </p>
        <h1 className="theme-heading mt-2 text-3xl font-semibold">Account</h1>
        <p className="theme-copy mt-2 max-w-2xl text-sm">
          Manage player-facing account details that stay attached to your
          existing kennel record.
        </p>
      </header>

      <KennelNameSettingsSection
        currentName={kennel.name}
        currentSlug={kennel.slug}
        previousName={kennel.renameHistory[0]?.previousName ?? null}
        hasUsedSelfServiceRename={Boolean(selfServiceRename)}
        initialSuccess={resolvedSearchParams.renamed === "1"}
      />
      <SupporterBadgePreference initialValue={kennel.showSupporterBadge} previewTier={badge.visible ? badge.tier : null} />
    </main>
  );
}
