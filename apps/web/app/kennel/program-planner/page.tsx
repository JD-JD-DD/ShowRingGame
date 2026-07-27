import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";

const UNAVAILABLE_TITLE = "Program Planner Temporarily Unavailable";
const UNAVAILABLE_MESSAGE =
  "The Program Planner is being updated to support upcoming kennel-management systems. It will return after this work is complete.";

export default async function ProgramPlannerPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await getKennelForUser(userId);

  if (!kennel) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <section className="rounded-[28px] border border-fuchsia-300/20 bg-[var(--dog-panel)] p-6 text-white shadow-[var(--dog-shadow)]">
        <h1 className="text-3xl font-semibold">{UNAVAILABLE_TITLE}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--dog-copy)]">
          {UNAVAILABLE_MESSAGE}
        </p>
        <Link
          href="/kennel"
          className="mt-6 inline-flex rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-5 py-3 text-sm font-semibold text-[var(--dog-heading)] transition hover:bg-[var(--dog-card)]"
        >
          Back to My Kennel
        </Link>
      </section>
    </main>
  );
}
