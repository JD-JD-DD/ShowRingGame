import Link from "next/link";
import { redirect } from "next/navigation";

import KennelDogsPanel from "@/components/kennel/KennelDogsPanel";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export default async function KennelPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  return (
    <main className="kennel-page mx-auto max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
      <section className="theme-card mb-8 rounded-2xl p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-100/75">
          Premium Features
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/plan-a-litter" className="premium-planner-link">
            <span className="premium-planner-link__spark" aria-hidden="true">
              
            </span>
            <span>
              <span className="block text-[0.58rem] font-bold uppercase tracking-[0.2em] text-fuchsia-100/85">
                Advanced Planning Tool
              </span>
              <span className="mt-0.5 block text-sm font-bold tracking-wide text-white">
                Plan A Litter
              </span>
            </span>
          </Link>
          <Link href="/kennel/program-planner" className="premium-planner-link">
            <span className="premium-planner-link__spark" aria-hidden="true">
            </span>
            <span>
              <span className="block text-[0.58rem] font-bold uppercase tracking-[0.2em] text-fuchsia-100/85">
                Kennel Strategy Tool
              </span>
              <span className="mt-0.5 block text-sm font-bold tracking-wide text-white">
                Program Planner
              </span>
            </span>
          </Link>
        </div>
      </section>

      <KennelDogsPanel />
    </main>
  );
}
