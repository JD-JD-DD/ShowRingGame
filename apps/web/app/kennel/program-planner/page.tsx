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
      <section className="theme-panel rounded-[28px] p-6">
        <h1 className="theme-heading text-3xl font-semibold">{UNAVAILABLE_TITLE}</h1>
        <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">
          {UNAVAILABLE_MESSAGE}
        </p>
        <Link
          href="/kennel"
          className="theme-secondary-button mt-6 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold"
        >
          Back to My Kennel
        </Link>
      </section>
    </main>
  );
}
