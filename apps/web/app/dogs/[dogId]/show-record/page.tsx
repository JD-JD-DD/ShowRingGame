import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import DogShowRecordTable from "@/components/dogs/DogShowRecordTable";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getDogProfile, getDogShowRecord } from "@/server/services/dog.service";
import { getKennelForUser } from "@/server/services/kennel.service";

type PageProps = { params: Promise<{ dogId: string }> };

export default async function DogShowRecordPage({ params }: PageProps) {
  const [{ dogId }, userId] = await Promise.all([params, getSessionUserId()]);
  if (!userId) redirect("/login");

  const kennel = await getKennelForUser(userId);
  if (!kennel) redirect("/onboarding");

  const [profile, results] = await Promise.all([
    getDogProfile({ dogId, viewerKennelId: kennel.id, currentEpoch: getCurrentEpoch() }),
    getDogShowRecord({ dogId }),
  ]);
  if (!profile || !results) notFound();

  return (
    <main className="dog-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="dog-label text-xs font-semibold uppercase tracking-[0.18em]">Full show record</div>
            <h1 className="dog-heading mt-2 text-3xl font-bold">{profile.header.displayName}</h1>
            <p className="dog-copy mt-2 text-sm">All published show results, newest first.</p>
          </div>
          <Link href={`/dogs/${dogId}`} className="dog-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold">
            Back to profile
          </Link>
        </div>
        <section className="dog-panel rounded-[28px] p-6">
          <DogShowRecordTable results={results} />
        </section>
      </div>
    </main>
  );
}
