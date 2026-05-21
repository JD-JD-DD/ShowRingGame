import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import BreedPageClient from "@/components/breeding/BreedPageClient";
import {
  DAM_MAX_BREED_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  WHELPING_COOLDOWN_HOURS,
  deriveVisibleCategoriesFromTraits,
} from "@showring/rules";
import { getCurrentEpoch } from "@/lib/gameClock";

type PageProps = {
  searchParams?: Promise<{
    dogId?: string | string[];
  }>;
};

type VisibleCategories = Record<string, number>;

type DogCardDto = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  breedCode2: string;
  breedName: string;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  lifecycleState: string;
  ownerKennelName: string | null;
  isEligibleToBreed: boolean;
  inBreedingConflict: boolean;
  visibleCategories: VisibleCategories;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function BreedPage({ searchParams }: PageProps) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      balance: true,
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const currentEpoch = getCurrentEpoch();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialDogId = firstQueryValue(resolvedSearchParams.dogId);

  const dogs = await db.dog.findMany({
    where: {
      ownerKennelId: kennel.id,
    },
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      breedCode2: true,
      sex: true,
      birthEpoch: true,
      lifecycleState: true,
      traitHead: true,
      traitForequarters: true,
      traitHindquarters: true,
      traitGait: true,
      traitCoat: true,
      traitSize: true,
      traitTemperament: true,
      traitShowShine: true,
      traitFeet: true,
      traitTopline: true,
      breed: {
        select: {
          name: true,
        },
      },
      ownerKennel: {
        select: {
          name: true,
        },
      },
      breedingAttemptsAsDam: {
        where: {
          OR: [
            {
              status: {
                in: ["INITIATED", "PREGNANT"],
              },
            },
            {
              status: "WHELPED",
              whelpedEpoch: {
                not: null,
                gt: currentEpoch - WHELPING_COOLDOWN_HOURS,
              },
            },
          ],
        },
        orderBy: [{ createdEpoch: "desc" }],
        select: { id: true, status: true },
      },
    },
    orderBy: [{ breedCode2: "asc" }, { birthEpoch: "asc" }],
  });

  const dogCards: DogCardDto[] = dogs.map((dog) => {
    const ageHours = currentEpoch - dog.birthEpoch;
    const alive = dog.lifecycleState === "ALIVE";
    const oldEnough = ageHours >= MIN_BREED_AGE_HOURS;
    const notTooOldIfFemale =
      dog.sex === "F" ? ageHours <= DAM_MAX_BREED_AGE_HOURS : true;
    const inBreedingConflict =
      dog.sex === "F" && dog.breedingAttemptsAsDam.length > 0;

    return {
      id: dog.id,
      callName: dog.callName,
      registeredName: dog.registeredName,
      regNumber: dog.regNumber,
      breedCode2: dog.breedCode2,
      breedName: dog.breed.name,
      sex: dog.sex,
      birthEpoch: dog.birthEpoch,
      ageHours,
      lifecycleState: dog.lifecycleState,
      ownerKennelName: dog.ownerKennel?.name ?? null,
      isEligibleToBreed: alive && oldEnough && notTooOldIfFemale && !inBreedingConflict,
      inBreedingConflict,
      visibleCategories: deriveVisibleCategoriesFromTraits({
        head: dog.traitHead,
        forequarters: dog.traitForequarters,
        hindquarters: dog.traitHindquarters,
        gait: dog.traitGait,
        coat: dog.traitCoat,
        size: dog.traitSize,
        temperament: dog.traitTemperament,
        show_shine: dog.traitShowShine,
        feet: dog.traitFeet,
        topline: dog.traitTopline,
      }),
    };
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-purple-300/80">
            Breeding
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Plan a Breeding
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
            Select two eligible dogs you own. Breedings must be same-breed,
            opposite-sex pairings, and the dam cannot already be in a conflicting
            breeding state.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/kennel"
            className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Back to My Kennel
          </Link>

          <div className="rounded-2xl border border-purple-300/15 bg-white/5 px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              Kennel Balance
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              ${kennel.balance.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <BreedPageClient
        kennelId={kennel.id}
        kennelName={kennel.name}
        kennelBalance={kennel.balance}
        dogs={dogCards}
        initialDogId={initialDogId}
      />

      <div className="mt-8">
        <Link
          href="/kennel"
          className="text-sm font-medium text-purple-200 transition hover:text-white"
        >
          ← Back to Kennel
        </Link>
      </div>
    </main>
  );
}
