"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { BreedSelectOptions } from "@/components/breeds/BreedSelectOptions";
import DogStatusBadges from "@/components/dogs/DogStatusBadges";
import BulkCallNameEditor from "@/components/kennel/BulkCallNameEditor";
import {
  formatBulkBrucellosisCompletion,
  formatBulkHealthTestCompletion,
  formatMoney,
} from "@/components/kennel/bulkHealthTestFeedback";
import { filterDogsBySelectedRuns } from "@/components/kennel/kennelDogFiltering";
import { matchesKennelDogSearch } from "@/components/kennel/kennelDogSearch";
import { formatDogDisplayName } from "@/lib/dogNames";
import { formatGeneticCategoryValue } from "@/lib/phenotypeFormat";
import { epochToDate } from "@/lib/gameClock";
import { formatRealDurationHoursLong } from "@/lib/gameTimeFormat";
import {
  MIN_GROOMING_AGE_HOURS,
  PUPPY_SALE_MIN_AGE_HOURS,
  getPuppyRehomePayoutForAgeHours,
} from "@showring/rules";

type VisibleCategories = Record<string, number>;

type BreedingCardStatus = {
  label:
    | "Open"
    | "Pending Pregnancy Confirmation"
    | "Pregnant"
    | "Did Not Take"
    | "Whelped"
    | "Post-Whelp Rest"
    | "Available"
    | "Recovery"
    | "Not Eligible";
  pregCheckInHours: number | null;
  dueInHours: number | null;
  cooldownInHours: number | null;
  detail: string | null;
};

type KennelDogDto = {
  dogId: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix?: string | null;
  visibleTitleSuffix?: string | null;
  breedCode2: string;
  breedName: string;
  breedGroupName: string | null;
  sex: "M" | "F";
  ageHours: number;
  lifecycleState: string;
  marketState: string;
  kennelRunId: string | null;
  currentRun: {
    id: string;
    name: string;
  } | null;
  healthBadgeStatus: "green" | "yellow" | "red" | null;
  hasAllGreenHealthTests: boolean;
  isListedForSale: boolean;
  isListedAtStud: boolean;
  groomingStatus: {
    dogId: string;
    groomedThisWeek: boolean;
    listedForGrooming: boolean;
    openListingId: string | null;
    currentCoatCondition: number;
    totalGroomingGain: number;
    totalGroomingDecay: number;
    netGroomingImpact: number;
    lastGroomedEpoch: number | null;
    currentGroomingWeek: number;
    groomingStatusLabel:
      | "Groomed this week"
      | "Listed for grooming"
      | "Needs grooming";
  };
  visibleCategories: VisibleCategories;
  breedingCardStatus: BreedingCardStatus;
};

type KennelRunDto = {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  kind: "UNCATEGORIZED" | "PLAYER" | "LITTER";
  dogCount: number;
  persistedDogCount: number;
};

type KennelDogsResponse = {
  ok: boolean;
  dogs?: KennelDogDto[];
  groomingSummary?: GroomingSummaryDto;
  error?: string;
};

type KennelRunsResponse = {
  ok: boolean;
  runs?: KennelRunDto[];
  error?: string;
};

type MoveDogsResponse = {
  ok?: boolean;
  targetRunId?: string;
  movedCount?: number;
  error?: string;
};

type MutateRunResponse = {
  ok?: boolean;
  run?: KennelRunDto;
  error?: string;
};

type DeleteRunResponse = {
  ok?: boolean;
  runId?: string;
  movedCount?: number;
  error?: string;
};

type MoveRunResponse = {
  ok?: boolean;
  runId?: string;
  direction?: "up" | "down";
  error?: string;
};

type GroomingSummaryDto = {
  groomingActionsUsedThisWeek: number;
  groomingActionsRemainingThisWeek: number;
  totalGroomingActionLimit: number;
  currentGroomingWeek: number;
  groomingWeekStartEpoch: number;
  nextGroomingResetEpoch: number;
  selfGroomsCompletedThisWeek: number;
  outsideGroomsCompletedThisWeek: number;
  groomingXp: number;
  groomingLevel: number;
};

type SortKey =
  | "breed"
  | "name"
  | "sex"
  | "age"
  | "typeExpression"
  | "structureBalance"
  | "movement"
  | "coatPresentation"
  | "temperamentRingBehavior"
  | "conditioningHandling";

type BulkAction =
  | ""
  | "show-entry"
  | "rehome"
  | "move-dogs"
  | "health-tests"
  | "brucellosis";
type ConfigurableBulkWorkspace = "move-dogs" | "health-tests" | "brucellosis";
type HealthTestCode =
  | "HIP_DYSPLASIA"
  | "ELBOW_DYSPLASIA"
  | "CARDIAC"
  | "THYROID"
  | "CAER_EYE";
type HealthTestPreview = {
  selectedDogCount: number;
  eligibleDogCount: number;
  runnableTestCount: number;
  estimatedTotalCost: number;
  byTest: Record<HealthTestCode, { runnableCount: number; estimatedCost: number }>;
  skippedByReason: Record<
    | "ALREADY_COMPLETED"
    | "TOO_YOUNG"
    | "NOT_APPLICABLE_TO_BREED"
    | "NOT_ALIVE"
    | "NOT_OWNED_OR_NOT_FOUND",
    number
  >;
};
type HealthTestExecution = {
  testedDogCount: number;
  executedTestCount: number;
  totalCharged: number;
  skippedByReason: HealthTestPreview["skippedByReason"];
};
type BrucellosisPreview = {
  selectedDogCount: number;
  screenableDogCount: number;
  skippedDogCount: number;
  estimatedTotalCost: number;
  skippedByReason: Record<"NOT_OWNED_OR_NOT_FOUND" | "NOT_ALIVE", number>;
};
type BrucellosisExecution = {
  screenedDogCount: number;
  totalCharged: number;
  skippedByReason: BrucellosisPreview["skippedByReason"];
};
type GroomingStateFilter = "" | "groomed" | "ungroomed";
type OptionalColumnId =
  | "dog"
  | "breed"
  | "sex"
  | "age"
  | "typeExpression"
  | "structureBalance"
  | "movement"
  | "coatPresentation"
  | "temperamentRingBehavior"
  | "conditioningHandling"
  | "currentRun"
  | "titleStatus"
  | "isListedForSale"
  | "isListedAtStud"
  | "breedable"
  | "breedingStatus"
  | "groomingStatus"
  | "healthStatus";

const VISIBLE_COLUMNS_STORAGE_KEY = "showring.kennelRoster.visibleColumns";
const OPTIONAL_COLUMNS: Array<{
  id: OptionalColumnId;
  label: string;
  sortKey?: SortKey;
}> = [
  { id: "dog", label: "Dog", sortKey: "name" },
  { id: "breed", label: "Breed", sortKey: "breed" },
  { id: "sex", label: "Sex", sortKey: "sex" },
  { id: "age", label: "Age", sortKey: "age" },
  { id: "typeExpression", label: "Type", sortKey: "typeExpression" },
  { id: "structureBalance", label: "Structure", sortKey: "structureBalance" },
  { id: "movement", label: "Movement", sortKey: "movement" },
  { id: "coatPresentation", label: "Coat Condition", sortKey: "coatPresentation" },
  {
    id: "temperamentRingBehavior",
    label: "Temperament",
    sortKey: "temperamentRingBehavior",
  },
  {
    id: "conditioningHandling",
    label: "Conditioning & Handling",
    sortKey: "conditioningHandling",
  },
  { id: "currentRun", label: "Current Run" },
  { id: "titleStatus", label: "CH/GCH" },
  { id: "isListedForSale", label: "For Sale" },
  { id: "isListedAtStud", label: "At Stud" },
  { id: "breedable", label: "Breedable" },
  { id: "breedingStatus", label: "Pregnancy/Whelping" },
  { id: "groomingStatus", label: "Grooming" },
  { id: "healthStatus", label: "Health Tests" },
];
const OPTIONAL_COLUMN_IDS = OPTIONAL_COLUMNS.map((column) => column.id);
const HEALTH_TEST_OPTIONS: Array<{ code: HealthTestCode; label: string }> = [
  { code: "HIP_DYSPLASIA", label: "Hips" },
  { code: "ELBOW_DYSPLASIA", label: "Elbows" },
  { code: "CARDIAC", label: "Cardiac" },
  { code: "THYROID", label: "Thyroid" },
  { code: "CAER_EYE", label: "CAER / Eye" },
];
const HEALTH_TEST_SKIP_LABELS: Array<{
  reason: keyof HealthTestPreview["skippedByReason"];
  label: string;
}> = [
  { reason: "ALREADY_COMPLETED", label: "Already completed" },
  { reason: "TOO_YOUNG", label: "Too young" },
  { reason: "NOT_APPLICABLE_TO_BREED", label: "Not applicable to breed" },
  { reason: "NOT_ALIVE", label: "Not currently eligible" },
  { reason: "NOT_OWNED_OR_NOT_FOUND", label: "No longer available" },
];
const BRUCELLOSIS_SKIP_LABELS: Array<{
  reason: keyof BrucellosisPreview["skippedByReason"];
  label: string;
}> = [
  { reason: "NOT_ALIVE", label: "Not currently eligible" },
  { reason: "NOT_OWNED_OR_NOT_FOUND", label: "No longer available" },
];
const DEFAULT_VISIBLE_COLUMNS: OptionalColumnId[] = [
  "dog",
  "breed",
  "sex",
  "age",
  "typeExpression",
  "structureBalance",
  "movement",
];

function formatAge(ageHours: number): string {
  const weeks = Math.floor(ageHours / 7);
  const years = Math.floor(weeks / 52);

  if (years >= 1) {
    const remainingWeeks = weeks % 52;
    return remainingWeeks > 0 ? `${years}y ${remainingWeeks}w` : `${years}y`;
  }

  return `${weeks}w`;
}

function getDogDisplayName(dog: KennelDogDto): string {
  return formatDogDisplayName(dog);
}

function valueForSort(dog: KennelDogDto, key: SortKey): string | number {
  switch (key) {
    case "breed":
      return dog.breedName;
    case "name":
      return getDogDisplayName(dog);
    case "sex":
      return dog.sex;
    case "age":
      return dog.ageHours;
    case "typeExpression":
      return dog.visibleCategories.typeExpression ?? 0;
    case "structureBalance":
      return dog.visibleCategories.structureBalance ?? 0;
    case "movement":
      return dog.visibleCategories.movement ?? 0;
    case "coatPresentation":
      return dog.visibleCategories.coatPresentation ?? 0;
    case "temperamentRingBehavior":
      return dog.visibleCategories.temperamentRingBehavior ?? 0;
    case "conditioningHandling":
      return dog.visibleCategories.conditioningHandling ?? 0;
    default:
      return getDogDisplayName(dog);
  }
}

function colorClassForVisibleValue(value: number): string {
  const distance = Math.abs(value - 10);

  if (distance <= 1.25) return "text-emerald-300";
  if (distance <= 2.5) return "text-lime-300";
  if (distance <= 4) return "text-yellow-300";
  if (distance <= 6) return "text-orange-300";
  return "text-red-300";
}

function StatCell({ value, genetic = true }: { value: number; genetic?: boolean }) {
  return (
    <div className={`text-sm font-semibold ${colorClassForVisibleValue(value)}`}>
      {genetic ? formatGeneticCategoryValue(value) : value.toFixed(1)}
    </div>
  );
}

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) {
    return "Reset available soon";
  }

  const totalMinutes = Math.ceil(msRemaining / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(" ");
}

function GroomingResetCountdown({ resetEpoch }: { resetEpoch: number }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const resetMs = epochToDate(resetEpoch).getTime();
  const msRemaining = resetMs - nowMs;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <span className="font-semibold text-[var(--dog-heading)]">
      {formatCountdown(msRemaining)}
    </span>
  );
}

function healthTestConfigurationKey(args: {
  dogIds: string[];
  allApplicable: boolean;
  testTypeCodes: HealthTestCode[];
}) {
  return JSON.stringify({
    dogIds: args.dogIds,
    selection: args.allApplicable
      ? { mode: "all-applicable" }
      : { mode: "explicit", testTypeCodes: args.testTypeCodes },
  });
}

function formatHealthTestExecutionError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message.startsWith("Insufficient funds") ||
    message.startsWith("Choose ") ||
    message === "That health test is not available."
  ) {
    return message;
  }

  return "Unable to complete health testing.";
}

function SortButton({
  active,
  direction,
  onClick,
  children,
}: {
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 transition ${
        active ? "theme-heading" : "theme-label hover:opacity-80"
      }`}
    >
      <span>{children}</span>
      <span className="text-[10px]">
        {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

export default function KennelDogsPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [allDogs, setAllDogs] = useState<KennelDogDto[]>([]);
  const [runs, setRuns] = useState<KennelRunDto[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [showBulkNaming, setShowBulkNaming] = useState(false);
  const dogsRequestSequence = useRef(0);
  const [groomingSummary, setGroomingSummary] =
    useState<GroomingSummaryDto | null>(null);
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [activeBulkWorkspace, setActiveBulkWorkspace] =
    useState<ConfigurableBulkWorkspace | null>(null);
  const [healthTestsAllApplicable, setHealthTestsAllApplicable] = useState(true);
  const [selectedHealthTestCodes, setSelectedHealthTestCodes] = useState<
    HealthTestCode[]
  >([]);
  const [healthTestPreview, setHealthTestPreview] =
    useState<HealthTestPreview | null>(null);
  const [healthTestPreviewConfigurationKey, setHealthTestPreviewConfigurationKey] =
    useState<string | null>(null);
  const [healthTestPreviewLoading, setHealthTestPreviewLoading] = useState(false);
  const [healthTestPreviewError, setHealthTestPreviewError] = useState<
    string | null
  >(null);
  const [healthTestDetailsExpanded, setHealthTestDetailsExpanded] = useState(false);
  const [healthTestExecutionLoading, setHealthTestExecutionLoading] = useState(false);
  const [healthTestExecutionError, setHealthTestExecutionError] = useState<
    string | null
  >(null);
  const healthTestPreviewRequestSequence = useRef(0);
  const [brucellosisPreview, setBrucellosisPreview] =
    useState<BrucellosisPreview | null>(null);
  const [brucellosisPreviewDogIdsKey, setBrucellosisPreviewDogIdsKey] =
    useState<string | null>(null);
  const [brucellosisPreviewLoading, setBrucellosisPreviewLoading] =
    useState(false);
  const [brucellosisPreviewError, setBrucellosisPreviewError] = useState<
    string | null
  >(null);
  const [brucellosisDetailsExpanded, setBrucellosisDetailsExpanded] =
    useState(false);
  const [brucellosisExecutionLoading, setBrucellosisExecutionLoading] =
    useState(false);
  const [brucellosisExecutionError, setBrucellosisExecutionError] = useState<
    string | null
  >(null);
  const brucellosisPreviewRequestSequence = useRef(0);
  const [confirmingBulkAction, setConfirmingBulkAction] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [moveDogsLoading, setMoveDogsLoading] = useState(false);
  const [selectedMoveRunId, setSelectedMoveRunId] = useState("");
  const [showCreateRunForm, setShowCreateRunForm] = useState(false);
  const [newRunName, setNewRunName] = useState("");
  const [creatingRun, setCreatingRun] = useState(false);
  const [managingRuns, setManagingRuns] = useState(false);
  const [renamingRunId, setRenamingRunId] = useState<string | null>(null);
  const [renameRunName, setRenameRunName] = useState("");
  const [renameRunLoading, setRenameRunLoading] = useState(false);
  const [deleteRunLoading, setDeleteRunLoading] = useState(false);
  const [movingRunId, setMovingRunId] = useState<string | null>(null);
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<OptionalColumnId[]>(
    DEFAULT_VISIBLE_COLUMNS
  );
  const [visibleColumnsLoaded, setVisibleColumnsLoaded] = useState(false);
  const [groomingActionDogId, setGroomingActionDogId] = useState<string | null>(
    null
  );
  const [expandedGroomingDogId, setExpandedGroomingDogId] = useState<
    string | null
  >(null);
  const [confirmingGroomingOfferDogId, setConfirmingGroomingOfferDogId] =
    useState<string | null>(null);

  const [breedFilter, setBreedFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [sexFilter, setSexFilter] = useState<"" | "M" | "F">("");
  const [onlyBreedable, setOnlyBreedable] = useState(false);
  const [onlyForSale, setOnlyForSale] = useState(false);
  const [onlyAtStud, setOnlyAtStud] = useState(false);
  const [groomingStateFilter, setGroomingStateFilter] =
    useState<GroomingStateFilter>("");

  const [sortKey, setSortKey] = useState<SortKey>("breed");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setVisibleColumns(
            parsed.filter((columnId): columnId is OptionalColumnId =>
              OPTIONAL_COLUMN_IDS.includes(columnId as OptionalColumnId)
            )
          );
        }
      }
    } catch {
      setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    } finally {
      setVisibleColumnsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!visibleColumnsLoaded) {
      return;
    }

    window.localStorage.setItem(
      VISIBLE_COLUMNS_STORAGE_KEY,
      JSON.stringify(visibleColumns)
    );
  }, [visibleColumns, visibleColumnsLoaded]);

  async function loadRuns() {
    setRunsLoading(true);
    setRunError(null);

    try {
      const response = await fetch("/api/kennel/runs", {
        method: "GET",
        cache: "no-store",
      });
      const data: KennelRunsResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load Kennel Runs.");
      }

      const nextRuns = data.runs ?? [];
      setRuns(nextRuns);
      setSelectedMoveRunId((current) =>
        nextRuns.some((run) => run.id === current) ? current : ""
      );
      setSelectedRunIds((current) => {
        const validCurrent = current.filter((runId) =>
          nextRuns.some((run) => run.id === runId)
        );

        if (validCurrent.length > 0) {
          return validCurrent;
        }

        const uncategorizedRun = nextRuns.find(
          (run) => run.kind === "UNCATEGORIZED"
        );

        return uncategorizedRun ? [uncategorizedRun.id] : [];
      });
    } catch (err) {
      setRunError(
        err instanceof Error ? err.message : "Failed to load Kennel Runs."
      );
      setRuns([]);
      setSelectedRunIds([]);
    } finally {
      setRunsLoading(false);
    }
  }

  async function loadDogs(options?: { preserveLoadingState?: boolean }) {
    const requestSequence = ++dogsRequestSequence.current;

    if (!options?.preserveLoadingState) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/dogs/mine", {
        method: "GET",
        cache: "no-store",
      });

      const data: KennelDogsResponse = await response.json();

      if (requestSequence !== dogsRequestSequence.current) {
        return;
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load kennel dogs.");
      }

      setAllDogs(data.dogs ?? []);
      setGroomingSummary(data.groomingSummary ?? null);
    } catch (err) {
      if (requestSequence !== dogsRequestSequence.current) {
        return;
      }

      setError(
        err instanceof Error ? err.message : "Failed to load kennel dogs."
      );
    } finally {
      if (requestSequence === dogsRequestSequence.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadRuns();
    void loadDogs();
  }, []);

  useEffect(() => {
    if (selectedDogIds.length === 0) {
      setBulkAction("");
      setConfirmingBulkAction(false);
      setActiveBulkWorkspace(null);
      setSelectedMoveRunId("");
      resetHealthTestingWorkspaceState();
      resetBrucellosisWorkspaceState();
    }
  }, [selectedDogIds.length]);

  useEffect(() => {
    if (activeBulkWorkspace !== "health-tests" || selectedDogIds.length === 0) {
      return;
    }

    if (!healthTestsAllApplicable && selectedHealthTestCodes.length === 0) {
      setHealthTestPreview(null);
      setHealthTestPreviewError(null);
      setHealthTestPreviewLoading(false);
      return;
    }

    const requestSequence = ++healthTestPreviewRequestSequence.current;
    const configurationKey = healthTestConfigurationKey({
      dogIds: selectedDogIds,
      allApplicable: healthTestsAllApplicable,
      testTypeCodes: selectedHealthTestCodes,
    });
    setHealthTestPreviewLoading(true);
    setHealthTestPreviewError(null);
    setHealthTestPreview(null);

    void fetch("/api/kennel/dogs/health-tests/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dogIds: selectedDogIds,
        selection: healthTestsAllApplicable
          ? { mode: "all-applicable" }
          : { mode: "explicit", testTypeCodes: selectedHealthTestCodes },
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          ok?: boolean;
          preview?: HealthTestPreview;
          error?: string;
        };

        if (!response.ok || !data.ok || !data.preview) {
          throw new Error(data.error || "Unable to calculate the health-test estimate.");
        }

        if (requestSequence !== healthTestPreviewRequestSequence.current) {
          return;
        }

        setHealthTestPreview(data.preview);
        setHealthTestPreviewConfigurationKey(configurationKey);
      })
      .catch((previewError) => {
        if (requestSequence !== healthTestPreviewRequestSequence.current) {
          return;
        }

        setHealthTestPreview(null);
        setHealthTestPreviewConfigurationKey(null);
        setHealthTestPreviewError(
          previewError instanceof Error
            ? previewError.message
            : "Unable to calculate the health-test estimate."
        );
      })
      .finally(() => {
        if (requestSequence === healthTestPreviewRequestSequence.current) {
          setHealthTestPreviewLoading(false);
        }
      });
  }, [
    activeBulkWorkspace,
    healthTestsAllApplicable,
    selectedDogIds,
    selectedHealthTestCodes,
  ]);

  useEffect(() => {
    if (activeBulkWorkspace !== "brucellosis" || selectedDogIds.length === 0) {
      return;
    }

    const requestSequence = ++brucellosisPreviewRequestSequence.current;
    const dogIdsKey = selectedDogIds.join(",");
    setBrucellosisPreviewLoading(true);
    setBrucellosisPreviewError(null);
    setBrucellosisPreview(null);

    void fetch("/api/kennel/dogs/brucellosis/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dogIds: selectedDogIds }),
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          ok?: boolean;
          preview?: BrucellosisPreview;
          error?: string;
        };

        if (!response.ok || !data.ok || !data.preview) {
          throw new Error(
            data.error || "Unable to calculate the brucellosis screening estimate."
          );
        }

        if (requestSequence !== brucellosisPreviewRequestSequence.current) {
          return;
        }

        setBrucellosisPreview(data.preview);
        setBrucellosisPreviewDogIdsKey(dogIdsKey);
      })
      .catch((previewError) => {
        if (requestSequence !== brucellosisPreviewRequestSequence.current) {
          return;
        }

        setBrucellosisPreviewError(
          previewError instanceof Error
            ? previewError.message
            : "Unable to calculate the brucellosis screening estimate."
        );
        setBrucellosisPreviewDogIdsKey(null);
      })
      .finally(() => {
        if (requestSequence === brucellosisPreviewRequestSequence.current) {
          setBrucellosisPreviewLoading(false);
        }
      });
  }, [activeBulkWorkspace, selectedDogIds]);

  useEffect(() => {
    if (selectedRunIds.length !== 1) {
      setShowBulkNaming(false);
    }
  }, [selectedRunIds]);

  const runFilteredDogs = useMemo(
    () => filterDogsBySelectedRuns(allDogs, runs, selectedRunIds),
    [allDogs, runs, selectedRunIds]
  );

  const breedOptions = useMemo(() => {
    const breedByCode = new Map<
      string,
      { code2: string; name: string; groupName: string | null }
    >();

    for (const dog of runFilteredDogs) {
      breedByCode.set(dog.breedCode2, {
        code2: dog.breedCode2,
        name: dog.breedName,
        groupName: dog.breedGroupName,
      });
    }

    return [...breedByCode.values()];
  }, [runFilteredDogs]);

  const displayedDogs = useMemo(() => {
    const normalizedQuery = searchText.trim().toLowerCase();
    const list = runFilteredDogs.filter((dog) => {
      const searchMatch = matchesKennelDogSearch(dog, normalizedQuery);
      const breedMatch = breedFilter ? dog.breedCode2 === breedFilter : true;
      const sexMatch = sexFilter ? dog.sex === sexFilter : true;

      const breedableMatch = onlyBreedable
        ? dog.breedingCardStatus.label === "Open" ||
          dog.breedingCardStatus.label === "Available"
        : true;

      const forSaleMatch = onlyForSale ? dog.isListedForSale : true;
      const atStudMatch = onlyAtStud ? dog.isListedAtStud : true;
      const groomingMatch =
        groomingStateFilter === "groomed"
          ? dog.groomingStatus.groomedThisWeek
          : groomingStateFilter === "ungroomed"
            ? !dog.groomingStatus.groomedThisWeek
        : true;

      return (
        searchMatch &&
        breedMatch &&
        sexMatch &&
        breedableMatch &&
        forSaleMatch &&
        atStudMatch &&
        groomingMatch
      );
    });

    list.sort((a, b) => {
      const aValue = valueForSort(a, sortKey);
      const bValue = valueForSort(b, sortKey);

      let comparison = 0;

      if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [
    runFilteredDogs,
    searchText,
    breedFilter,
    sexFilter,
    onlyBreedable,
    onlyForSale,
    onlyAtStud,
    groomingStateFilter,
    sortKey,
    sortDirection,
  ]);

  const displayedDogIds = useMemo(
    () => displayedDogs.map((dog) => dog.dogId),
    [displayedDogs]
  );

  const selectedDogs = useMemo(() => {
    const selected = new Set(selectedDogIds);
    return allDogs.filter((dog) => selected.has(dog.dogId));
  }, [allDogs, selectedDogIds]);

  const selectedDogsQuery = selectedDogIds.join(",");
  const selectedRuns = runs.filter((run) => selectedRunIds.includes(run.id));
  const selectedRun = selectedRuns.length === 1 ? selectedRuns[0] : null;
  const selectedRunNames = selectedRuns.map((run) => run.name);
  const viewingLabel =
    selectedRuns.length === 1
      ? `Viewing: ${selectedRuns[0].name}`
      : selectedRuns.length > 1
        ? `Viewing: ${selectedRuns.length} runs`
        : "Viewing: Kennel Runs";
  const selectedRunSummary =
    selectedRunNames.length > 1 ? selectedRunNames.join(", ") : "";
  const filtersActive =
    Boolean(searchText.trim()) ||
    Boolean(breedFilter) ||
    Boolean(sexFilter) ||
    onlyBreedable ||
    onlyForSale ||
    onlyAtStud ||
    Boolean(groomingStateFilter);
  const selectedRehomeCredits = selectedDogs.reduce(
    (total, dog) =>
      total + getPuppyRehomePayoutForAgeHours(dog.ageHours),
    0
  );
  const canBulkRehome =
    selectedDogs.length > 0 &&
    selectedDogs.every(
      (dog) =>
        dog.ageHours >= PUPPY_SALE_MIN_AGE_HOURS &&
        dog.lifecycleState === "ALIVE"
    );
  const canApplyBulkAction =
    bulkAction === "show-entry" ||
    (bulkAction === "rehome" && canBulkRehome && !bulkActionLoading);
  const currentHealthTestConfigurationKey = healthTestConfigurationKey({
    dogIds: selectedDogIds,
    allApplicable: healthTestsAllApplicable,
    testTypeCodes: selectedHealthTestCodes,
  });
  const canRunHealthTests =
    healthTestPreview !== null &&
    healthTestPreviewConfigurationKey === currentHealthTestConfigurationKey &&
    healthTestPreview.runnableTestCount > 0 &&
    !healthTestPreviewLoading &&
    !healthTestExecutionLoading;
  const canRunBrucellosisTests =
    brucellosisPreview !== null &&
    brucellosisPreviewDogIdsKey === selectedDogIds.join(",") &&
    brucellosisPreview.screenableDogCount > 0 &&
    !brucellosisPreviewLoading &&
    !brucellosisExecutionLoading;
  const selectedVisibleDogCount = displayedDogIds.filter((dogId) =>
    selectedDogIds.includes(dogId)
  ).length;
  const allFilteredDogsSelected =
    displayedDogIds.length > 0 &&
    displayedDogIds.every((dogId) => selectedDogIds.includes(dogId));
  const canMoveSelectedDogs =
    selectedDogIds.length > 0 && Boolean(selectedMoveRunId) && !moveDogsLoading;
  const canCreateRun = newRunName.trim().length > 0 && !creatingRun;
  const canRenameRun = renameRunName.trim().length > 0 && !renameRunLoading;
  const visibleColumnSet = useMemo(
    () => new Set<OptionalColumnId>(visibleColumns),
    [visibleColumns]
  );
  const visibleColumnDefinitions = OPTIONAL_COLUMNS.filter((column) =>
    visibleColumnSet.has(column.id)
  );
  const visibleOptionalColumnCount = visibleColumnDefinitions.length;
  const rosterColumnCount = 2 + visibleOptionalColumnCount;

  useEffect(() => {
    setSelectedDogIds((current) =>
      current.filter((dogId) => displayedDogIds.includes(dogId))
    );
    setConfirmingGroomingOfferDogId((current) =>
      current && displayedDogIds.includes(current) ? current : null
    );
  }, [displayedDogIds]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "age" ? "desc" : "asc");
  }

  function toggleDogSelection(dogId: string) {
    setConfirmingBulkAction(false);
    setSelectedDogIds((current) =>
      current.includes(dogId)
        ? current.filter((selectedDogId) => selectedDogId !== dogId)
        : [...current, dogId]
    );
  }

  function toggleVisibleSelection() {
    const visibleIdSet = new Set(displayedDogIds);

    if (allFilteredDogsSelected) {
      setConfirmingBulkAction(false);
      setSelectedDogIds((current) =>
        current.filter((dogId) => !visibleIdSet.has(dogId))
      );
      return;
    }

    setConfirmingBulkAction(false);
    setSelectedDogIds((current) =>
      Array.from(new Set([...current, ...displayedDogIds]))
    );
  }

  function clearSelection() {
    setSelectedDogIds([]);
    setBulkAction("");
    setActiveBulkWorkspace(null);
    setSelectedMoveRunId("");
    setConfirmingBulkAction(false);
    resetHealthTestingWorkspaceState();
    resetBrucellosisWorkspaceState();
  }

  function closeActiveBulkWorkspace() {
    setActiveBulkWorkspace(null);
    setSelectedMoveRunId("");
    resetHealthTestingWorkspaceState();
    resetBrucellosisWorkspaceState();
  }

  function resetHealthTestingWorkspaceState() {
    healthTestPreviewRequestSequence.current += 1;
    setHealthTestsAllApplicable(true);
    setSelectedHealthTestCodes([]);
    setHealthTestPreview(null);
    setHealthTestPreviewConfigurationKey(null);
    setHealthTestPreviewLoading(false);
    setHealthTestPreviewError(null);
    setHealthTestDetailsExpanded(false);
    setHealthTestExecutionLoading(false);
    setHealthTestExecutionError(null);
  }

  function resetBrucellosisWorkspaceState() {
    brucellosisPreviewRequestSequence.current += 1;
    setBrucellosisPreview(null);
    setBrucellosisPreviewDogIdsKey(null);
    setBrucellosisPreviewLoading(false);
    setBrucellosisPreviewError(null);
    setBrucellosisDetailsExpanded(false);
    setBrucellosisExecutionLoading(false);
    setBrucellosisExecutionError(null);
  }

  function toggleHealthTestCode(code: HealthTestCode) {
    setSelectedHealthTestCodes((current) =>
      current.includes(code)
        ? current.filter((testCode) => testCode !== code)
        : [...current, code]
    );
  }

  function hasColumn(columnId: OptionalColumnId) {
    return visibleColumnSet.has(columnId);
  }

  function toggleVisibleColumn(columnId: OptionalColumnId) {
    setVisibleColumns((current) =>
      current.includes(columnId)
        ? current.filter((visibleColumnId) => visibleColumnId !== columnId)
        : [...current, columnId]
    );
  }

  function resetVisibleColumns() {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
  }

  function selectAllColumns() {
    setVisibleColumns([...OPTIONAL_COLUMN_IDS]);
  }

  function clearAllFilters() {
    setSearchText("");
    setBreedFilter("");
    setSexFilter("");
    setOnlyBreedable(false);
    setOnlyForSale(false);
    setOnlyAtStud(false);
    setGroomingStateFilter("");
  }

  function toggleRunSelection(runId: string) {
    setSelectedRunIds((current) => {
      if (current.includes(runId)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((selectedRunId) => selectedRunId !== runId);
      }

      return [...current, runId];
    });
    setShowBulkNaming(false);
    clearSelection();
  }

  async function refreshAfterBulkNamingSave() {
    await loadDogs({ preserveLoadingState: true });
  }

  function updateBulkAction(action: BulkAction) {
    if (action === "move-dogs") {
      setBulkAction("");
      setConfirmingBulkAction(false);
      setActiveBulkWorkspace("move-dogs");
      setSelectedMoveRunId("");
      resetHealthTestingWorkspaceState();
      resetBrucellosisWorkspaceState();
      return;
    }

    if (action === "health-tests") {
      setBulkAction("");
      setConfirmingBulkAction(false);
      setActiveBulkWorkspace("health-tests");
      setSelectedMoveRunId("");
      resetHealthTestingWorkspaceState();
      resetBrucellosisWorkspaceState();
      return;
    }

    if (action === "brucellosis") {
      setBulkAction("");
      setConfirmingBulkAction(false);
      setActiveBulkWorkspace("brucellosis");
      setSelectedMoveRunId("");
      resetHealthTestingWorkspaceState();
      resetBrucellosisWorkspaceState();
      return;
    }

    setBulkAction(action);
    setConfirmingBulkAction(false);
    closeActiveBulkWorkspace();
  }

  function applyBulkAction() {
    if (!canApplyBulkAction) {
      return;
    }

    if (bulkAction === "show-entry") {
      router.push(`/shows?dogIds=${encodeURIComponent(selectedDogsQuery)}`);
      return;
    }

    if (bulkAction === "rehome") {
      setConfirmingBulkAction(true);
    }
  }

  async function runBulkHealthTests() {
    if (!canRunHealthTests) {
      return;
    }

    setHealthTestExecutionLoading(true);
    setHealthTestExecutionError(null);

    try {
      const response = await fetch("/api/kennel/dogs/health-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dogIds: selectedDogIds,
          selection: healthTestsAllApplicable
            ? { mode: "all-applicable" }
            : { mode: "explicit", testTypeCodes: selectedHealthTestCodes },
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        result?: HealthTestExecution;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error || "Unable to run bulk health tests.");
      }

      await loadDogs({ preserveLoadingState: true });
      setActiveBulkWorkspace(null);
      resetHealthTestingWorkspaceState();
      setMessage(formatBulkHealthTestCompletion(data.result));
    } catch (executionError) {
      setHealthTestExecutionError(formatHealthTestExecutionError(executionError));
    } finally {
      setHealthTestExecutionLoading(false);
    }
  }

  async function runBulkBrucellosisTests() {
    if (!canRunBrucellosisTests) {
      return;
    }

    setBrucellosisExecutionLoading(true);
    setBrucellosisExecutionError(null);

    try {
      const response = await fetch("/api/kennel/dogs/brucellosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dogIds: selectedDogIds }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        result?: BrucellosisExecution;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error || "Unable to complete brucellosis screenings.");
      }

      await loadDogs({ preserveLoadingState: true });
      setActiveBulkWorkspace(null);
      resetBrucellosisWorkspaceState();
      setMessage(formatBulkBrucellosisCompletion(data.result));
    } catch (executionError) {
      const message = executionError instanceof Error ? executionError.message : "";
      setBrucellosisExecutionError(
        message.startsWith("Insufficient funds") || message.startsWith("Choose ")
          ? message
          : "Unable to complete brucellosis screenings."
      );
    } finally {
      setBrucellosisExecutionLoading(false);
    }
  }

  async function moveSelectedDogs() {
    if (!canMoveSelectedDogs) {
      return;
    }

    const targetRun = runs.find((run) => run.id === selectedMoveRunId);
    const dogIdsToMove = [...selectedDogIds];

    setMoveDogsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/kennel/dogs/run", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dogIds: dogIdsToMove,
          targetRunId: selectedMoveRunId,
        }),
      });
      const data = (await response.json()) as MoveDogsResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to move selected dogs.");
      }

      await loadRuns();
      await loadDogs({ preserveLoadingState: true });
      clearSelection();
      setMessage(
        `Moved ${data.movedCount ?? dogIdsToMove.length} dog${
          (data.movedCount ?? dogIdsToMove.length) === 1 ? "" : "s"
        } to ${targetRun?.name ?? "the selected Kennel Run"}.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to move selected dogs."
      );
    } finally {
      setMoveDogsLoading(false);
    }
  }

  async function createRun() {
    const name = newRunName.trim();

    if (!name || creatingRun) {
      return;
    }

    setCreatingRun(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/kennel/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as MutateRunResponse;

      if (!response.ok || !data.ok || !data.run) {
        throw new Error(data.error || "Failed to create Kennel Run.");
      }

      await loadRuns();
      setSelectedRunIds([data.run.id]);
      await loadDogs({ preserveLoadingState: true });
      clearSelection();
      setNewRunName("");
      setShowCreateRunForm(false);
      setMessage(`Created Kennel Run "${data.run.name}".`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create Kennel Run."
      );
    } finally {
      setCreatingRun(false);
    }
  }

  function startRenameRun(run: KennelRunDto) {
    if (run.kind === "UNCATEGORIZED") {
      return;
    }

    setRenamingRunId(run.id);
    setRenameRunName(run.name);
  }

  async function renameRun() {
    const name = renameRunName.trim();

    if (!renamingRunId || !name || renameRunLoading) {
      return;
    }

    setRenameRunLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/kennel/runs/${renamingRunId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as MutateRunResponse;

      if (!response.ok || !data.ok || !data.run) {
        throw new Error(data.error || "Failed to rename Kennel Run.");
      }

      await loadRuns();
      setRenamingRunId(null);
      setRenameRunName("");
      setMessage(`Renamed Kennel Run to "${data.run.name}".`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to rename Kennel Run."
      );
    } finally {
      setRenameRunLoading(false);
    }
  }

  async function deleteRun(run: KennelRunDto) {
    if (run.kind === "UNCATEGORIZED" || deleteRunLoading) {
      return;
    }

    const uncategorizedRun = runs.find(
      (candidate) => candidate.kind === "UNCATEGORIZED"
    );
    const nextSelectedRunIds = selectedRunIds.filter(
      (runId) => runId !== run.id
    );
    const selectedAfterDelete =
      nextSelectedRunIds.length > 0
        ? nextSelectedRunIds
        : uncategorizedRun
          ? [uncategorizedRun.id]
          : [];

    setDeleteRunLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/kennel/runs/${run.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as DeleteRunResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete Kennel Run.");
      }

      await loadRuns();
      setSelectedRunIds(selectedAfterDelete);
      await loadDogs({ preserveLoadingState: true });
      clearSelection();
      setMessage(
        "Run deleted. Any dogs remaining in the kennel run were transferred to Uncategorized."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete Kennel Run."
      );
    } finally {
      setDeleteRunLoading(false);
    }
  }

  async function moveRun(run: KennelRunDto, direction: "up" | "down") {
    if (run.kind === "UNCATEGORIZED" || movingRunId) {
      return;
    }

    setMovingRunId(run.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/kennel/runs/${run.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = (await response.json()) as MoveRunResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to reorder Kennel Run.");
      }

      await loadRuns();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reorder Kennel Run."
      );
    } finally {
      setMovingRunId(null);
    }
  }

  async function runGroomingAction(args: {
    dogId: string;
    endpoint: string;
  }) {
    if (groomingActionDogId) {
      return;
    }

    if (
      args.endpoint === "/api/services/grooming/self-groom" &&
      (groomingSummary?.groomingActionsRemainingThisWeek ?? 0) <= 0
    ) {
      setError("No grooming actions remaining this week.");
      setExpandedGroomingDogId(null);
      return;
    }

    setGroomingActionDogId(args.dogId);
    setExpandedGroomingDogId(null);
    setConfirmingGroomingOfferDogId(null);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(args.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dogId: args.dogId }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to update grooming status.");
      }

      setMessage(data.message ?? "Grooming status updated.");
      await loadDogs({ preserveLoadingState: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update grooming status."
      );
    } finally {
      setGroomingActionDogId(null);
    }
  }

  async function rehomeSelectedDogs() {
    if (!canBulkRehome || bulkActionLoading) {
      return;
    }

    setBulkActionLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/dogs/bulk-rehome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dogIds: selectedDogIds }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        rehomedCount?: number;
        creditsAdded?: number;
        dogIds?: string[];
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to re-home selected dogs.");
      }

      const rehomedIds = new Set(data.dogIds ?? selectedDogIds);
      setAllDogs((current) =>
        current.filter((dog) => !rehomedIds.has(dog.dogId))
      );
      setSelectedDogIds([]);
      setBulkAction("");
      setConfirmingBulkAction(false);
      router.refresh();
      const creditsAdded = data.creditsAdded ?? 0;
      setMessage(
        `Re-homed ${data.rehomedCount ?? rehomedIds.size} dog(s).${
          creditsAdded > 0
            ? ` Added $${creditsAdded.toLocaleString()} to your ledger.`
            : ""
        }`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to re-home selected dogs."
      );
    } finally {
      setBulkActionLoading(false);
    }
  }

  return (
    <section className="theme-panel rounded-[28px] p-5">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="theme-heading text-3xl font-semibold">
            Kennel Roster
          </h2>
          <p className="theme-copy mt-2 text-sm leading-7">
            Sort, filter, and compare your dogs in one working roster.
          </p>
        </div>

        {groomingSummary ? (
          <div className="theme-neutral-badge inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full px-3 py-1 text-xs lg:mt-1 lg:shrink-0 lg:self-start">
            <span className="font-semibold">Grooming:</span>
            <span>
              Remaining{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {groomingSummary.groomingActionsRemainingThisWeek}
              </span>
            </span>
            <span aria-hidden="true" className="text-[var(--color-text-muted)]">
              &middot;
            </span>
            <span>
              Reset{" "}
              <GroomingResetCountdown
                resetEpoch={groomingSummary.nextGroomingResetEpoch}
              />
            </span>
            <span aria-hidden="true" className="text-[var(--color-text-muted)]">
              &middot;
            </span>
            <span>
              Level{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {groomingSummary.groomingLevel}
              </span>
            </span>
            <span aria-hidden="true" className="text-[var(--color-text-muted)]">
              &middot;
            </span>
            <span>
              XP{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {groomingSummary.groomingXp}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(220px,260px)] xl:items-start">
        <aside className="theme-card order-1 rounded-2xl p-4 xl:order-3">
          <div className="flex items-center justify-between gap-2">
            <div className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
              Kennel Runs
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreateRunForm((current) => !current);
                setRenamingRunId(null);
              }}
              className="theme-secondary-button rounded-md px-2 py-1 text-[0.68rem] font-semibold"
            >
              + Run
            </button>
          </div>
          <p className="theme-copy mt-2 text-sm leading-6">
            Choose one or more runs to view.
          </p>

          {showCreateRunForm ? (
            <form
              className="theme-status-info mt-2 rounded-lg p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createRun();
              }}
            >
              <label className="grid gap-1.5">
                <span className="theme-label text-[0.68rem] uppercase tracking-wide">
                  Run name
                </span>
                <input
                  type="text"
                  value={newRunName}
                  onChange={(event) => setNewRunName(event.target.value)}
                  className="theme-control rounded-lg px-3 py-2 text-sm outline-none"
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateRunForm(false);
                    setNewRunName("");
                  }}
                  disabled={creatingRun}
                  className="theme-secondary-button rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canCreateRun}
                  className="theme-primary-button rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {creatingRun ? "Creating..." : "Create Run"}
                </button>
              </div>
            </form>
          ) : null}

          {runError ? (
            <button
              type="button"
              onClick={() => void loadRuns()}
              disabled={runsLoading}
              className="theme-secondary-button mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              {runsLoading ? "Refreshing..." : "Retry"}
            </button>
          ) : null}

          {runsLoading ? (
            <div className="theme-copy mt-4 rounded-lg border border-[var(--color-border)] px-3 py-3 text-sm">
              Loading runs...
            </div>
          ) : runError ? (
            <div className="theme-status-danger mt-4 rounded-lg px-3 py-3 text-sm">
              {runError}
            </div>
          ) : runs.length === 0 ? (
            <div className="theme-copy mt-4 rounded-lg border border-[var(--color-border)] px-3 py-3 text-sm">
              No runs available.
            </div>
          ) : (
            <div className="mt-4 grid max-h-[360px] gap-1.5 overflow-y-auto pr-1 xl:max-h-[calc(100vh-260px)]">
              {runs.map((run) => {
                const selected = selectedRunIds.includes(run.id);
                const isRenaming = renamingRunId === run.id;
                const movableRuns = runs.filter(
                  (candidate) => candidate.kind !== "UNCATEGORIZED"
                );
                const movableRunIndex = movableRuns.findIndex(
                  (candidate) => candidate.id === run.id
                );
                const isMoveLoading = movingRunId === run.id;
                return (
                  <div
                    key={run.id}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1.5"
                  >
                    {isRenaming ? (
                      <form
                        className="grid gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void renameRun();
                        }}
                      >
                        <label className="grid gap-1.5">
                          <span className="theme-label text-[0.68rem] uppercase tracking-wide">
                            Rename Run
                          </span>
                          <input
                            type="text"
                            value={renameRunName}
                            onChange={(event) =>
                              setRenameRunName(event.target.value)
                            }
                            className="theme-control rounded-lg px-3 py-2 text-sm outline-none"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingRunId(null);
                              setRenameRunName("");
                            }}
                            disabled={renameRunLoading}
                            className="theme-secondary-button rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!canRenameRun}
                            className="theme-primary-button rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {renameRunLoading ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleRunSelection(run.id)}
                          className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                            selected
                              ? "theme-primary-button"
                              : "theme-neutral-badge hover:opacity-80"
                          }`}
                        >
                          <span className="truncate">{run.name}</span>
                          <span className="shrink-0 tabular-nums">
                            {run.dogCount}
                          </span>
                        </button>

                        {managingRuns && run.kind !== "UNCATEGORIZED" ? (
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => void moveRun(run, "up")}
                              disabled={movableRunIndex <= 0 || movingRunId !== null}
                              aria-label={`Move ${run.name} up`}
                              className="theme-secondary-button rounded-md px-2 py-1 text-[0.68rem] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {isMoveLoading ? "Moving..." : "Move Up"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void moveRun(run, "down")}
                              disabled={
                                movableRunIndex < 0 ||
                                movableRunIndex === movableRuns.length - 1 ||
                                movingRunId !== null
                              }
                              aria-label={`Move ${run.name} down`}
                              className="theme-secondary-button rounded-md px-2 py-1 text-[0.68rem] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {isMoveLoading ? "Moving..." : "Move Down"}
                            </button>
                            <button
                              type="button"
                              onClick={() => startRenameRun(run)}
                              className="theme-secondary-button rounded-md px-2 py-1 text-[0.68rem] font-semibold"
                            >
                              Rename Run
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteRun(run)}
                              disabled={deleteRunLoading}
                              className="theme-status-danger rounded-md px-2 py-1 text-[0.68rem] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {deleteRunLoading ? "Deleting..." : "Delete Run"}
                            </button>
                          </div>
                        ) : null}

                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setManagingRuns((current) => !current);
              setRenamingRunId(null);
            }}
            className="theme-secondary-button mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold"
          >
            {managingRuns ? "Done Managing" : "Manage Runs"}
          </button>
        </aside>

        <aside className="theme-card order-2 rounded-2xl p-4 xl:order-1">
          <div className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
            Filters
          </div>
          <div className="theme-copy mt-2 text-xs leading-5">
            Narrow the selected run view.
          </div>

          {/* TODO: Add low-risk age milestone filters here when the roster filter set expands. */}
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5">
              <span className="theme-label text-[0.7rem] uppercase tracking-wide">
                Search dogs
              </span>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Call name, registered name, or registration number"
                className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="theme-label text-[0.7rem] uppercase tracking-wide">
                Breed
              </span>
              <select
                value={breedFilter}
                onChange={(e) => setBreedFilter(e.target.value)}
                className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">All Breeds</option>
                <BreedSelectOptions options={breedOptions} />
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="theme-label text-[0.7rem] uppercase tracking-wide">
                Sex
              </span>
              <select
                value={sexFilter}
                onChange={(e) => setSexFilter(e.target.value as "" | "M" | "F")}
                className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">All Sexes</option>
                <option value="M">Dogs</option>
                <option value="F">Bitches</option>
              </select>
            </label>

            <label className="theme-control flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={onlyBreedable}
                onChange={(e) => setOnlyBreedable(e.target.checked)}
              />
              Breedable
            </label>

            <label className="theme-control flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={onlyForSale}
                onChange={(e) => setOnlyForSale(e.target.checked)}
              />
              For Sale
            </label>

            <label className="theme-control flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={onlyAtStud}
                onChange={(e) => setOnlyAtStud(e.target.checked)}
              />
              At Stud
            </label>

            <label className="grid gap-1.5">
              <span className="theme-label text-[0.7rem] uppercase tracking-wide">
                Grooming
              </span>
              <select
                value={groomingStateFilter}
                onChange={(e) =>
                  setGroomingStateFilter(e.target.value as GroomingStateFilter)
                }
                className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">All Grooming</option>
                <option value="groomed">Groomed</option>
                <option value="ungroomed">Ungroomed</option>
              </select>
            </label>

            <button
              type="button"
              onClick={clearAllFilters}
              disabled={!filtersActive}
              className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear All Filters
            </button>
          </div>
        </aside>

        <main className="order-3 min-w-0 xl:order-2">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
                {viewingLabel}
              </div>
              <div className="theme-copy mt-1 text-sm">
                {selectedVisibleDogCount} selected, {displayedDogs.length} visible dog
                {displayedDogs.length === 1 ? "" : "s"}
              </div>
              {selectedRunSummary ? (
                <div className="theme-copy mt-1 max-w-xl truncate text-xs">
                  {selectedRunSummary}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <div className="flex flex-wrap justify-end gap-2">
                {selectedRun ? (
                  <button
                    type="button"
                    onClick={() => setShowBulkNaming((current) => !current)}
                    className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold"
                  >
                    Bulk Naming
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowColumnChooser((current) => !current)}
                  className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold"
                >
                  View Options
                </button>
              </div>

              {showColumnChooser ? (
                <div className="theme-card absolute right-0 z-20 mt-2 w-72 rounded-2xl p-3 shadow-xl">
                  <div className="theme-heading text-sm font-semibold">
                    Visible Traits
                  </div>
                  <div className="theme-copy mt-1 text-xs leading-5">
                    Select which details appear in the roster. Select and Open
                    always stay visible.
                  </div>
                  <div className="mt-3 grid max-h-72 gap-1.5 overflow-y-auto pr-1">
                    {OPTIONAL_COLUMNS.map((column) => (
                      <label
                        key={column.id}
                        className="theme-control flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={hasColumn(column.id)}
                          onChange={() => toggleVisibleColumn(column.id)}
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={resetVisibleColumns}
                      className="theme-secondary-button rounded-md px-2.5 py-1.5 text-[0.68rem] font-semibold"
                    >
                      Reset View
                    </button>
                    <button
                      type="button"
                      onClick={selectAllColumns}
                      className="theme-secondary-button rounded-md px-2.5 py-1.5 text-[0.68rem] font-semibold"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowColumnChooser(false)}
                      className="theme-primary-button rounded-md px-2.5 py-1.5 text-[0.68rem] font-semibold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

      {message ? (
        <div
          className="theme-status-success mb-4 rounded-2xl px-4 py-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      {showBulkNaming && selectedRun ? (
        <BulkCallNameEditor
          kennelRunId={selectedRun.id}
          runName={selectedRun.name}
          dogs={runFilteredDogs}
          onClose={() => setShowBulkNaming(false)}
          onSaved={refreshAfterBulkNamingSave}
        />
      ) : null}

      <div className="theme-card mb-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="theme-heading text-sm font-semibold">
            Selection
          </div>
          <div className="theme-copy mt-1 text-xs">
            {selectedDogIds.length} selected
            {displayedDogs.length > 0
              ? `, ${selectedVisibleDogCount} visible under current filters`
              : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleVisibleSelection}
            disabled={displayedDogs.length === 0}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            {allFilteredDogsSelected ? "Deselect Visible" : "Select All Visible"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedDogIds.length === 0}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {selectedDogIds.length > 0 ? (
        <div className="theme-card mb-4 rounded-2xl p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="theme-heading text-sm font-semibold">
                {selectedDogIds.length} selected
              </div>
              <div className="theme-copy mt-1 text-xs">
                Choose a bulk action, then apply it.
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto]">
              <select
                value={bulkAction}
                onChange={(event) =>
                  updateBulkAction(event.target.value as BulkAction)
                }
                className="theme-control rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">Bulk action...</option>
                <option value="move-dogs">Move Dogs</option>
                <option value="health-tests">Health Tests...</option>
                <option value="brucellosis">Brucellosis Test</option>
                <option value="show-entry">Show Entry</option>
                <option value="rehome">Re-Home</option>
              </select>

              <button
                type="button"
                onClick={applyBulkAction}
                disabled={!canApplyBulkAction}
                className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {bulkAction === "show-entry"
                  ? "Continue"
                  : bulkActionLoading
                    ? "Updating..."
                    : "Apply Action"}
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Clear
              </button>
            </div>
          </div>

          {activeBulkWorkspace === "move-dogs" ? (
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="theme-heading text-sm font-semibold">
                    Move selected dogs
                  </div>
                  <div className="theme-copy mt-1 text-xs">
                    Selected: {selectedDogIds.length}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
                  <label className="grid gap-1.5">
                    <span className="theme-label text-[0.68rem] uppercase tracking-wide">
                      Move to
                    </span>
                    <select
                      value={selectedMoveRunId}
                      onChange={(event) => setSelectedMoveRunId(event.target.value)}
                      className="theme-control rounded-xl px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Choose Kennel Run...</option>
                      {runs.map((run) => (
                        <option key={run.id} value={run.id}>
                          {run.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={closeActiveBulkWorkspace}
                    disabled={moveDogsLoading}
                    className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 sm:self-end"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={moveSelectedDogs}
                    disabled={!canMoveSelectedDogs}
                    className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 sm:self-end"
                  >
                    {moveDogsLoading ? "Moving..." : "Move Dogs"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeBulkWorkspace === "health-tests" ? (
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="theme-heading text-sm font-semibold">
                    Health testing
                  </div>
                  <div className="theme-copy mt-1 text-xs">
                    Configure a read-only estimate for {selectedDogIds.length} selected dog
                    {selectedDogIds.length === 1 ? "" : "s"}.
                  </div>
                </div>

                <label className="theme-control flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={healthTestsAllApplicable}
                    disabled={healthTestExecutionLoading}
                    onChange={(event) => setHealthTestsAllApplicable(event.target.checked)}
                  />
                  All applicable
                </label>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {HEALTH_TEST_OPTIONS.map((test) => (
                    <label
                      key={test.code}
                      className="theme-control flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedHealthTestCodes.includes(test.code)}
                        disabled={healthTestsAllApplicable || healthTestExecutionLoading}
                        onChange={() => toggleHealthTestCode(test.code)}
                      />
                      {test.label}
                    </label>
                  ))}
                </div>

                {!healthTestsAllApplicable && selectedHealthTestCodes.length === 0 ? (
                  <div className="theme-copy text-sm">
                    Select at least one health test to calculate an estimate.
                  </div>
                ) : null}

                {healthTestPreviewLoading ? (
                  <div className="theme-copy text-sm" role="status" aria-live="polite">
                    Calculating health-test estimate...
                  </div>
                ) : null}

                {healthTestPreviewError ? (
                  <div className="theme-status-danger rounded-lg px-3 py-2 text-sm" role="status">
                    {healthTestPreviewError}
                  </div>
                ) : null}

                {healthTestExecutionLoading ? (
                  <div className="theme-copy text-sm" role="status" aria-live="polite">
                    Running health tests...
                  </div>
                ) : null}

                {healthTestExecutionError ? (
                  <div className="theme-status-danger rounded-lg px-3 py-2 text-sm" role="status">
                    {healthTestExecutionError}
                  </div>
                ) : null}

                {healthTestPreview ? (
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                    {healthTestPreview.runnableTestCount > 0 ? (
                      <div className="theme-heading text-sm font-semibold" role="status" aria-live="polite">
                        {healthTestPreview.eligibleDogCount.toLocaleString()} dog
                        {healthTestPreview.eligibleDogCount === 1 ? "" : "s"} eligible
                        {" · "}
                        {healthTestPreview.runnableTestCount.toLocaleString()} test
                        {healthTestPreview.runnableTestCount === 1 ? "" : "s"}
                        {" · "}
                        {formatMoney(healthTestPreview.estimatedTotalCost)}
                      </div>
                    ) : (
                      <div className="theme-copy text-sm" role="status" aria-live="polite">
                        No selected dogs currently need the chosen health tests.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setHealthTestDetailsExpanded((current) => !current)}
                      aria-expanded={healthTestDetailsExpanded}
                      aria-controls="bulk-health-test-preview-details"
                      className="theme-secondary-button mt-2 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                    >
                      {healthTestDetailsExpanded ? "Hide details" : "View details"}
                    </button>

                    {healthTestDetailsExpanded ? (
                      <div
                        id="bulk-health-test-preview-details"
                        className="theme-copy mt-3 grid gap-3 text-xs sm:grid-cols-2"
                      >
                        <div>
                          <div className="theme-label uppercase tracking-wide">Runnable tests</div>
                          <div className="mt-1 grid gap-1">
                            {HEALTH_TEST_OPTIONS.filter(
                              (test) => healthTestPreview.byTest[test.code].runnableCount > 0
                            ).map((test) => (
                              <div key={test.code}>
                                {test.label}: {healthTestPreview.byTest[test.code].runnableCount.toLocaleString()}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="theme-label uppercase tracking-wide">Skipped</div>
                          <div className="mt-1 grid gap-1">
                            {HEALTH_TEST_SKIP_LABELS.filter(
                              ({ reason }) => healthTestPreview.skippedByReason[reason] > 0
                            ).map(({ reason, label }) => (
                              <div key={reason}>
                                {label}: {healthTestPreview.skippedByReason[reason].toLocaleString()}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeActiveBulkWorkspace}
                    disabled={healthTestExecutionLoading}
                    className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={runBulkHealthTests}
                    disabled={!canRunHealthTests}
                    className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Run Health Tests
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeBulkWorkspace === "brucellosis" ? (
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="theme-heading text-sm font-semibold">
                    Brucellosis test selected dogs
                  </div>
                  <div className="theme-copy mt-1 text-xs">
                    Selected: {selectedDogIds.length.toLocaleString()}
                  </div>
                </div>

                {brucellosisPreviewLoading ? (
                  <div className="theme-copy text-sm" role="status" aria-live="polite">
                    Calculating brucellosis screening estimate...
                  </div>
                ) : null}

                {brucellosisPreviewError ? (
                  <div className="theme-status-danger rounded-lg px-3 py-2 text-sm" role="status">
                    {brucellosisPreviewError}
                  </div>
                ) : null}

                {brucellosisExecutionLoading ? (
                  <div className="theme-copy text-sm" role="status" aria-live="polite">
                    Running brucellosis screenings...
                  </div>
                ) : null}

                {brucellosisExecutionError ? (
                  <div className="theme-status-danger rounded-lg px-3 py-2 text-sm" role="status">
                    {brucellosisExecutionError}
                  </div>
                ) : null}

                {brucellosisPreview ? (
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                    {brucellosisPreview.screenableDogCount > 0 ? (
                      <div className="theme-heading text-sm font-semibold" role="status" aria-live="polite">
                        {brucellosisPreview.screenableDogCount.toLocaleString()} dog
                        {brucellosisPreview.screenableDogCount === 1 ? "" : "s"} will be tested
                        {" · "}
                        {brucellosisPreview.skippedDogCount.toLocaleString()} skipped
                        {" · "}
                        {formatMoney(brucellosisPreview.estimatedTotalCost)}
                      </div>
                    ) : (
                      <div className="theme-copy text-sm" role="status" aria-live="polite">
                        No selected dogs can currently be screened for brucellosis.
                      </div>
                    )}

                    {brucellosisPreview.skippedDogCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setBrucellosisDetailsExpanded((current) => !current)}
                        aria-expanded={brucellosisDetailsExpanded}
                        aria-controls="bulk-brucellosis-preview-details"
                        className="theme-secondary-button mt-2 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                      >
                        {brucellosisDetailsExpanded ? "Hide details" : "View details"}
                      </button>
                    ) : null}

                    {brucellosisDetailsExpanded ? (
                      <div
                        id="bulk-brucellosis-preview-details"
                        className="theme-copy mt-3 grid gap-1 text-xs"
                      >
                        {BRUCELLOSIS_SKIP_LABELS.filter(
                          ({ reason }) => brucellosisPreview.skippedByReason[reason] > 0
                        ).map(({ reason, label }) => (
                          <div key={reason}>
                            {label}: {brucellosisPreview.skippedByReason[reason].toLocaleString()}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeActiveBulkWorkspace}
                    disabled={brucellosisExecutionLoading}
                    className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={runBulkBrucellosisTests}
                    disabled={!canRunBrucellosisTests}
                    className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Run Brucellosis Tests
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {bulkAction === "rehome" && !canBulkRehome ? (
            <div className="theme-status-warning mt-3 rounded-xl px-4 py-3 text-sm">
              Only dogs at least 8 weeks old that are active and owned by your
              kennel can be re-homed in bulk. Sale and stud listings do not
              need to be removed first.
            </div>
          ) : null}

          {confirmingBulkAction && bulkAction === "rehome" ? (
            <div className="theme-status-danger mt-3 rounded-xl px-4 py-3">
              <div className="text-sm font-semibold">
                Re-home selected dogs?
              </div>
              <div className="mt-1 text-sm leading-6">
                This cannot be undone. The selected dogs, even if they are for
                sale or at stud, will leave your kennel and you will no longer
                be able to use them.
              </div>
              <div className="mt-2 text-sm">
                You are about to re-home {selectedDogIds.length} dog
                {selectedDogIds.length === 1 ? "" : "s"}.
              </div>
              {selectedRehomeCredits > 0 ? (
                <div className="mt-2 text-sm font-semibold">
                  Expected kennel ledger credit: $
                  {selectedRehomeCredits.toLocaleString()}.
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={rehomeSelectedDogs}
                  disabled={bulkActionLoading}
                  className="theme-status-danger rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {bulkActionLoading
                    ? "Re-Homing..."
                    : "Yes, Re-Home Selected Dogs"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingBulkAction(false)}
                  className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Keep Dogs
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading || runsLoading ? (
        <div className="theme-card theme-copy rounded-2xl px-4 py-6 text-sm">
          Loading kennel dogs...
        </div>
      ) : error ? (
        <div className="theme-status-danger rounded-2xl px-4 py-6 text-sm">
          {error}
        </div>
      ) : displayedDogs.length === 0 ? (
        <div className="theme-card theme-copy rounded-2xl px-4 py-6 text-sm">
          {runFilteredDogs.length === 0 && !filtersActive
            ? "This run is empty."
            : "No dogs match the current filters."}
        </div>
      ) : (
        <div className="overflow-x-auto pb-1 touch-pan-x">
          <table className="w-full min-w-[640px] table-auto border-separate border-spacing-y-2 text-sm">
            {visibleOptionalColumnCount > 0 ? (
              <caption className="theme-label mb-2 caption-top text-left text-xs uppercase tracking-[0.16em]">
                View options only change visible details.
              </caption>
            ) : null}
            <thead>
              <tr className="theme-label text-left text-xs uppercase tracking-[0.16em]">
                <th className="w-10 px-2 py-2">
                  <button
                    type="button"
                    onClick={toggleVisibleSelection}
                    className="text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
                  >
                    Select
                  </button>
                </th>
                <th className="w-[58px] px-2 py-2 text-center">Open</th>
                {visibleColumnDefinitions.map((column) => (
                  <th key={column.id} className="px-2 py-2">
                    {column.sortKey ? (
                      <SortButton
                        active={sortKey === column.sortKey}
                        direction={sortDirection}
                        onClick={() => toggleSort(column.sortKey!)}
                      >
                        {column.label}
                      </SortButton>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayedDogs.map((dog) => {
                const dogHref =
                  dog.kennelRunId && dog.currentRun?.id === dog.kennelRunId
                  ? `/dogs/${dog.dogId}?kennelRunId=${encodeURIComponent(dog.kennelRunId)}`
                  : `/dogs/${dog.dogId}`;
                const groomingBusy = groomingActionDogId === dog.dogId;
                const hasOpenGroomingListing = Boolean(
                  dog.groomingStatus.openListingId
                );
                const canUseGroomingAction =
                  (groomingSummary?.groomingActionsRemainingThisWeek ?? 0) > 0;
                const noGroomingActionsRemaining = !canUseGroomingAction;
                const isGroomingAgeEligible =
                  dog.ageHours >= MIN_GROOMING_AGE_HOURS;
                const groomDisabled =
                  !isGroomingAgeEligible ||
                  dog.groomingStatus.groomedThisWeek ||
                  hasOpenGroomingListing ||
                  !canUseGroomingAction ||
                  groomingBusy;
                const offerDisabled =
                  !isGroomingAgeEligible ||
                  dog.groomingStatus.groomedThisWeek ||
                  hasOpenGroomingListing ||
                  groomingBusy;
                const groomingAgeTitle = isGroomingAgeEligible
                  ? undefined
                  : "Dogs must be at least 12 weeks old before grooming.";
                const groomingCapacityTitle = noGroomingActionsRemaining
                  ? "No grooming actions remaining this week."
                  : undefined;
                const groomingSelfActionTitle =
                  groomingAgeTitle ?? groomingCapacityTitle;
                const groomingMenuTitle =
                  groomingAgeTitle ??
                  (noGroomingActionsRemaining && offerDisabled
                    ? groomingCapacityTitle
                    : undefined);
                const groomingMenuOpen = expandedGroomingDogId === dog.dogId;
                const groomingOfferConfirmOpen =
                  confirmingGroomingOfferDogId === dog.dogId;
                const groomingMenuDisabled = groomDisabled && offerDisabled;
                const groomingMenuId = `grooming-actions-${dog.dogId}`;
                const groomingMenuLabel =
                  noGroomingActionsRemaining && !offerDisabled
                    ? "Offer"
                    : "Groom";

                return (
                  <Fragment key={dog.dogId}>
                  <tr
                    className="theme-card-interactive transition focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                  >
                    <td className="rounded-l-2xl px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedDogIds.includes(dog.dogId)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onChange={() => toggleDogSelection(dog.dogId)}
                        aria-label={`Select ${getDogDisplayName(dog)}`}
                      />
                    </td>

                    <td className="px-2 py-2 text-center">
                      <Link
                        href={dogHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${dog.callName ?? dog.regNumber}`}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="theme-secondary-button inline-flex rounded-lg px-2 py-1 text-[0.68rem] font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                      >
                        Open
                      </Link>
                    </td>

                  {visibleColumnDefinitions.map((column) => {
                    const columnId = column.id;

                    switch (columnId) {
                      case "dog":
                        return (
                          <td
                            key={columnId}
                            className="theme-heading px-2 py-2 font-medium"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate">
                                {getDogDisplayName(dog)}
                              </span>
                              <DogStatusBadges
                                healthStatus={dog.healthBadgeStatus}
                                fullHealthClearance={dog.hasAllGreenHealthTests}
                                isListedForSale={dog.isListedForSale}
                                isListedAtStud={dog.isListedAtStud}
                                isPregnant={dog.breedingCardStatus.label === "Pregnant"}
                              />
                            </div>
                          </td>
                        );
                      case "breed":
                        return (
                          <td
                            key={columnId}
                            className="theme-heading px-2 py-2 font-medium"
                          >
                            <div className="truncate text-xs leading-4">
                              {dog.breedName}
                            </div>
                          </td>
                        );
                      case "sex":
                        return (
                          <td key={columnId} className="theme-heading px-2 py-2">
                            {dog.sex}
                          </td>
                        );
                      case "age":
                        return (
                          <td key={columnId} className="theme-heading px-2 py-2">
                            {formatAge(dog.ageHours)}
                          </td>
                        );
                      case "typeExpression":
                      case "structureBalance":
                      case "movement":
                      case "coatPresentation":
                      case "temperamentRingBehavior":
                      case "conditioningHandling":
                        return (
                          <td key={columnId} className="px-2 py-2">
                            <StatCell value={dog.visibleCategories[columnId] ?? 0} genetic={columnId !== "conditioningHandling"} />
                          </td>
                        );
                      case "currentRun":
                        return (
                          <td key={columnId} className="theme-copy px-2 py-2 text-xs">
                            {dog.currentRun?.name ?? "Uncategorized"}
                          </td>
                        );
                      case "titleStatus": {
                        const titleText = [
                          dog.visibleTitlePrefix,
                          dog.visibleTitleSuffix,
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <td key={columnId} className="theme-copy px-2 py-2 text-xs">
                            {titleText || "None"}
                          </td>
                        );
                      }
                      case "isListedForSale":
                        return (
                          <td key={columnId} className="theme-copy px-2 py-2 text-xs">
                            {dog.isListedForSale ? "Yes" : "No"}
                          </td>
                        );
                      case "isListedAtStud":
                        return (
                          <td key={columnId} className="theme-copy px-2 py-2 text-xs">
                            {dog.isListedAtStud ? "Yes" : "No"}
                          </td>
                        );
                      case "breedable":
                        return (
                          <td key={columnId} className="theme-copy px-2 py-2 text-xs">
                            {dog.breedingCardStatus.label === "Open" ||
                            dog.breedingCardStatus.label === "Available"
                              ? "Yes"
                              : "No"}
                          </td>
                        );
                      case "breedingStatus":
                        return (
                          <td key={columnId} className="theme-copy px-2 py-2 text-xs">
                            <div className="grid gap-1">
                              <div>{dog.breedingCardStatus.label}</div>
                              {dog.breedingCardStatus.detail ? (
                                <div className="theme-copy text-[0.68rem]">
                                  {dog.breedingCardStatus.detail}
                                </div>
                              ) : null}
                              {dog.breedingCardStatus.cooldownInHours !== null ? (
                                <div className="theme-copy text-[0.68rem]">
                                  Available to breed in{" "}
                                  {formatRealDurationHoursLong(
                                    dog.breedingCardStatus.cooldownInHours
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      case "healthStatus":
                        return (
                          <td key={columnId} className="theme-copy px-2 py-2 text-xs">
                            {dog.hasAllGreenHealthTests
                              ? "All green"
                              : dog.healthBadgeStatus ?? "Unknown"}
                          </td>
                        );
                      case "groomingStatus":
                        return (
                          <td key={columnId} className="px-2 py-2">
                            <div className="grid gap-1">
                              <div className="theme-copy truncate text-[0.68rem]">
                                {dog.groomingStatus.groomingStatusLabel}
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedGroomingDogId((current) =>
                                    current === dog.dogId ? null : dog.dogId
                                  );
                                  setConfirmingGroomingOfferDogId(null);
                                }}
                                onKeyDown={(event) => event.stopPropagation()}
                                disabled={groomingMenuDisabled}
                                title={groomingMenuTitle}
                                aria-expanded={groomingMenuOpen}
                                aria-controls={groomingMenuId}
                                className="theme-status-warning w-full rounded-lg px-2 py-1 text-[0.7rem] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                {groomingMenuLabel}
                              </button>
                              {groomingMenuOpen ? (
                                <div id={groomingMenuId} className="grid gap-1">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void runGroomingAction({
                                        dogId: dog.dogId,
                                        endpoint: "/api/services/grooming/self-groom",
                                      });
                                    }}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    disabled={groomDisabled}
                                    title={groomingSelfActionTitle}
                                    className="theme-status-warning w-full rounded-md px-2 py-1 text-[0.64rem] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                                  >
                                    {noGroomingActionsRemaining
                                      ? "No Grooming Left"
                                      : "Groom yourself"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setConfirmingGroomingOfferDogId(dog.dogId);
                                    }}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    disabled={offerDisabled}
                                    title={groomingAgeTitle}
                                    className="theme-status-info w-full rounded-md px-2 py-1 text-[0.64rem] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                                  >
                                    Offer for grooming
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
                  {groomingOfferConfirmOpen ? (
                    <tr className="theme-card">
                      <td
                        colSpan={rosterColumnCount}
                        className="rounded-2xl px-4 py-3"
                      >
                        <div className="theme-status-info rounded-xl p-3">
                          <div className="text-sm font-semibold">
                            Offer this dog for outside grooming?
                          </div>
                          <p className="mt-1 text-xs leading-5">
                            Offer {getDogDisplayName(dog)} for outside
                            grooming? This dog will be listed for another
                            player to groom.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void runGroomingAction({
                                  dogId: dog.dogId,
                                  endpoint: "/api/services/grooming/list",
                                });
                              }}
                              disabled={groomingBusy || offerDisabled}
                              className="theme-primary-button rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {groomingBusy
                                ? "Offering..."
                                : "Yes, Offer for Grooming"}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setConfirmingGroomingOfferDogId(null);
                              }}
                              disabled={groomingBusy}
                              className="theme-secondary-button rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Keep Dog Here
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </main>
      </div>
    </section>
  );
}
