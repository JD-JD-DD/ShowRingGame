import { redirect } from "next/navigation";

import SupportSandboxTestClient from "@/components/test/SupportSandboxTestClient";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { CURRENT_SUPPORT_STATUSES } from "@/server/services/supportSubscription.service";

export default async function SupportSandboxTestPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { name: true, slug: true },
  });
  if (!kennel) redirect("/onboarding");

  const currentSubscription = await (db as any).supportSubscription.findFirst({
    where: { userId, status: { in: CURRENT_SUPPORT_STATUSES } },
    select: {
      currentTier: true,
      status: true,
      providerSubscriptionId: true,
      createdAt: true,
      updatedAt: true,
      endedAt: true,
      firstSupportedAt: true,
    },
  });
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Support Sandbox Test</p>
        <h1 className="theme-heading mt-2 text-3xl font-semibold">Support Sandbox Test</h1>
        <p className="theme-copy mt-2 text-sm">This temporary page creates one Bronze PayPal sandbox subscription for the currently signed-in ShowRing account.</p>
      </header>
      <SupportSandboxTestClient
        kennelName={kennel.name}
        kennelSlug={kennel.slug}
        currentSubscription={currentSubscription ? {
          ...currentSubscription,
          createdAt: currentSubscription.createdAt.toISOString(),
          updatedAt: currentSubscription.updatedAt.toISOString(),
          endedAt: currentSubscription.endedAt?.toISOString() ?? null,
          firstSupportedAt: currentSubscription.firstSupportedAt?.toISOString() ?? null,
        } : null}
      />
    </main>
  );
}
