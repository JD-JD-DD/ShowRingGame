import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUserId } from "@/lib/session";

type PageProps = {
  searchParams?: Promise<{
    studListingId?: string | string[];
    sireDogId?: string | string[];
    damDogId?: string | string[];
    source?: string | string[];
  }>;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim();
  return candidate || null;
}

function backHref(args: {
  source: string | null;
  studListingId: string | null;
  damDogId: string | null;
}) {
  if (args.source === "public-stud") return "/studs";
  if (args.source === "plan-a-litter") return "/plan-a-litter";

  if (args.source === "breed-dog") {
    if (args.studListingId) {
      return `/breed?studListingId=${encodeURIComponent(args.studListingId)}`;
    }

    if (args.damDogId) {
      return `/breed?dogId=${encodeURIComponent(args.damDogId)}`;
    }

    return "/breed";
  }

  return "/studs";
}

export default async function StudContractPage({ searchParams }: PageProps) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const backLink = backHref({
    source: firstQueryValue(resolvedSearchParams.source),
    studListingId: firstQueryValue(resolvedSearchParams.studListingId),
    damDogId: firstQueryValue(resolvedSearchParams.damDogId),
  });

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="theme-panel mx-auto max-w-3xl rounded-[28px] px-6 py-8">
        <p className="theme-label text-sm uppercase tracking-[0.22em]">
          Stud Contract
        </p>
        <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">
          Stud Contract
        </h1>
        <div className="theme-status-info mt-5 inline-flex rounded-2xl px-4 py-2 text-sm font-semibold">
          In progress
        </div>
        <p className="theme-copy mt-5 text-sm leading-7">
          Stud contract details will be available here.
        </p>
        <Link
          href={backLink}
          className="theme-secondary-button mt-8 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)]"
        >
          Go Back
        </Link>
      </section>
    </main>
  );
}
