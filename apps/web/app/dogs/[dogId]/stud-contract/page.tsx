import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import StudOfferWorksheet from "@/components/stud-contract/StudOfferWorksheet";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";

type PageProps = {
  params: Promise<{ dogId: string }>;
};

export default async function StudOfferWorksheetPage({ params }: PageProps) {
  const [{ dogId }, userId] = await Promise.all([params, getSessionUserId()]);

  if (!userId) redirect("/login");

  const kennel = await getKennelForUser(userId);
  if (!kennel) redirect("/onboarding");

  const dog = await db.dog.findFirst({
    where: {
      id: dogId,
      ownerKennelId: kennel.id,
    },
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
    },
  });

  if (!dog) notFound();

  const dogName = dog.registeredName?.trim() || dog.callName?.trim() || dog.regNumber;

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/dogs/${dog.id}`}
          className="theme-secondary-button inline-flex rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Back to Dog
        </Link>
        <StudOfferWorksheet dogName={dogName} />
      </div>
    </main>
  );
}
