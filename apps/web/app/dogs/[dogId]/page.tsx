import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import {
  getPhenotypeHealthBadgeStatus,
  hasAllGreenPhenotypeHealthTests,
  isGreenPhenotypeHealthResult,
} from "@/lib/dogHealth";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import { getStoredProducerMeritForDog } from "@/server/services/producerMerit.service";
import {
  DAM_MAX_BREED_AGE_HOURS,
  MAX_SHOW_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  PUPPY_SALE_MIN_AGE_HOURS,
  WHELPING_COOLDOWN_HOURS,
  deriveConditioningHandlingScore,
  deriveVisibleCategoriesFromTraits,
  getPuppyRehomePayoutForAgeHours,
  getPhenotypeHealthResultLabel,
  getShowDistrictRegionName,
  type PhenotypeHealthTestCode,
} from "@showring/rules";
import ManageDogListingForm from "@/components/dogs/ManageDogListingForm";
import ManageDogStudListingForm from "@/components/dogs/ManageDogStudListingForm";
import DogPrivateNotesEditor from "@/components/dogs/DogPrivateNotesEditor";
import CollapsibleDogSection from "@/components/dogs/CollapsibleDogSection";
import DogStatusBadges from "@/components/dogs/DogStatusBadges";
import HealthTestingPanel from "@/components/dogs/HealthTestingPanel";
import OfferDogAtStudForm from "@/components/dogs/OfferDogAtStudForm";
import OfferDogForSaleForm from "@/components/dogs/OfferDogForSaleForm";
import RegisterDogNameForm from "@/components/dogs/RegisterDogNameForm";
import RehomeDogForm from "@/components/dogs/RehomeDogForm";
import CancelGroomingListingForm from "@/components/dogs/CancelGroomingListingForm";
import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
import TraitLine from "@/components/ui/TraitLine";
import {
  getKennelGroomingSummary,
  getOwnedDogGroomingStatuses,
} from "@/server/services/grooming.service";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";

const CHAMPIONSHIP_POINTS_REQUIRED = 15;
const CHAMPIONSHIP_MAJORS_REQUIRED = 2;
const INVITATIONAL_PLACEMENT_CODES = ["BIS", "RBIS", "G1", "G2", "G3", "G4"];
const DOG_PANEL_CLASS = "dog-panel rounded-[28px] p-6";
const DOG_CARD_CLASS = "dog-card rounded-2xl px-4 py-3";

type PageProps = {
  params: Promise<{
    dogId: string;
  }>;
  searchParams?: Promise<{
    areaId?: string | string[];
    nameError?: string | string[];
    saleError?: string | string[];
    saleMessage?: string | string[];
    error?: string | string[];
    message?: string | string[];
    healthError?: string | string[];
    healthMessage?: string | string[];
    notesError?: string | string[];
    notesMessage?: string | string[];
    showError?: string | string[];
    showMessage?: string | string[];
  }>;
};

function formatAge(ageHours: number): string {
  const weeks = Math.floor(ageHours / 7);
  const years = Math.floor(weeks / 52);

  if (years >= 1) {
    const remainingWeeks = weeks % 52;
    return remainingWeeks > 0 ? `${years}y ${remainingWeeks}w` : `${years}y`;
  }

  return `${weeks}w`;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatPlannerTagType(tagType: string): string {
  switch (tagType) {
    case "KEEP":
      return "Keep";
    case "WATCH":
      return "Watch";
    case "SELL_CANDIDATE":
      return "Sell Candidate";
    case "REHOME_CANDIDATE":
      return "Re-home Candidate";
    case "NO_ACTION":
      return "No Action";
    default:
      return tagType;
  }
}

function formatCondition(value: number): string {
  return value.toFixed(2);
}

function formatSignedCondition(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatListingType(listingType: string): string {
  if (listingType === PLAYER_SALE_LISTING_TYPE) return "For Sale";
  if (listingType === PLAYER_STUD_LISTING_TYPE) return "At Stud";
  return listingType;
}

function formatSireHistoryStatus(status: string): string {
  switch (status) {
    case "INITIATED":
      return "Awaiting pregnancy check";
    case "CHECKED_NOT_PREGNANT":
      return "Did not take";
    case "PREGNANT":
      return "Pregnant";
    case "WHELPED":
      return "Whelped";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function sortShowAwards<
  T extends {
    awardCode: string;
    awardGroup: string;
    rank: number | null;
    pointsAwarded: number;
  },
>(awards: T[]): T[] {
  const awardOrder: Record<string, number> = {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    WD: 5,
    WB: 5,
    RWD: 6,
    RWB: 6,
    BOW: 7,
    BOB: 8,
    BOS: 9,
    AOM: 10,
    G1: 11,
    G2: 12,
    G3: 13,
    G4: 14,
    BIS: 15,
    RBIS: 16,
  };

  return [...awards].sort((a, b) => {
    const orderDifference =
      (awardOrder[a.awardCode] ?? 99) - (awardOrder[b.awardCode] ?? 99);

    if (orderDifference !== 0) return orderDifference;

    return (a.rank ?? 99) - (b.rank ?? 99);
  });
}

type ChampionshipPointWin = {
  showDayId: string;
  awardCode: string;
  pointsAwarded: number;
  isMajor: boolean;
};

type PedigreeDog = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  sireId: string | null;
  damId: string | null;
  healthTests: Array<{
    testTypeCode: string;
    resultCode: string;
  }>;
};

type PedigreeHealthSeverity = "green" | "yellow" | "red";

type PedigreeHealthSummary = {
  label: string;
  severity: PedigreeHealthSeverity;
};

type AreaNavigationDog = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
};

const PEDIGREE_HEALTH_SEVERITY_STYLES: Record<
  PedigreeHealthSeverity,
  { line: string; circle: string; text: string }
> = {
  green: {
    line: "border-emerald-300/70 text-emerald-100",
    circle: "border-emerald-300/45 bg-emerald-500/20 text-emerald-100",
    text: "text-emerald-100",
  },
  yellow: {
    line: "border-amber-300/70 text-amber-100",
    circle: "border-amber-300/45 bg-amber-500/20 text-amber-100",
    text: "text-amber-100",
  },
  red: {
    line: "border-red-400 text-red-300 font-bold",
    circle: "border-red-400/80 bg-red-500/35 text-red-100 font-extrabold",
    text: "text-red-300 font-extrabold",
  },
};

function getPedigreeHealthSummary(
  testTypeCode: string,
  resultCode: string
): PedigreeHealthSummary {
  switch (testTypeCode) {
    case "HIP_DYSPLASIA":
      return {
        label: `Hips ${resultCode}`,
        severity:
          isGreenPhenotypeHealthResult(testTypeCode, resultCode)
            ? "green"
            : resultCode === "BORDERLINE"
              ? "yellow"
              : "red",
      };
    case "CARDIAC":
      return {
        label: `Cardiac ${resultCode}`,
        severity:
          isGreenPhenotypeHealthResult(testTypeCode, resultCode)
            ? "green"
            : resultCode === "EQUIVOCAL"
              ? "yellow"
              : "red",
      };
    case "CAER_EYE":
      return {
        label:
          resultCode === "NORMAL"
            ? "CAER CLEAR"
            : `CAER ${resultCode.replace(/_/g, " ")}`,
        severity:
          isGreenPhenotypeHealthResult(testTypeCode, resultCode)
            ? "green"
            : resultCode === "BREEDER_OPTION"
              ? "yellow"
              : "red",
      };
    case "THYROID":
      return {
        label: `Thyroid ${resultCode.replace(/_/g, " ")}`,
        severity:
          isGreenPhenotypeHealthResult(testTypeCode, resultCode)
            ? "green"
            : resultCode === "EQUIVOCAL"
              ? "yellow"
              : "red",
      };
    default:
      return {
        label: `${testTypeCode.replace(/_/g, " ")} ${resultCode.replace(/_/g, " ")}`,
        severity: "yellow",
      };
  }
}

function getChampionshipPointWins(value: unknown): ChampionshipPointWin[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray(
      (value as { championshipPointWins?: unknown }).championshipPointWins
    )
  ) {
    return [];
  }

  return (value as { championshipPointWins: unknown[] }).championshipPointWins
    .filter(
      (win): win is ChampionshipPointWin =>
        typeof win === "object" &&
        win !== null &&
        typeof (win as ChampionshipPointWin).showDayId === "string" &&
        typeof (win as ChampionshipPointWin).awardCode === "string" &&
        typeof (win as ChampionshipPointWin).pointsAwarded === "number" &&
        typeof (win as ChampionshipPointWin).isMajor === "boolean"
    )
    .slice(-5)
    .reverse();
}

async function getPedigreeAncestors(rootDog: {
  sireId: string | null;
  damId: string | null;
}): Promise<Map<string, PedigreeDog>> {
  const ancestors = new Map<string, PedigreeDog>();
  let dogIds = [rootDog.sireId, rootDog.damId].filter(
    (dogId): dogId is string => Boolean(dogId)
  );

  for (let generation = 0; generation < 4 && dogIds.length > 0; generation += 1) {
    const dogs = await db.dog.findMany({
      where: {
        id: {
          in: [...new Set(dogIds)],
        },
      },
      select: {
        id: true,
        callName: true,
        registeredName: true,
        regNumber: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
        sireId: true,
        damId: true,
        healthTests: {
          where: {
            isPublic: true,
          },
          orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
          select: {
            testTypeCode: true,
            resultCode: true,
          },
        },
      },
    });

    for (const dog of dogs) {
      ancestors.set(dog.id, dog);
    }

    dogIds = dogs
      .flatMap((dog) => [dog.sireId, dog.damId])
      .filter((dogId): dogId is string => Boolean(dogId));
  }

  return ancestors;
}

function getPedigreeParent(
  ancestors: Map<string, PedigreeDog>,
  dog: { sireId: string | null; damId: string | null } | null | undefined,
  parent: "sireId" | "damId"
): PedigreeDog | null {
  const dogId = dog?.[parent];

  return dogId ? ancestors.get(dogId) ?? null : null;
}

function PedigreeCard({
  dog,
  relationship,
  column,
  rowStart,
  rowSpan,
  compactHealth = false,
}: {
  dog: PedigreeDog | null;
  relationship: string;
  column: number;
  rowStart: number;
  rowSpan: number;
  compactHealth?: boolean;
}) {
  const useCompactHealth = compactHealth || column >= 3;
  const latestHealthTests = dog
    ? PHENOTYPE_HEALTH_TEST_CODES.flatMap((testTypeCode) => {
        const latestResult = dog.healthTests.find(
          (test) => test.testTypeCode === testTypeCode
        );

        return latestResult ? [latestResult] : [];
      })
    : [];
  const healthResults = latestHealthTests.map((test) =>
    getPedigreeHealthSummary(test.testTypeCode, test.resultCode)
  );
  const healthBadgeStatus = dog
    ? getPhenotypeHealthBadgeStatus(dog.healthTests)
    : null;
  const fullHealthClearance = dog
    ? hasAllGreenPhenotypeHealthTests(dog.healthTests)
    : false;
  const healthCounts = healthResults.reduce(
    (counts, result) => ({
      ...counts,
      [result.severity]: counts[result.severity] + 1,
    }),
    { red: 0, yellow: 0, green: 0 }
  );
  const className =
    "dog-card-interactive flex min-h-0 flex-col justify-center rounded-2xl px-3 py-2";
  const content = (
    <>
      <div className="dog-label text-[0.62rem] font-semibold uppercase tracking-[0.14em]">
        {relationship}
      </div>
      <div className="dog-heading mt-1 flex items-center gap-1.5 text-sm font-semibold leading-tight">
        <span>{dog ? formatDogDisplayName(dog) : "Unknown"}</span>
        <DogStatusBadges
          healthStatus={healthBadgeStatus}
          fullHealthClearance={fullHealthClearance}
        />
      </div>
      {dog ? (
        <div className="dog-copy mt-1 truncate text-[0.68rem]">
          {dog.regNumber}
        </div>
      ) : null}
      <div className="dog-copy mt-2 text-[0.65rem]">
        <span>Color: Pending</span>
        {healthResults.length === 0 ? (
          <span className="ml-3">Health: Not tested</span>
        ) : useCompactHealth ? (
          <div className="mt-1 flex gap-1.5" aria-label="Health test result summary">
            {(["red", "yellow", "green"] as const).map((severity) =>
              healthCounts[severity] > 0 ? (
                <span
                  key={severity}
                  title={`${healthCounts[severity]} ${severity} health result${healthCounts[severity] === 1 ? "" : "s"}`}
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[0.6rem] font-bold ${PEDIGREE_HEALTH_SEVERITY_STYLES[severity].circle}`}
                >
                  {healthCounts[severity]}
                </span>
              ) : null
            )}
          </div>
        ) : (
          <div className="mt-1 space-y-0.5">
            {healthResults.map((result) => (
              <div
                key={result.label}
                className={`border-l-2 pl-1.5 font-semibold uppercase leading-tight ${PEDIGREE_HEALTH_SEVERITY_STYLES[result.severity].line}`}
              >
                {result.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
  const style = {
    gridColumn: column,
    gridRow: `${rowStart} / span ${rowSpan}`,
  };

  return dog ? (
    <Link
      href={`/dogs/${dog.id}`}
      style={style}
      className={className}
    >
      {content}
    </Link>
  ) : (
    <div style={style} className={`${className} border-dashed opacity-65`}>
      {content}
    </div>
  );
}

export default async function DogPage({ params, searchParams }: PageProps) {
  const { dogId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const areaId = firstQueryValue(resolvedSearchParams.areaId);
  const nameError = firstQueryValue(resolvedSearchParams.nameError);
  const saleError = firstQueryValue(resolvedSearchParams.saleError);
  const saleMessage = firstQueryValue(resolvedSearchParams.saleMessage);
  const groomingError = firstQueryValue(resolvedSearchParams.error);
  const groomingMessage = firstQueryValue(resolvedSearchParams.message);
  const healthError = firstQueryValue(resolvedSearchParams.healthError);
  const healthMessage = firstQueryValue(resolvedSearchParams.healthMessage);
  const notesError = firstQueryValue(resolvedSearchParams.notesError);
  const notesMessage = firstQueryValue(resolvedSearchParams.notesMessage);
  const showError = firstQueryValue(resolvedSearchParams.showError);
  const showMessage = firstQueryValue(resolvedSearchParams.showMessage);
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const currentEpoch = getCurrentEpoch();

  const currentKennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      balance: true,
      homeDistrict: true,
    },
  });

  if (!currentKennel) {
    redirect("/onboarding");
  }

  await resolveDogDeaths({ currentEpoch, dogIds: [dogId] });

  const dog = await db.dog.findUnique({
    where: { id: dogId },
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      breedCode2: true,
      sex: true,
      birthEpoch: true,
      deathEpoch: true,
      lifecycleState: true,
      visibilityState: true,
      isPlayerVisible: true,
      showInMemoriam: true,
      marketState: true,
      originType: true,
      isFoundation: true,
      sireId: true,
      damId: true,
      coiPercent: true,
      coiGenerationDepth: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      titleProgress: {
        select: {
          championshipPoints: true,
          majorCount: true,
          currentTitleCode: true,
          winsByTypeJson: true,
        },
      },
      healthTests: {
        where: {
          isPublic: true,
        },
        orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          testTypeCode: true,
          resultCode: true,
          testedAtEpoch: true,
          revealedAtEpoch: true,
        },
      },
      privateKennelNotes: currentKennel
        ? {
            where: {
              kennelId: currentKennel.id,
            },
            select: {
              notes: true,
            },
            take: 1,
          }
        : false,
      plannerTags: currentKennel
        ? {
            where: {
              kennelId: currentKennel.id,
              source: "PROGRAM_PLANNER",
              isVisibleOnDogPage: true,
            },
            select: {
              tagType: true,
              goalKey: true,
              note: true,
              updatedAt: true,
            },
            orderBy: [{ updatedAt: "desc" }],
          }
        : false,
      ringObedience: true,
      muscleTone: true,
      coatCondition: true,
      fatiguePoints: true,
      breed: {
        select: {
          name: true,
          code2: true,
        },
      },
      ownerKennel: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      breederKennel: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      sireOf: {
        where: {
          isPlayerVisible: true,
        },
        orderBy: [{ birthEpoch: "desc" }, { regNumber: "asc" }],
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
          sex: true,
        },
      },
      damOf: {
        where: {
          isPlayerVisible: true,
        },
        orderBy: [{ birthEpoch: "desc" }, { regNumber: "asc" }],
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
          sex: true,
        },
      },
      showResults: {
        orderBy: [{ publishedAtEpoch: "desc" }, { finalRank: "asc" }],
        select: {
          id: true,
          finalRank: true,
          placementCode: true,
          pointsAwarded: true,
          isMajor: true,
          breed: {
            select: {
              name: true,
              code2: true,
            },
          },
          judge: {
            select: {
              judgeCode: true,
              name: true,
            },
          },
          showDay: {
            select: {
              dayIndex: true,
              scheduledEpoch: true,
              cluster: {
                select: {
                  id: true,
                  name: true,
                  district: true,
                },
              },
            },
          },
          showAwards: {
            select: {
              awardCode: true,
              awardGroup: true,
              rank: true,
              pointsAwarded: true,
              isMajor: true,
            },
          },
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
        select: {
          id: true,
        },
      },
      showAwards: {
        where: {
          awardCode: {
            in: INVITATIONAL_PLACEMENT_CODES,
          },
          showDay: {
            cluster: {
              id: {
                startsWith: "invitational-year-",
              },
            },
          },
        },
        orderBy: [{ publishedAtEpoch: "desc" }],
        select: {
          awardCode: true,
          showDay: {
            select: {
              cluster: {
                select: {
                  id: true,
                  year: true,
                },
              },
            },
          },
        },
      },
      breedingAttemptsAsSire: {
        orderBy: [{ createdEpoch: "desc" }],
        select: {
          id: true,
          createdEpoch: true,
          status: true,
          litterId: true,
          createdByKennel: {
            select: {
              name: true,
              slug: true,
            },
          },
          dam: {
            select: {
              id: true,
              callName: true,
              registeredName: true,
              regNumber: true,
              visibleTitlePrefix: true,
              visibleTitleSuffix: true,
            },
          },
        },
      },
      listings: {
        where: {
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          askingPrice: true,
          sellerType: true,
          descriptionPublic: true,
          listingType: true,
        },
      },
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
    },
  });

  if (!dog) {
    notFound();
  }

  if (!dog.isPlayerVisible) {
    notFound();
  }

  let areaNavigation:
    | {
        previous: AreaNavigationDog | null;
        next: AreaNavigationDog | null;
        areaId: string;
      }
    | null = null;

  if (areaId && dog.ownerKennel?.id === currentKennel.id) {
    const kennelArea = await db.kennelArea.findFirst({
      where: {
        id: areaId,
        kennelId: currentKennel.id,
      },
      select: {
        id: true,
      },
    });

    if (kennelArea) {
      const areaDogs = await db.dog.findMany({
        where: {
          ownerKennelId: currentKennel.id,
          lifecycleState: "ALIVE",
          isPlayerVisible: true,
          kennelAreaMemberships: {
            some: {
              kennelAreaId: kennelArea.id,
            },
          },
        },
        orderBy: [
          {
            breed: {
              name: "asc",
            },
          },
          { birthEpoch: "desc" },
          { regNumber: "asc" },
        ],
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
        },
      });

      const currentIndex = areaDogs.findIndex((candidate) => candidate.id === dog.id);
      const previousDog = currentIndex > 0 ? areaDogs[currentIndex - 1] : null;
      const nextDog =
        currentIndex < areaDogs.length - 1 ? areaDogs[currentIndex + 1] : null;

      if (currentIndex >= 0) {
        areaNavigation = {
          previous: previousDog,
          next: nextDog,
          areaId: kennelArea.id,
        };
      }
    }
  }

  const pedigreeAncestors = await getPedigreeAncestors(dog);
  const pedigreeSire = getPedigreeParent(pedigreeAncestors, dog, "sireId");
  const pedigreeDam = getPedigreeParent(pedigreeAncestors, dog, "damId");
  const pedigreeSireSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSire,
    "sireId"
  );
  const pedigreeSireDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSire,
    "damId"
  );
  const pedigreeDamSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDam,
    "sireId"
  );
  const pedigreeDamDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDam,
    "damId"
  );
  const pedigreeSireSireSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSireSire,
    "sireId"
  );
  const pedigreeSireSireDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSireSire,
    "damId"
  );
  const pedigreeSireDamSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSireDam,
    "sireId"
  );
  const pedigreeSireDamDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeSireDam,
    "damId"
  );
  const pedigreeDamSireSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDamSire,
    "sireId"
  );
  const pedigreeDamSireDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDamSire,
    "damId"
  );
  const pedigreeDamDamSire = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDamDam,
    "sireId"
  );
  const pedigreeDamDamDam = getPedigreeParent(
    pedigreeAncestors,
    pedigreeDamDam,
    "damId"
  );
  const ageHours = Math.max(0, currentEpoch - dog.birthEpoch);
  const rehomePayout = getPuppyRehomePayoutForAgeHours(ageHours);

  const visibleCategories = {
    ...deriveVisibleCategoriesFromTraits({
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
    conditioningHandling: deriveConditioningHandlingScore({
      coatCondition: dog.coatCondition,
      muscleTone: dog.muscleTone,
      ringObedience: dog.ringObedience,
      fatiguePoints: dog.fatiguePoints,
    }),
  };

  const isOwnedByCurrentKennel = dog.ownerKennel?.id === currentKennel.id;
  const [groomingSummary, groomingStatusMap] = isOwnedByCurrentKennel
    ? await Promise.all([
        getKennelGroomingSummary({
          kennelId: currentKennel.id,
          currentEpoch,
        }),
        getOwnedDogGroomingStatuses({
          kennelId: currentKennel.id,
          dogIds: [dog.id],
          currentEpoch,
        }),
      ])
    : [null, new Map()];
  const groomingStatus = groomingStatusMap.get(dog.id) ?? {
    dogId: dog.id,
    groomedThisWeek: false,
    listedForGrooming: false,
    openListingId: null,
    currentCoatCondition: dog.coatCondition,
    totalGroomingGain: 0,
    totalGroomingDecay: 0,
    netGroomingImpact: 0,
    lastGroomedEpoch: null,
    currentGroomingWeek: 0,
    groomingStatusLabel: "Needs grooming" as const,
  };
  const groomingActionsRemaining =
    groomingSummary?.groomingActionsRemainingThisWeek ?? 0;
  const noGroomingActionsRemaining = groomingActionsRemaining <= 0;
  const upcomingShowEntries = isOwnedByCurrentKennel
    ? await db.showEntry.findMany({
        where: {
          dogId: dog.id,
          entryStatus: {
            in: ["ENTERED", "ABSENT"],
          },
          showDay: {
            scheduledEpoch: {
              gt: currentEpoch,
            },
          },
        },
        orderBy: [{ showDay: { scheduledEpoch: "desc" } }],
        select: {
          id: true,
          entryStatus: true,
          breed: {
            select: {
              name: true,
            },
          },
          showDay: {
            select: {
              dayIndex: true,
              scheduledEpoch: true,
              judge: {
                select: {
                  judgeCode: true,
                  name: true,
                },
              },
              cluster: {
                select: {
                  id: true,
                  name: true,
                  district: true,
                },
              },
            },
          },
        },
      })
    : [];
  const activeSaleListing =
    dog.listings.find(
      (listing) => listing.listingType === PLAYER_SALE_LISTING_TYPE
    ) ?? null;
  const activeStudListing =
    dog.listings.find(
      (listing) => listing.listingType === PLAYER_STUD_LISTING_TYPE
    ) ?? null;
  const activeListing =
    activeSaleListing ?? activeStudListing ?? dog.listings[0] ?? null;
  const isAlive = dog.lifecycleState === "ALIVE";
  const isListedForSale =
    !!activeSaleListing &&
    (dog.marketState === "LISTED_NPC" || dog.marketState === "LISTED_PLAYER");
  const canBuyActiveListing =
    isListedForSale && isAlive && !isOwnedByCurrentKennel;
  const canUseActiveStudListing =
    !!activeStudListing && isAlive && dog.sex === "M" && !isOwnedByCurrentKennel;

  const canBreed =
    isOwnedByCurrentKennel &&
    isAlive &&
    ageHours >= MIN_BREED_AGE_HOURS &&
    (dog.sex === "M" ||
      (ageHours <= DAM_MAX_BREED_AGE_HOURS &&
        dog.breedingAttemptsAsDam.length === 0));

  const displayName = formatDogDisplayName(dog);
  const producerMerit = await getStoredProducerMeritForDog({ dogId: dog.id });
  const producerRecord = producerMerit ?? {
    championOffspringCount: 0,
    producerMeritLabel: null,
    producerMeritSuffix: null,
    producerMeritLevel: "NONE" as const,
    nextMeritLabel: dog.sex === "M" ? "Sire of Merit" : "Dam of Merit",
    nextMeritThreshold: dog.sex === "M" ? 10 : 5,
  };
  const dogPageReturnTo = `/dogs/${dog.id}${areaId ? `?areaId=${encodeURIComponent(areaId)}` : ""}`;
  const canNameDog = isOwnedByCurrentKennel && !dog.registeredName?.trim();
  const canOfferForSale =
    isOwnedByCurrentKennel &&
    isAlive &&
    ageHours >= PUPPY_SALE_MIN_AGE_HOURS &&
    dog.marketState === "NOT_FOR_SALE" &&
    !activeListing;
  const canOfferAtStud =
    isOwnedByCurrentKennel &&
    isAlive &&
    dog.sex === "M" &&
    ageHours >= MIN_BREED_AGE_HOURS &&
    dog.marketState === "NOT_FOR_SALE" &&
    !activeListing;

  const categoryEntries = Object.entries(visibleCategories);
  const progeny = dog.sex === "M" ? dog.sireOf : dog.damOf;
  const showResults = dog.showResults;
  const totalShowPoints = showResults.reduce(
    (total, result) => total + result.pointsAwarded,
    0
  );
  const championshipPoints = dog.titleProgress?.championshipPoints ?? 0;
  const majorCount = dog.titleProgress?.majorCount ?? 0;
  const currentTitleCode = dog.titleProgress?.currentTitleCode ?? null;
  const pointsNeeded = Math.max(
    0,
    CHAMPIONSHIP_POINTS_REQUIRED - championshipPoints
  );
  const majorsNeeded = Math.max(0, CHAMPIONSHIP_MAJORS_REQUIRED - majorCount);
  const championshipPointWins = getChampionshipPointWins(
    dog.titleProgress?.winsByTypeJson
  );
  const invitationalPlacementTags = dog.showAwards;
  const completedHealthTestCodes = new Set(
    dog.healthTests.map((test) => test.testTypeCode)
  );
  const healthTestRows = PHENOTYPE_HEALTH_TEST_CODES.map((testTypeCode) => {
    const latestResult =
      dog.healthTests.find((test) => test.testTypeCode === testTypeCode) ?? null;
    const definition = PHENOTYPE_HEALTH_TESTS[testTypeCode];

    return {
      testTypeCode,
      definition,
      latestResult,
      isAvailable: ageHours >= definition.minimumAgeHours,
      severity: latestResult
        ? getPedigreeHealthSummary(testTypeCode, latestResult.resultCode).severity
        : null,
    };
  });
  const healthBadgeStatus = getPhenotypeHealthBadgeStatus(dog.healthTests);
  const fullHealthClearance = hasAllGreenPhenotypeHealthTests(dog.healthTests);
  const canOrderHealthTests = isOwnedByCurrentKennel && isAlive;

  return (
    <main className="dog-page min-h-screen px-6 py-8">
      {areaNavigation?.previous ? (
        <Link
          href={{
            pathname: `/dogs/${areaNavigation.previous.id}`,
            query: { areaId: areaNavigation.areaId },
          }}
        className="dog-secondary-button fixed left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-2xl px-3 py-4 text-center text-[0.7rem] font-semibold uppercase tracking-[0.18em] shadow-lg lg:flex lg:flex-col lg:items-center"
        >
          <span className="dog-heading text-lg leading-none">&lt;</span>
          <span>Prev</span>
          <span>Dog</span>
        </Link>
      ) : null}

      {areaNavigation?.next ? (
        <Link
          href={{
            pathname: `/dogs/${areaNavigation.next.id}`,
            query: { areaId: areaNavigation.areaId },
          }}
        className="dog-secondary-button fixed right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-2xl px-3 py-4 text-center text-[0.7rem] font-semibold uppercase tracking-[0.18em] shadow-lg lg:flex lg:flex-col lg:items-center"
        >
          <span className="dog-heading text-lg leading-none">&gt;</span>
          <span>Next</span>
          <span>Dog</span>
        </Link>
      ) : null}

      <div className="mx-auto max-w-7xl">
      <section className="dog-panel mb-8 rounded-[28px] px-6 py-6 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-3 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                Show Profile
              </div>

              <div className="text-sm font-medium text-purple-200">
                {dog.breed.name}{" "}
              <span className="dog-copy">({dog.breedCode2})</span>
              </div>

            <h1 className="dog-heading mt-2 flex flex-wrap items-center gap-2 text-4xl font-bold tracking-tight sm:text-5xl">
                <span>{displayName}</span>
                <DogStatusBadges
                  healthStatus={healthBadgeStatus}
                  fullHealthClearance={fullHealthClearance}
                  isListedForSale={isListedForSale}
                  isListedAtStud={Boolean(activeStudListing)}
                  size="lg"
                />
              </h1>

            <div className="dog-copy mt-3 text-sm">
                {dog.regNumber}
              </div>

              {canNameDog ? (
                <RegisterDogNameForm
                  action={`/api/dogs/${dog.id}/rename`}
                  areaId={areaId}
                  nameError={nameError}
                />
              ) : null}

              {(dog.visibleTitlePrefix || dog.visibleTitleSuffix) && (
              <div className="dog-copy mt-3 text-sm">
                  {[dog.visibleTitlePrefix, dog.visibleTitleSuffix]
                    .filter(Boolean)
                    .join(" / ")}
                </div>
              )}

              {invitationalPlacementTags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {invitationalPlacementTags.map((award) => (
                    <Link
                      key={`${award.showDay.cluster.id}-${award.awardCode}`}
                      href={`/shows/${award.showDay.cluster.id}/results`}
                      className="rounded-full border border-amber-300/35 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25"
                    >
                      Year {award.showDay.cluster.year} Invitational{" "}
                      {award.awardCode}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
              <div className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                  Sex: {dog.sex}
                </div>
              <div className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                  Age: {formatAge(ageHours)}
                </div>
              <div className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                  Status: {dog.lifecycleState}
                </div>
                {dog.deathEpoch !== null ? (
                  <div className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100">
                    Died: {formatShowDate(dog.deathEpoch)}
                  </div>
                ) : null}
              <div className="dog-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                  Origin: {dog.originType}
                </div>
                {dog.isFoundation ? (
                  <div className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-100">
                    Foundation Dog
                  </div>
                ) : null}
                {isListedForSale ? (
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
                    Listed for Sale
                  </div>
                ) : null}
                {activeStudListing ? (
                  <div className="rounded-full border border-sky-300/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                    At Stud
                  </div>
                ) : null}
              </div>

              {saleMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {saleMessage}
                </div>
              ) : null}

              {saleError ? (
                <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {saleError}
                </div>
              ) : null}

              {groomingMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {groomingMessage}
                </div>
              ) : null}

              {groomingError ? (
                <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {groomingError}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px] lg:grid-cols-1">
              <Link
                href="/kennel"
              className="dog-secondary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold"
              >
                Back to My Kennel
              </Link>

              {canBreed ? (
                <Link
                  href={`/breed?dogId=${dog.id}`}
                  className="rounded-2xl bg-purple-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                  Breed Dog
                </Link>
              ) : (
              <div className="dog-card dog-copy rounded-2xl px-5 py-3 text-center text-sm font-semibold opacity-60">
                  Breed Dog
                </div>
              )}

              {canBuyActiveListing && activeSaleListing ? (
                <form
                  action={`/api/market-dogs/${activeSaleListing.id}/buy`}
                  method="post"
                >
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Buy for {formatMoney(activeSaleListing.askingPrice)}
                  </button>
                </form>
              ) : null}

              {canUseActiveStudListing && activeStudListing ? (
                <Link
                  href={`/breed?studListingId=${activeStudListing.id}`}
                  className="rounded-2xl bg-sky-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  Use At Stud for {formatMoney(activeStudListing.askingPrice)}
                </Link>
              ) : null}

              {canOfferForSale ? (
                <OfferDogForSaleForm
                  action={`/api/dogs/${dog.id}/list-for-sale`}
                  areaId={areaId}
                />
              ) : isOwnedByCurrentKennel && activeSaleListing ? (
                <ManageDogListingForm
                  dogId={dog.id}
                  listingId={activeSaleListing.id}
                  currentPrice={activeSaleListing.askingPrice}
                  updateAction={`/api/market-dogs/${activeSaleListing.id}/update-price`}
                  cancelAction={`/api/market-dogs/${activeSaleListing.id}/cancel`}
                  areaId={areaId}
                />
              ) : null}

              {canOfferAtStud ? (
                <OfferDogAtStudForm
                  action={`/api/dogs/${dog.id}/list-at-stud`}
                  areaId={areaId}
                />
              ) : isOwnedByCurrentKennel && activeStudListing ? (
                <ManageDogStudListingForm
                  dogId={dog.id}
                  listingId={activeStudListing.id}
                  currentPrice={activeStudListing.askingPrice}
                  updateAction={`/api/stud-listings/${activeStudListing.id}/update-price`}
                  cancelAction={`/api/stud-listings/${activeStudListing.id}/cancel`}
                  areaId={areaId}
                />
              ) : null}

              {isOwnedByCurrentKennel && isAlive ? (
                <details className="group">
                  <summary className="list-none rounded-2xl bg-amber-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-amber-500 [&::-webkit-details-marker]:hidden">
                    Groom Dog
                  </summary>
                  <div className="dog-card mt-3 rounded-2xl p-4">
                    <div className="dog-heading text-sm font-semibold">
                      Grooming
                    </div>
                    <p className="dog-copy mt-2 text-sm leading-6">
                      Grooming improves coat condition and uses one of your
                      kennel&apos;s weekly grooming actions.
                    </p>
                    <div className="dog-copy mt-3 grid gap-2 text-sm">
                      <div>
                        Grooming actions remaining this week:{" "}
                        {groomingSummary?.groomingActionsRemainingThisWeek ?? 0}{" "}
                        / {groomingSummary?.totalGroomingActionLimit ?? 10}
                      </div>
                      <div>
                        Current coat condition:{" "}
                        {formatCondition(groomingStatus.currentCoatCondition)}
                      </div>
                      <div>
                        Net grooming effect:{" "}
                        {formatSignedCondition(
                          groomingStatus.netGroomingImpact
                        )}
                      </div>
                      <div>Status: {groomingStatus.groomingStatusLabel}</div>
                    </div>
                    {groomingStatus.openListingId ? (
                      <div className="mt-3 rounded-xl border border-sky-300/20 bg-sky-500/10 px-3 py-2 text-xs leading-5 text-sky-100">
                        This dog is listed for outside grooming. Cancel the
                        listing before grooming this dog yourself.
                      </div>
                    ) : groomingStatus.groomedThisWeek ? (
                      <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs leading-5 text-emerald-100">
                        This dog has already been groomed this week.
                      </div>
                    ) : noGroomingActionsRemaining ? (
                      <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100">
                        You have used all 10 grooming actions for this game
                        week.
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2">
                    {groomingStatus.openListingId ? (
                      <CancelGroomingListingForm
                        action={`/api/services/grooming/listings/${groomingStatus.openListingId}/cancel`}
                        dogName={displayName}
                      />
                    ) : (
                      <>
                        <form
                          action="/api/services/grooming/self-groom"
                          method="post"
                        >
                          <input type="hidden" name="dogId" value={dog.id} />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={dogPageReturnTo}
                          />
                          <button
                            type="submit"
                            disabled={
                              groomingStatus.groomedThisWeek ||
                              noGroomingActionsRemaining
                            }
                            title={
                              noGroomingActionsRemaining
                                ? "No grooming actions remaining this week."
                                : undefined
                            }
                            className="w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {noGroomingActionsRemaining
                              ? "No Grooming Left"
                              : "Confirm Groom Dog"}
                          </button>
                        </form>
                        <form
                          action="/api/services/grooming/list"
                          method="post"
                        >
                          <input type="hidden" name="dogId" value={dog.id} />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={dogPageReturnTo}
                          />
                          <ConfirmSubmitButton
                            message={`Offer ${displayName} for outside grooming?`}
                            disabled={groomingStatus.groomedThisWeek}
                            className="w-full rounded-xl border border-sky-300/25 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Offer for Outside Grooming
                          </ConfirmSubmitButton>
                        </form>
                      </>
                    )}
                    </div>
                  </div>
                </details>
              ) : null}

              {isOwnedByCurrentKennel &&
              isAlive &&
              ageHours >= PUPPY_SALE_MIN_AGE_HOURS ? (
                <RehomeDogForm
                  action={`/api/dogs/${dog.id}/rehome`}
                  dogName={displayName}
                  payout={rehomePayout}
                  areaId={areaId}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <CollapsibleDogSection
            title="Visible Trait Categories"
            description="Inherited categories use a 0-20 scale with 10 as ideal. Conditioning Handling is owner-built preparation scored from 0-10."
            className={DOG_PANEL_CLASS}
            contentClassName="mt-6 space-y-4"
          >
            {categoryEntries.map(([key, value]) => (
              <TraitLine
                key={key}
                label={formatCategoryName(key)}
                value={value}
                min={0}
                max={key === "conditioningHandling" ? 10 : 20}
                ideal={10}
                leftLabel={
                  key === "conditioningHandling" ? "Unprepared" : "Poor"
                }
                rightLabel={
                  key === "conditioningHandling" ? "Prepared" : "Poor"
                }
              />
            ))}
          </CollapsibleDogSection>

          <div className="grid gap-6">
            <CollapsibleDogSection
              title="Identity"
              className={DOG_PANEL_CLASS}
              contentClassName="mt-4 grid gap-3 sm:grid-cols-2"
              titleClassName="text-xl"
            >
                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Breed
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {dog.breed.name} ({dog.breedCode2})
                  </div>
                </div>

                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Registration
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {dog.regNumber}
                  </div>
                </div>

                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Owner
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {dog.ownerKennel?.name ?? "Unowned"}
                  </div>
                </div>

                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Breeder
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {dog.breederKennel?.name ?? "System"}
                  </div>
                </div>
            </CollapsibleDogSection>

            <CollapsibleDogSection
              title="Current Status"
              className={DOG_PANEL_CLASS}
              contentClassName="mt-4 grid gap-3 sm:grid-cols-2"
              titleClassName="text-xl"
            >
                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Lifecycle
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {dog.lifecycleState}
                  </div>
                </div>

                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Market State
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {dog.marketState}
                  </div>
                </div>

                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Coat Condition
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {formatCondition(groomingStatus.currentCoatCondition)}
                  </div>
                </div>

                {isOwnedByCurrentKennel ? (
                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                      Grooming
                    </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                      {groomingStatus.groomingStatusLabel}
                    </div>
                  </div>
                ) : null}

                {isOwnedByCurrentKennel ? (
                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                      Net Grooming Effect
                    </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                      {formatSignedCondition(groomingStatus.netGroomingImpact)}
                    </div>
                  </div>
                ) : null}

                {isOwnedByCurrentKennel ? (
                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                      Grooming History
                    </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                      +{formatCondition(groomingStatus.totalGroomingGain)} gain
                      / -{formatCondition(groomingStatus.totalGroomingDecay)}{" "}
                      decay
                    </div>
                  </div>
                ) : null}

                {dog.deathEpoch !== null ? (
                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                      Death Date
                    </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                      {formatShowDate(dog.deathEpoch)}
                    </div>
                  </div>
                ) : null}

                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Show Eligibility
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {isAlive &&
                    ageHours >= MIN_SHOW_AGE_HOURS &&
                    ageHours <= MAX_SHOW_AGE_HOURS
                      ? "Eligible"
                      : "Not eligible"}
                  </div>
                </div>

                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Breeding Eligibility
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {canBreed ? "Eligible" : "Not eligible"}
                  </div>
                </div>

                <div className={`${DOG_CARD_CLASS} sm:col-span-2`}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Breeding Record
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    Champion offspring: {producerRecord.championOffspringCount}
                  </div>
                  <div className="dog-copy mt-1 text-xs">
                    Current merit:{" "}
                    {producerRecord.producerMeritLabel
                      ? `${producerRecord.producerMeritLabel} (${producerRecord.producerMeritSuffix})`
                      : "None"}
                  </div>
                  {producerRecord.nextMeritLabel &&
                  producerRecord.nextMeritThreshold !== null ? (
                    <div className="dog-copy mt-1 text-xs">
                      Progress toward {producerRecord.nextMeritLabel}:{" "}
                      {producerRecord.championOffspringCount} /{" "}
                      {producerRecord.nextMeritThreshold}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-amber-100/70">
                      Highest producer merit reached.
                    </div>
                  )}
                </div>
            </CollapsibleDogSection>

            <CollapsibleDogSection
              title="Title Progress"
              description="Championship requires 15 points and 2 major wins. Majors are 3, 4, or 5 point wins."
              badge={
                currentTitleCode ? (
                  <span className="rounded-full border border-sky-300/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100">
                    {currentTitleCode}
                  </span>
                ) : undefined
              }
              className={DOG_PANEL_CLASS}
              contentClassName="mt-4"
              titleClassName="text-xl"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Points
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {championshipPoints}/{CHAMPIONSHIP_POINTS_REQUIRED}
                  </div>
                  <div className="dog-copy mt-1 text-xs">
                    {pointsNeeded === 0
                      ? "Point requirement met"
                      : `${pointsNeeded} more needed`}
                  </div>
                </div>

                <div className={DOG_CARD_CLASS}>
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Majors
                  </div>
                  <div className="dog-heading mt-1 text-sm font-medium">
                    {majorCount}/{CHAMPIONSHIP_MAJORS_REQUIRED}
                  </div>
                  <div className="dog-copy mt-1 text-xs">
                    {majorsNeeded === 0
                      ? "Major requirement met"
                      : `${majorsNeeded} more needed`}
                  </div>
                </div>
              </div>

              {championshipPointWins.length > 0 ? (
              <div className="dog-card mt-4 rounded-2xl p-4">
                  <div className="dog-label text-xs uppercase tracking-wide">
                    Recent Point Wins
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {championshipPointWins.map((win) => (
                      <span
                        key={`${win.showDayId}-${win.awardCode}`}
                        className="rounded-full border border-sky-300/25 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-100"
                      >
                        {win.awardCode} - {win.pointsAwarded} pt
                        {win.pointsAwarded === 1 ? "" : "s"}
                        {win.isMajor ? " major" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </CollapsibleDogSection>

          </div>
        </section>

        <CollapsibleDogSection
          title="Health Testing"
          description="Public phenotype screening results. Each test becomes available at its required age."
          badge={
            <div className="flex items-center gap-2">
              <Link
                href="/faq#health-testing"
                aria-label="Read the health testing FAQ"
                title="Read the health testing FAQ"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-purple-300/30 bg-purple-500/10 text-xs font-bold text-purple-100 transition hover:bg-purple-500/25"
              >
                ?
              </Link>
              <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-100">
                {completedHealthTestCodes.size}/{PHENOTYPE_HEALTH_TEST_CODES.length} tested
              </span>
            </div>
          }
          className={`${DOG_PANEL_CLASS} mb-8`}
          contentClassName="mt-4"
        >

          {healthMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {healthMessage}
            </div>
          ) : null}

          {healthError ? (
            <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {healthError}
            </div>
          ) : null}

          <HealthTestingPanel
            dogId={dog.id}
            areaId={areaId}
            kennelBalance={currentKennel.balance}
            canOrderHealthTests={canOrderHealthTests}
            rows={healthTestRows.map(
              ({ testTypeCode, definition, latestResult, severity }) => ({
                testTypeCode,
                label: definition.label,
                fee: definition.fee,
                isAvailable: ageHours >= definition.minimumAgeHours,
                availabilityLabel: definition.minimumAgeLabel,
                result: latestResult
                  ? {
                      label: getPhenotypeHealthResultLabel(
                        testTypeCode as PhenotypeHealthTestCode,
                        latestResult.resultCode
                      ),
                      testedLabel:
                        latestResult.testedAtEpoch === null
                          ? "Test date unavailable"
                          : `Tested ${formatShowDate(latestResult.testedAtEpoch)}`,
                      severity: severity ?? "yellow",
                    }
                  : null,
              })
            )}
          />
        </CollapsibleDogSection>

        <CollapsibleDogSection
          title="Show Record"
          description="Published breed results for this dog."
          badge={
            <div className="dog-neutral-badge rounded-full px-3 py-1 text-sm font-semibold">
              {showResults.length} result{showResults.length === 1 ? "" : "s"} -{" "}
              {totalShowPoints} point{totalShowPoints === 1 ? "" : "s"}
            </div>
          }
          className={`${DOG_PANEL_CLASS} mb-8`}
          contentClassName="mt-5"
        >

          {showResults.length === 0 ? (
            <div className="dog-card dog-copy mt-5 rounded-2xl p-4 text-sm">
              No published show results yet.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                <thead>
              <tr className="dog-label text-left text-xs uppercase tracking-[0.16em]">
                    <th className="px-3 py-2">Show</th>
                    <th className="px-3 py-2">Breed</th>
                    <th className="px-3 py-2">Judge</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {showResults.map((result) => {
                    const sortedAwards = sortShowAwards(result.showAwards);

                    return (
                      <tr
                        key={result.id}
                      className="dog-card"
                      >
                        <td className="rounded-l-2xl px-3 py-3">
                          <Link
                            href={`/shows/${result.showDay.cluster.id}`}
                            className="dog-heading font-semibold underline-offset-4 hover:underline"
                          >
                            {result.showDay.cluster.name}
                          </Link>
                          <div className="dog-copy text-xs">
                            {formatShowDate(result.showDay.scheduledEpoch)} - Day{" "}
                            {result.showDay.dayIndex} -{" "}
                            {getShowDistrictRegionName(
                              result.showDay.cluster.district
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/shows/${result.showDay.cluster.id}/results/${result.breed.code2}`}
                            className="font-semibold text-sky-100 underline-offset-4 hover:underline"
                          >
                            {result.breed.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/judges/${result.judge.judgeCode}`}
                            className="dog-heading font-semibold underline-offset-4 hover:underline"
                          >
                            {result.judge.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          {sortedAwards.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {sortedAwards.map((award) => (
                                <span
                                  key={`${result.id}-${award.awardCode}-${award.awardGroup}-${award.rank ?? "na"}`}
                                  className="rounded-full border border-sky-300/25 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-100"
                                >
                                  {award.awardCode}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="dog-copy opacity-60">None</span>
                          )}
                        </td>
                        <td className="dog-heading rounded-r-2xl px-3 py-3 text-right font-semibold">
                          {result.pointsAwarded}
                          {result.isMajor ? (
                            <div className="text-xs font-medium text-amber-100">
                              Major
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleDogSection>

        {isOwnedByCurrentKennel ? (
          <CollapsibleDogSection
            title="Upcoming Shows"
            description="Current entries for this dog. Visible only to your kennel."
            badge={
              <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                {upcomingShowEntries.length} entr
                {upcomingShowEntries.length === 1 ? "y" : "ies"}
              </div>
            }
            className={`${DOG_PANEL_CLASS} mb-8`}
            contentClassName="mt-4"
          >

          {showMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {showMessage}
            </div>
          ) : null}

          {showError ? (
            <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {showError}
            </div>
          ) : null}

          {upcomingShowEntries.length === 0 ? (
              <div className="dog-card dog-copy mt-5 rounded-2xl p-4 text-sm">
                No upcoming show entries.
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[680px] border-separate border-spacing-y-2 text-sm">
                  <thead>
                <tr className="dog-label text-left text-xs uppercase tracking-[0.16em]">
                      <th className="px-3 py-2">Show</th>
                      <th className="px-3 py-2">Breed</th>
                      <th className="px-3 py-2">Judge</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingShowEntries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="dog-card"
                      >
                        <td className="rounded-l-2xl px-3 py-3">
                          <Link
                            href={`/shows/${entry.showDay.cluster.id}`}
                            className="dog-heading font-semibold underline-offset-4 hover:underline"
                          >
                            {entry.showDay.cluster.name}
                          </Link>
                          <div className="dog-copy text-xs">
                            {formatShowDate(entry.showDay.scheduledEpoch)} - Day{" "}
                            {entry.showDay.dayIndex} -{" "}
                            {getShowDistrictRegionName(
                              entry.showDay.cluster.district
                            )}
                          </div>
                        </td>
                        <td className="dog-heading px-3 py-3 font-semibold">
                          {entry.breed.name}
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/judges/${entry.showDay.judge.judgeCode}`}
                            className="dog-heading font-semibold underline-offset-4 hover:underline"
                          >
                            {entry.showDay.judge.name}
                          </Link>
                        </td>
                        <td className="rounded-r-2xl px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                entry.entryStatus === "ABSENT"
                                  ? "rounded-full border border-amber-300/25 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-100"
                                  : "rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-100"
                              }
                            >
                              {entry.entryStatus === "ABSENT"
                                ? "Absent"
                                : "Entered"}
                            </span>
                            {entry.entryStatus === "ENTERED" ? (
                              <form
                                action={`/api/show-entries/${entry.id}/pull`}
                                method="post"
                              >
                                <input type="hidden" name="dogId" value={dog.id} />
                                {areaId ? (
                                  <input type="hidden" name="areaId" value={areaId} />
                                ) : null}
                                <button
                                  type="submit"
                                  className="rounded-lg border border-red-300/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-100 transition hover:bg-red-500/20"
                                >
                                  PULL
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleDogSection>
        ) : null}

        {dog.sex === "M" && isOwnedByCurrentKennel ? (
          <CollapsibleDogSection
            title="Sire History"
            description="Breeding uses recorded for this dog, including outside stud services."
            className={`${DOG_PANEL_CLASS} mb-8`}
            contentClassName="mt-4"
            titleClassName="text-xl"
          >

            {dog.breedingAttemptsAsSire.length > 0 ? (
              <div className="grid gap-2">
                {dog.breedingAttemptsAsSire.map((attempt) => (
                  <div
                    key={attempt.id}
                  className="dog-card flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="dog-copy">
                      {attempt.createdByKennel ? (
                        <Link
                          href={`/kennels/${attempt.createdByKennel.slug}`}
                          className="dog-heading font-semibold underline-offset-4 hover:underline"
                        >
                          {attempt.createdByKennel.name}
                        </Link>
                      ) : (
                        <span className="dog-heading font-semibold">
                          Unknown kennel
                        </span>
                      )}{" "}
                      used him on {formatShowDate(attempt.createdEpoch)} with{" "}
                      <Link
                        href={`/dogs/${attempt.dam.id}`}
                        className="dog-heading font-semibold underline-offset-4 hover:underline"
                      >
                        {formatDogDisplayName(attempt.dam)}
                      </Link>
                      .
                    </div>
                    <div className="shrink-0">
                      {attempt.litterId ? (
                        <Link
                          href={`/litters/${attempt.litterId}`}
                          className="font-semibold text-emerald-100 underline-offset-4 hover:underline"
                        >
                          Litter
                        </Link>
                      ) : (
                        <span
                          className={
                            attempt.status === "CHECKED_NOT_PREGNANT"
                              ? "font-semibold text-amber-100"
                              : "text-purple-100/65"
                          }
                        >
                          {formatSireHistoryStatus(attempt.status)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dog-card dog-copy rounded-2xl p-4 text-sm">
                No breeding uses recorded.
              </div>
            )}
          </CollapsibleDogSection>
        ) : null}

        <CollapsibleDogSection
          title="Four-Generation Pedigree"
          description="Traditional pedigree order with sires above dams. Select any recorded ancestor to open that dog's profile."
          badge={
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-100">
                COI:{" "}
                {dog.coiPercent === null
                  ? "Pending"
                  : `${dog.coiPercent.toFixed(2)}%`}
              </span>
              {dog.coiPercent !== null && dog.coiGenerationDepth !== null ? (
                <span className="dog-neutral-badge rounded-full px-3 py-1 text-xs">
                  {dog.coiGenerationDepth} generation calculation
                </span>
              ) : null}
              <span className="dog-neutral-badge rounded-full px-3 py-1 text-xs">
                Color: Pending
              </span>
              <span className="dog-neutral-badge rounded-full px-3 py-1 text-xs">
                Health tests: {completedHealthTestCodes.size}/
                {PHENOTYPE_HEALTH_TEST_CODES.length}
              </span>
            </div>
          }
          className={`${DOG_PANEL_CLASS} mb-8`}
          contentClassName="mt-5"
        >
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1440px] grid-cols-4 gap-3 text-xs">
              <div className="dog-label font-semibold uppercase tracking-[0.18em]">
                Parents
              </div>
              <div className="dog-label font-semibold uppercase tracking-[0.18em]">
                Grandparents
              </div>
              <div className="dog-label font-semibold uppercase tracking-[0.18em]">
                Great-Grandparents
              </div>
              <div className="dog-label font-semibold uppercase tracking-[0.18em]">
                Great-Great-Grandparents
              </div>
            </div>
            <div className="mt-3 grid min-w-[1440px] grid-cols-4 grid-rows-16 gap-3">
              <PedigreeCard dog={pedigreeSire} relationship="Sire" column={1} rowStart={1} rowSpan={8} />
              <PedigreeCard dog={pedigreeDam} relationship="Dam" column={1} rowStart={9} rowSpan={8} />
              <PedigreeCard dog={pedigreeSireSire} relationship="Sire's Sire" column={2} rowStart={1} rowSpan={4} />
              <PedigreeCard dog={pedigreeSireDam} relationship="Sire's Dam" column={2} rowStart={5} rowSpan={4} />
              <PedigreeCard dog={pedigreeDamSire} relationship="Dam's Sire" column={2} rowStart={9} rowSpan={4} />
              <PedigreeCard dog={pedigreeDamDam} relationship="Dam's Dam" column={2} rowStart={13} rowSpan={4} />
              <PedigreeCard dog={pedigreeSireSireSire} relationship="Sire's Sire's Sire" column={3} rowStart={1} rowSpan={2} />
              <PedigreeCard dog={pedigreeSireSireDam} relationship="Sire's Sire's Dam" column={3} rowStart={3} rowSpan={2} />
              <PedigreeCard dog={pedigreeSireDamSire} relationship="Sire's Dam's Sire" column={3} rowStart={5} rowSpan={2} />
              <PedigreeCard dog={pedigreeSireDamDam} relationship="Sire's Dam's Dam" column={3} rowStart={7} rowSpan={2} />
              <PedigreeCard dog={pedigreeDamSireSire} relationship="Dam's Sire's Sire" column={3} rowStart={9} rowSpan={2} />
              <PedigreeCard dog={pedigreeDamSireDam} relationship="Dam's Sire's Dam" column={3} rowStart={11} rowSpan={2} />
              <PedigreeCard dog={pedigreeDamDamSire} relationship="Dam's Dam's Sire" column={3} rowStart={13} rowSpan={2} />
              <PedigreeCard dog={pedigreeDamDamDam} relationship="Dam's Dam's Dam" column={3} rowStart={15} rowSpan={2} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireSireSire, "sireId")} relationship="Sire's Sire's Sire's Sire" column={4} rowStart={1} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireSireSire, "damId")} relationship="Sire's Sire's Sire's Dam" column={4} rowStart={2} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireSireDam, "sireId")} relationship="Sire's Sire's Dam's Sire" column={4} rowStart={3} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireSireDam, "damId")} relationship="Sire's Sire's Dam's Dam" column={4} rowStart={4} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireDamSire, "sireId")} relationship="Sire's Dam's Sire's Sire" column={4} rowStart={5} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireDamSire, "damId")} relationship="Sire's Dam's Sire's Dam" column={4} rowStart={6} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireDamDam, "sireId")} relationship="Sire's Dam's Dam's Sire" column={4} rowStart={7} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeSireDamDam, "damId")} relationship="Sire's Dam's Dam's Dam" column={4} rowStart={8} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamSireSire, "sireId")} relationship="Dam's Sire's Sire's Sire" column={4} rowStart={9} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamSireSire, "damId")} relationship="Dam's Sire's Sire's Dam" column={4} rowStart={10} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamSireDam, "sireId")} relationship="Dam's Sire's Dam's Sire" column={4} rowStart={11} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamSireDam, "damId")} relationship="Dam's Sire's Dam's Dam" column={4} rowStart={12} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamDamSire, "sireId")} relationship="Dam's Dam's Sire's Sire" column={4} rowStart={13} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamDamSire, "damId")} relationship="Dam's Dam's Sire's Dam" column={4} rowStart={14} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamDamDam, "sireId")} relationship="Dam's Dam's Dam's Sire" column={4} rowStart={15} rowSpan={1} />
              <PedigreeCard dog={getPedigreeParent(pedigreeAncestors, pedigreeDamDamDam, "damId")} relationship="Dam's Dam's Dam's Dam" column={4} rowStart={16} rowSpan={1} />
            </div>
          </div>
        </CollapsibleDogSection>

        <section className="grid gap-6 lg:grid-cols-2">
          <CollapsibleDogSection
            title="Progeny"
            className={DOG_PANEL_CLASS}
            contentClassName="mt-4"
            titleClassName="text-xl"
          >

            {progeny.length > 0 ? (
              <div className="grid gap-2">
                {progeny.map((puppy) => (
                  <Link
                    key={puppy.id}
                    href={`/dogs/${puppy.id}`}
                  className="dog-card-interactive flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm"
                  >
                    <span className="dog-heading font-medium">
                      {formatDogDisplayName(puppy)}
                    </span>
                    <span className="dog-copy shrink-0">
                      {puppy.sex}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="dog-card dog-copy rounded-2xl p-4 text-sm">
                No progeny recorded.
              </div>
            )}
          </CollapsibleDogSection>

          <CollapsibleDogSection
            title="Active Listing"
            className={DOG_PANEL_CLASS}
            contentClassName="mt-4"
            titleClassName="text-xl"
          >

            {activeListing ? (
              <div className="dog-card dog-copy rounded-2xl p-4 text-sm leading-7">
                <div className="dog-heading mt-2">
                  {formatListingType(activeListing.listingType)} ·{" "}
                  {formatMoney(activeListing.askingPrice)}
                </div>
                {activeListing.descriptionPublic ? (
                  <div className="dog-copy mt-2">
                    {activeListing.descriptionPublic}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="dog-card dog-copy rounded-2xl p-4 text-sm leading-7">
                No active listing.
              </div>
            )}
          </CollapsibleDogSection>
        </section>

        {isOwnedByCurrentKennel && dog.plannerTags.length > 0 ? (
          <CollapsibleDogSection
            title="Program Planner"
            description="Private planner tags saved from your breed review."
            className={`${DOG_PANEL_CLASS} mt-6`}
            contentClassName="mt-4"
            titleClassName="text-xl"
          >
            <div className="grid gap-3">
              {dog.plannerTags.map((plannerTag) => (
                <div
                  key={`${plannerTag.goalKey}-${plannerTag.updatedAt.toISOString()}`}
                  className="dog-card dog-copy rounded-2xl p-4 text-sm leading-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="dog-heading font-semibold">
                      {formatPlannerTagType(plannerTag.tagType)}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-fuchsia-100/70">
                      {plannerTag.goalKey.replace(/-/g, " ")}
                    </span>
                  </div>
                  {plannerTag.note ? (
                    <div className="dog-copy mt-3 whitespace-pre-wrap">
                      {plannerTag.note}
                    </div>
                  ) : (
                    <div className="dog-copy mt-3">
                      No planner note saved for this tag.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleDogSection>
        ) : null}

        {isOwnedByCurrentKennel ? (
          <CollapsibleDogSection
            title="Notes"
            description="Private notes for your kennel only."
            className={`${DOG_PANEL_CLASS} mt-6`}
            contentClassName="mt-4"
            titleClassName="text-xl"
          >
            <DogPrivateNotesEditor
              action={`/api/dogs/${dog.id}/notes`}
              areaId={areaId}
              initialNotes={dog.privateKennelNotes[0]?.notes ?? ""}
              notesError={notesError}
              notesMessage={notesMessage}
            />
          </CollapsibleDogSection>
        ) : null}
      </div>
    </main>
  );
}
