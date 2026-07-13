import { redirect } from "next/navigation";

import KennelNameSettingsSection from "@/components/account/KennelNameSettingsSection";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-100/75">
          Account Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Account</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--dog-copy)]">
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
    </main>
  );
}
