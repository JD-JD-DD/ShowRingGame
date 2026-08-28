import { redirect } from "next/navigation";

import SupportSandboxTestClient from "@/components/test/SupportSandboxTestClient";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export default async function SupportSandboxTestPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { name: true, slug: true },
  });
  if (!kennel) redirect("/onboarding");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Support Sandbox Test</p>
        <h1 className="theme-heading mt-2 text-3xl font-semibold">Support Sandbox Test</h1>
        <p className="theme-copy mt-2 text-sm">This temporary page creates one Bronze PayPal sandbox subscription for the currently signed-in ShowRing account.</p>
      </header>
      <SupportSandboxTestClient kennelName={kennel.name} kennelSlug={kennel.slug} />
    </main>
  );
}
