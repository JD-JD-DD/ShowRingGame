"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import DogStatusBadges from "@/components/dogs/DogStatusBadges";
import { BreedSelectOptions } from "@/components/breeds/BreedSelectOptions";
import TraitLine from "@/components/ui/TraitLine";
import {
  getPhenotypeHealthBadgeStatus,
  getPhenotypeHealthSeverity,
  hasAllGreenPhenotypeHealthTests,
  type PhenotypeHealthSeverity,
} from "@/lib/dogHealth";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate } from "@/lib/gameClock";
import {
  BREEDING_FEE,
  BRUCELLOSIS_TEST_FEE,
  calculatePedigreeCoi,
  DAM_MAX_BREED_AGE_HOURS,
  GESTATION_HOURS,
  MIN_BREED_AGE_HOURS,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  PREG_CHECK_HOURS,
  WHELPING_COOLDOWN_HOURS,
  getPhenotypeHealthResultLabel,
  type PedigreeDog,
  type PhenotypeHealthTestCode,
} from "@showring/rules";

type VisibleCategories = Record<string, number>;

type HealthTest = {
  testTypeCode: string;
  resultCode: string;
};

type PlannerPedigreeDog = PedigreeDog & {
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
};

type DogCardDto = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  breedCode2: string;
  breedName: string;
  breedGroupName: string | null;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  lifecycleState: string;
  ownerKennelName: string | null;
  isOwnedByCurrentKennel: boolean;
  isListedForSale: boolean;
  isListedAtStud: boolean;
  isEligibleToBreed: boolean;
  inBreedingConflict: boolean;
  studListingId: string | null;
  studFeeAmount: number | null;
  brucellosisValidUntilEpoch: number | null;
  requiresBrucellosisNegativeDam: boolean;
  requiresDamHealthTestsCompleted: boolean;
  requiresDamHealthAllGreen: boolean;
  requiresDamHealthGreenOrYellow: boolean;
  requiresDamChampionTitle: boolean;
  coiPercent: number | null;
  lastLitterEpoch: number | null;
  healthTests: HealthTest[];
  visibleCategories: VisibleCategories;
};

type Props = {
  experience: "breed-dog" | "worksheet";
  returnMode: "damPage" | "stayOnPlanner";
  kennelId: string;
  kennelName: string;
  kennelBalance: number;
  currentEpoch: number;
  pedigree: PlannerPedigreeDog[];
  dogs: DogCardDto[];
  initialDogId: string | null;
  initialStudListingId: string | null;
};

type SireSource = "ALL" | "OWNED" | "PUBLIC";
type SireSort = "RECOMMENDED" | "LOWEST_COI" | "HEALTH" | "FEE";

const HEALTH_TONES: Record<PhenotypeHealthSeverity, string> = {
  green: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
  yellow: "border-amber-300/35 bg-amber-500/10 text-amber-100",
  red: "border-red-400/45 bg-red-500/15 font-bold text-red-200",
};

const TRAIT_NUMBER_TONES = {
  strong: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
  steady: "border-sky-300/30 bg-sky-500/10 text-sky-100",
  watch: "border-amber-300/35 bg-amber-500/10 text-amber-100",
  hardWatch: "border-red-400/35 bg-red-500/10 text-red-100",
};

function dogDisplayName(dog: DogCardDto) {
  return formatDogDisplayName(dog);
}

function ageLabel(ageHours: number) {
  const years = Math.floor(ageHours / 365);
  const days = ageHours % 365;

  if (years <= 0) return `${days} days`;
  return days > 0 ? `${years}y ${days}d` : `${years}y`;
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString()}`;
}

function formatGameDate(epoch: number) {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function brucellosisStatusLabel(dog: DogCardDto | null) {
  if (!dog) return "Select a dog";

  return dog.brucellosisValidUntilEpoch === null
    ? "No valid negative test"
    : `Negative through ${formatGameDate(dog.brucellosisValidUntilEpoch)}`;
}

function requiresDamBrucellosisTest(
  dam: DogCardDto | null,
  sire: DogCardDto | null
) {
  return Boolean(
    dam &&
      sire &&
      !sire.isOwnedByCurrentKennel &&
      sire.requiresBrucellosisNegativeDam &&
      dam.brucellosisValidUntilEpoch === null
  );
}

function shouldChargeDamBrucellosisTest(args: {
  dam: DogCardDto | null;
  sire: DogCardDto | null;
  testDamBrucellosis: boolean;
}) {
  if (!args.dam || args.dam.brucellosisValidUntilEpoch !== null) {
    return false;
  }

  return (
    args.testDamBrucellosis ||
    requiresDamBrucellosisTest(args.dam, args.sire)
  );
}

function shouldChargeSireBrucellosisTest(args: {
  sire: DogCardDto | null;
  testSireBrucellosis: boolean;
}) {
  return Boolean(
    args.sire &&
      args.sire.isOwnedByCurrentKennel &&
      args.sire.brucellosisValidUntilEpoch === null &&
      args.testSireBrucellosis
  );
}

function brucellosisTestCost(args: {
  dam: DogCardDto | null;
  sire: DogCardDto | null;
  testDamBrucellosis: boolean;
  testSireBrucellosis: boolean;
}) {
  return (
    (shouldChargeDamBrucellosisTest(args) ? BRUCELLOSIS_TEST_FEE : 0) +
    (shouldChargeSireBrucellosisTest(args) ? BRUCELLOSIS_TEST_FEE : 0)
  );
}

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function geneticVisibleCategoryEntries(categories: VisibleCategories) {
  return Object.entries(categories).filter(
    ([key]) => key !== "conditioningHandling"
  );
}

function geneticVisibleCategoryKeys(categories: VisibleCategories) {
  return geneticVisibleCategoryEntries(categories).map(([key]) => key);
}

function latestHealthTests(dog: DogCardDto) {
  return PHENOTYPE_HEALTH_TEST_CODES.map((testTypeCode) => ({
    testTypeCode,
    result:
      dog.healthTests.find((test) => test.testTypeCode === testTypeCode) ?? null,
  }));
}

function hasCompletedAllPhenotypeHealthTests(dog: DogCardDto) {
  const completedCodes = new Set(
    dog.healthTests.map((test) => test.testTypeCode)
  );

  return PHENOTYPE_HEALTH_TEST_CODES.every((testTypeCode) =>
    completedCodes.has(testTypeCode)
  );
}

function hasOnlyGreenOrYellowPhenotypeHealthTests(dog: DogCardDto) {
  return (
    hasCompletedAllPhenotypeHealthTests(dog) &&
    dog.healthTests.every(
      (test) =>
        getPhenotypeHealthSeverity(test.testTypeCode, test.resultCode) !== "red"
    )
  );
}

function isFinishedChampion(dog: DogCardDto) {
  return dog.visibleTitlePrefix === "CH" || dog.visibleTitleSuffix === "CH";
}

function studRequirementLabels(stud: DogCardDto) {
  const labels: string[] = [];

  if (stud.requiresBrucellosisNegativeDam) {
    labels.push("negative brucellosis test");
  }
  if (stud.requiresDamHealthTestsCompleted) {
    labels.push("all health tests completed");
  }
  if (stud.requiresDamHealthAllGreen) {
    labels.push("all-green health results");
  }
  if (stud.requiresDamHealthGreenOrYellow) {
    labels.push("no red health results");
  }
  if (stud.requiresDamChampionTitle) {
    labels.push("finished champion");
  }

  return labels;
}

function damMeetsStudRequirements(dam: DogCardDto | null, stud: DogCardDto) {
  if (stud.isOwnedByCurrentKennel || !dam) {
    return true;
  }

  if (
    stud.requiresDamHealthTestsCompleted &&
    !hasCompletedAllPhenotypeHealthTests(dam)
  ) {
    return false;
  }
  if (
    stud.requiresDamHealthAllGreen &&
    !hasAllGreenPhenotypeHealthTests(dam.healthTests)
  ) {
    return false;
  }
  if (
    stud.requiresDamHealthGreenOrYellow &&
    !hasOnlyGreenOrYellowPhenotypeHealthTests(dam)
  ) {
    return false;
  }
  if (stud.requiresDamChampionTitle && !isFinishedChampion(dam)) {
    return false;
  }

  return true;
}

function traitNumberTone(value: number) {
  const distance = Math.abs(value - 10);

  if (distance <= 1.5) return TRAIT_NUMBER_TONES.strong;
  if (distance <= 2.75) return TRAIT_NUMBER_TONES.steady;
  if (distance <= 4) return TRAIT_NUMBER_TONES.watch;
  return TRAIT_NUMBER_TONES.hardWatch;
}

function visibleTraitNotes(dog: DogCardDto) {
  const categories = geneticVisibleCategoryEntries(dog.visibleCategories)
    .map(([key, value]) => ({
      label: formatCategoryName(key),
      value,
      distance: Math.abs(value - 10),
    }))
    .sort((a, b) => a.distance - b.distance);
  const strengths = categories.slice(0, 2);
  const watchItems = [...categories]
    .sort((a, b) => b.distance - a.distance)
    .filter((category) => category.distance >= 1.5)
    .slice(0, 2);

  return {
    strengths,
    watchItems,
  };
}

function damCooldownSummary(dog: DogCardDto, currentEpoch: number) {
  if (dog.sex !== "F") return null;
  if (dog.lastLitterEpoch === null) return "Cooldown: no prior litter";

  const cooldownUntil = dog.lastLitterEpoch + WHELPING_COOLDOWN_HOURS;

  return cooldownUntil <= currentEpoch
    ? `Cooldown complete since ${formatGameDate(cooldownUntil)}`
    : `Cooldown until ${formatGameDate(cooldownUntil)}`;
}

function healthWarnings(dog: DogCardDto) {
  return latestHealthTests(dog).flatMap(({ testTypeCode, result }) => {
    const definition =
      PHENOTYPE_HEALTH_TESTS[testTypeCode as PhenotypeHealthTestCode];

    if (!result) {
      return [{
        label: `${dogDisplayName(dog)}: ${definition.label} not tested`,
        severity: "yellow" as const,
      }];
    }

    const severity = getPhenotypeHealthSeverity(
      result.testTypeCode,
      result.resultCode
    );

    if (severity === "green") return [];

    return [{
      label: `${dogDisplayName(dog)}: ${definition.label} ${getPhenotypeHealthResultLabel(
        testTypeCode as PhenotypeHealthTestCode,
        result.resultCode
      )}`,
      severity,
    }];
  });
}

function compactHealthSignals(dog: DogCardDto) {
  return latestHealthTests(dog).map(({ testTypeCode, result }) => {
    const definition =
      PHENOTYPE_HEALTH_TESTS[testTypeCode as PhenotypeHealthTestCode];
    const shortLabel = definition.label
      .replace(" Dysplasia", "")
      .replace("CAER Eye", "CAER");

    if (!result) {
      return {
        label: `${shortLabel}: not tested`,
        severity: "yellow" as const,
        isStrength: false,
      };
    }

    const severity = getPhenotypeHealthSeverity(
      result.testTypeCode,
      result.resultCode
    );

    return {
      label: `${shortLabel}: ${getPhenotypeHealthResultLabel(
        testTypeCode as PhenotypeHealthTestCode,
        result.resultCode
      )}`,
      severity,
      isStrength: severity === "green",
    };
  });
}

function reasonDogUnavailable(dog: DogCardDto, currentEpoch: number) {
  if (dog.lifecycleState !== "ALIVE") return "Not alive";
  if (dog.ageHours < MIN_BREED_AGE_HOURS) return "Too young to breed";
  if (dog.sex === "F" && dog.ageHours > DAM_MAX_BREED_AGE_HOURS) {
    return "Past dam breeding age";
  }
  if (
    dog.sex === "F" &&
    dog.lastLitterEpoch !== null &&
    currentEpoch < dog.lastLitterEpoch + WHELPING_COOLDOWN_HOURS
  ) {
    return `Post-whelp cooldown: ${
      dog.lastLitterEpoch + WHELPING_COOLDOWN_HOURS - currentEpoch
    } game days remaining`;
  }
  if (dog.inBreedingConflict) return "Already in breeding cycle";
  if (!dog.isEligibleToBreed) return "Not eligible";
  return null;
}

function pairingCoi(sire: DogCardDto | null, dam: DogCardDto | null, pedigree: PedigreeDog[]) {
  if (!sire || !dam) return null;

  return calculatePedigreeCoi({
    sireId: sire.id,
    damId: dam.id,
    pedigree,
  });
}

function ancestorIds(dogId: string, pedigree: PedigreeDog[]) {
  const pedigreeById = new Map(pedigree.map((dog) => [dog.id, dog]));
  const ancestors = new Set<string>();
  let currentIds = [dogId];

  for (let generation = 0; generation < 8 && currentIds.length > 0; generation += 1) {
    const nextIds = new Set<string>();

    for (const currentId of currentIds) {
      const dog = pedigreeById.get(currentId);

      if (!dog) continue;

      for (const parentId of [dog.sireId, dog.damId]) {
        if (parentId && !ancestors.has(parentId)) {
          ancestors.add(parentId);
          nextIds.add(parentId);
        }
      }
    }

    currentIds = [...nextIds];
  }

  return ancestors;
}

function sharedAncestorCount(sire: DogCardDto, dam: DogCardDto, pedigree: PedigreeDog[]) {
  const sireAncestors = ancestorIds(sire.id, pedigree);
  const damAncestors = ancestorIds(dam.id, pedigree);

  return [...sireAncestors].filter((ancestorId) => damAncestors.has(ancestorId))
    .length;
}

function sharedAncestorIds(
  sire: DogCardDto,
  dam: DogCardDto,
  pedigree: PedigreeDog[]
) {
  const sireAncestors = ancestorIds(sire.id, pedigree);
  const damAncestors = ancestorIds(dam.id, pedigree);

  return new Set(
    [...sireAncestors].filter((ancestorId) => damAncestors.has(ancestorId))
  );
}

function ancestorBranch(
  dogId: string,
  pedigree: PlannerPedigreeDog[],
  maxGenerations = 3
) {
  const pedigreeById = new Map(pedigree.map((dog) => [dog.id, dog]));
  const branch: Array<{ dog: PlannerPedigreeDog; generation: number }> = [];
  let currentIds = [dogId];

  for (
    let generation = 1;
    generation <= maxGenerations && currentIds.length > 0;
    generation += 1
  ) {
    const nextIds: string[] = [];

    for (const currentId of currentIds) {
      const dog = pedigreeById.get(currentId);

      if (!dog) continue;

      for (const parentId of [dog.sireId, dog.damId]) {
        const parent = parentId ? pedigreeById.get(parentId) : null;

        if (parent) {
          branch.push({ dog: parent, generation });
          nextIds.push(parent.id);
        }
      }
    }

    currentIds = nextIds;
  }

  return branch;
}

function coiTone(coiPercent: number | null) {
  if (coiPercent === null) return "text-purple-100/65";
  if (coiPercent <= 6.25) return "text-emerald-200";
  if (coiPercent <= 12.5) return "text-amber-200";
  return "font-bold text-red-200";
}

function coiLabel(coiPercent: number | null) {
  if (coiPercent === null) return "Pending";
  if (coiPercent <= 6.25) return "Lower COI";
  if (coiPercent <= 12.5) return "Moderate COI";
  return "Higher COI";
}

function complementCount(dam: DogCardDto | null, sire: DogCardDto) {
  if (!dam) return 0;

  return geneticVisibleCategoryKeys(dam.visibleCategories).filter((key) => {
    const damDistance = Math.abs((dam.visibleCategories[key] ?? 10) - 10);
    const sireDistance = Math.abs((sire.visibleCategories[key] ?? 10) - 10);
    return damDistance >= 2 && sireDistance < damDistance;
  }).length;
}

function sireRecommendationScore(
  sire: DogCardDto,
  dam: DogCardDto | null,
  pedigree: PedigreeDog[]
) {
  const coi = pairingCoi(sire, dam, pedigree)?.coiPercent ?? 0;
  const healthBonus = hasAllGreenPhenotypeHealthTests(sire.healthTests) ? 35 : 0;
  const coiScore = Math.max(0, 30 - coi * 2);
  const complementBonus = complementCount(dam, sire) * 4;
  const feePenalty = (sire.studFeeAmount ?? 0) / 500;

  return healthBonus + coiScore + complementBonus - feePenalty;
}

function DogName({ dog }: { dog: DogCardDto }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{dogDisplayName(dog)}</span>
      <DogStatusBadges
        healthStatus={getPhenotypeHealthBadgeStatus(dog.healthTests)}
        fullHealthClearance={hasAllGreenPhenotypeHealthTests(dog.healthTests)}
        isListedForSale={dog.isListedForSale}
        isListedAtStud={dog.isListedAtStud || Boolean(dog.studListingId)}
      />
    </div>
  );
}

function CompactHealthChips({
  dog,
  kind,
}: {
  dog: DogCardDto;
  kind: "strength" | "watch";
}) {
  const signals = compactHealthSignals(dog).filter((signal) =>
    kind === "strength" ? signal.isStrength : !signal.isStrength
  );

  if (signals.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {signals.map((signal) => (
        <span
          key={`${dog.id}-${kind}-${signal.label}`}
          className={`rounded-full border px-2 py-0.5 text-[0.66rem] font-semibold ${HEALTH_TONES[signal.severity]}`}
        >
          {signal.label}
        </span>
      ))}
    </div>
  );
}

function TraitNumberGrid({
  dog,
  columns = "sm:grid-cols-2",
}: {
  dog: DogCardDto;
  columns?: string;
}) {
  return (
    <div className={`grid gap-2 ${columns}`}>
      {geneticVisibleCategoryEntries(dog.visibleCategories).map(([key, value]) => (
        <div
          key={key}
          className={`rounded-xl border px-3 py-2 ${traitNumberTone(value)}`}
        >
          <div className="truncate text-[0.66rem] font-semibold uppercase tracking-[0.08em] opacity-80">
            {formatCategoryName(key)}
          </div>
          <div className="mt-1 text-xl font-bold leading-none">
            {value.toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DogOptionCard({
  dog,
  currentEpoch,
  selected,
  pairingDam,
  pedigree,
  shortlisted,
  onSelect,
  onToggleShortlist,
}: {
  dog: DogCardDto;
  currentEpoch: number;
  selected: boolean;
  pairingDam?: DogCardDto | null;
  pedigree: PedigreeDog[];
  shortlisted?: boolean;
  onSelect: () => void;
  onToggleShortlist?: () => void;
}) {
  const unavailable = reasonDogUnavailable(dog, currentEpoch);
  const projectedCoi =
    dog.sex === "M" && pairingDam ? pairingCoi(dog, pairingDam, pedigree) : null;
  const traitNotes = visibleTraitNotes(dog);
  const cooldownSummary = damCooldownSummary(dog, currentEpoch);

  return (
    <article
      className={`rounded-2xl border p-4 transition ${
        selected
          ? "border-fuchsia-200/80 bg-[linear-gradient(135deg,rgba(168,85,247,0.34),rgba(14,165,233,0.18))] shadow-[0_0_28px_rgba(192,132,252,0.22)] ring-1 ring-fuchsia-200/45"
          : unavailable
            ? "border-white/10 bg-black/15 opacity-70"
            : "border-purple-300/25 bg-[linear-gradient(145deg,rgba(49,24,74,0.9),rgba(17,24,39,0.78))] shadow-[0_14px_34px_rgba(0,0,0,0.2)] hover:border-fuchsia-200/65 hover:shadow-[0_0_24px_rgba(192,132,252,0.16)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-white">
            <DogName dog={dog} />
          </div>
          <div className="mt-1 text-xs text-purple-100/55">{dog.regNumber}</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.68rem] font-semibold text-purple-100/75">
          {dog.isOwnedByCurrentKennel ? "My Kennel" : "Outside Stud"}
        </span>
      </div>

      <div className="mt-3 grid gap-1 text-xs text-purple-100/70 sm:grid-cols-2">
        <span>Age: {ageLabel(dog.ageHours)}</span>
        <span className={coiTone(dog.coiPercent)}>
          Dog COI: {dog.coiPercent === null ? "Pending" : `${dog.coiPercent.toFixed(2)}%`}
        </span>
        {!dog.isOwnedByCurrentKennel ? (
          <>
            <span>Owner: {dog.ownerKennelName ?? "Player Kennel"}</span>
            <span>Stud fee: {formatMoney(dog.studFeeAmount ?? 0)}</span>
            <span>Brucellosis: {brucellosisStatusLabel(dog)}</span>
            {studRequirementLabels(dog).length > 0 ? (
              <span>
                Bitch minimums: {studRequirementLabels(dog).join(", ")}
              </span>
            ) : null}
          </>
        ) : null}
        {projectedCoi ? (
          <span className={coiTone(projectedCoi.coiPercent)}>
            Litter COI: {projectedCoi.coiPercent.toFixed(2)}%
          </span>
        ) : null}
        {dog.sex === "F" && dog.lastLitterEpoch !== null ? (
          <span>Last litter: {formatGameDate(dog.lastLitterEpoch)}</span>
        ) : null}
        {cooldownSummary ? <span>{cooldownSummary}</span> : null}
      </div>

      <div className="mt-4 rounded-2xl border border-fuchsia-300/20 bg-[linear-gradient(135deg,rgba(168,85,247,0.16),rgba(14,165,233,0.08))] p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-100">
            Visible Show Traits
          </div>
          <div className="text-[0.68rem] text-purple-100/55">
            10 is ideal
          </div>
        </div>
        <TraitNumberGrid dog={dog} />
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/15 p-3 text-xs sm:grid-cols-2">
        <div>
          <div className="font-semibold uppercase tracking-wide text-emerald-200">
            Visible Strengths
          </div>
          <div className="mt-1 text-purple-100/70">
            {traitNotes.strengths
              .map((category) => `${category.label} ${category.value.toFixed(1)}`)
              .join(" · ")}
          </div>
          <CompactHealthChips dog={dog} kind="strength" />
        </div>
        <div>
          <div className="font-semibold uppercase tracking-wide text-amber-200">
            Watch Areas
          </div>
          <div className="mt-1 text-purple-100/70">
            {traitNotes.watchItems.length > 0
              ? traitNotes.watchItems
                  .map((category) => `${category.label} ${category.value.toFixed(1)}`)
                  .join(" · ")
              : "No pronounced visible watch areas"}
          </div>
          <CompactHealthChips dog={dog} kind="watch" />
        </div>
      </div>

      {unavailable ? (
        <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">
          {unavailable}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelect}
          disabled={Boolean(unavailable)}
          className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selected ? "Selected" : "Select"}
        </button>
        {onToggleShortlist ? (
          <button
            type="button"
            onClick={onToggleShortlist}
            className="rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20"
          >
            {shortlisted ? "Unpin" : "Compare"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MiniTraitSummary({ dog }: { dog: DogCardDto }) {
  return (
    <div className="space-y-3">
      {geneticVisibleCategoryEntries(dog.visibleCategories).map(([key, value]) => (
        <TraitLine
          key={key}
          label={formatCategoryName(key)}
          value={value}
          min={0}
          max={20}
          ideal={10}
          leftLabel="0"
          rightLabel="20"
        />
      ))}
    </div>
  );
}

function FreeAnchorCard({ dog }: { dog: DogCardDto }) {
  return (
    <section className="rounded-2xl border border-purple-300/30 bg-[linear-gradient(180deg,rgba(42,22,58,0.98),rgba(20,10,30,0.98))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.35)] lg:sticky lg:top-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
        Selected Dog
      </div>
      <div className="mt-3 font-semibold text-white">
        <DogName dog={dog} />
      </div>
      <div className="mt-1 text-xs text-purple-100/55">{dog.regNumber}</div>
      <div className="mt-3 grid gap-1 text-xs text-purple-100/70">
        <span>{dog.breedName}</span>
        <span>Age: {ageLabel(dog.ageHours)}</span>
        {!dog.isOwnedByCurrentKennel ? (
          <>
            <span>Owner: {dog.ownerKennelName ?? "Player Kennel"}</span>
            <span>Stud fee: {formatMoney(dog.studFeeAmount ?? 0)}</span>
          </>
        ) : null}
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <MiniTraitSummary dog={dog} />
      </div>
    </section>
  );
}

function FreeMateCard({
  dog,
  selected,
  onSelect,
}: {
  dog: DogCardDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const outsideKennel = !dog.isOwnedByCurrentKennel;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? outsideKennel
            ? "border-sky-200/70 bg-sky-500/25"
            : "border-purple-300/70 bg-purple-500/20"
          : outsideKennel
            ? "border-sky-300/35 bg-sky-500/10 hover:border-sky-200/65 hover:bg-sky-500/15"
            : "border-white/10 bg-black/20 hover:border-purple-300/45"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">
            <DogName dog={dog} />
          </div>
          <div className="mt-1 text-xs text-purple-100/55">{dog.regNumber}</div>
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-[0.68rem] font-semibold ${
            outsideKennel
              ? "border-sky-300/35 bg-sky-500/10 text-sky-100"
              : "border-white/10 bg-white/5 text-purple-100/75"
          }`}
        >
          {outsideKennel ? "Outside Stud" : "My Kennel"}
        </span>
      </div>
      <div className="mt-3 grid gap-1 text-xs text-purple-100/70 sm:grid-cols-2">
        <span>Age: {ageLabel(dog.ageHours)}</span>
        {outsideKennel ? (
          <span>Stud fee: {formatMoney(dog.studFeeAmount ?? 0)}</span>
        ) : null}
        {dog.sex === "M" ? (
          <span>Brucellosis: {brucellosisStatusLabel(dog)}</span>
        ) : null}
        {outsideKennel && studRequirementLabels(dog).length > 0 ? (
          <span>Bitch minimums: {studRequirementLabels(dog).join(", ")}</span>
        ) : null}
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
        <MiniTraitSummary dog={dog} />
      </div>
    </button>
  );
}

function FreeBreedingSummary({
  kennelBalance,
  sire,
  dam,
  testDamBrucellosis,
  testSireBrucellosis,
  onTestDamBrucellosisChange,
  onTestSireBrucellosisChange,
  submitting,
  redirecting,
  errorMessage,
  successMessage,
  onSubmit,
}: {
  kennelBalance: number;
  sire: DogCardDto | null;
  dam: DogCardDto | null;
  testDamBrucellosis: boolean;
  testSireBrucellosis: boolean;
  onTestDamBrucellosisChange: (checked: boolean) => void;
  onTestSireBrucellosisChange: (checked: boolean) => void;
  submitting: boolean;
  redirecting: boolean;
  errorMessage: string;
  successMessage: string;
  onSubmit: () => void;
}) {
  const diseaseTestCost = brucellosisTestCost({
    dam,
    sire,
    testDamBrucellosis,
    testSireBrucellosis,
  });
  const totalCost = BREEDING_FEE + (sire?.studFeeAmount ?? 0) + diseaseTestCost;
  const damTestRequired = requiresDamBrucellosisTest(dam, sire);
  const canSubmit =
    sire !== null &&
    dam !== null &&
    kennelBalance >= totalCost &&
    !submitting &&
    !redirecting;

  return (
    <aside className="rounded-2xl border border-purple-300/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] lg:sticky lg:top-4">
      <h2 className="text-xl font-semibold text-white">Breeding Summary</h2>
      <div className="mt-4 space-y-3 text-sm">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs uppercase tracking-wide text-purple-200">Sire</div>
          <div className="mt-1 font-semibold text-white">
            {sire ? dogDisplayName(sire) : "Select a sire"}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs uppercase tracking-wide text-purple-200">Dam</div>
          <div className="mt-1 font-semibold text-white">
            {dam ? dogDisplayName(dam) : "Select a dam"}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-purple-100/75">
          <div className="flex justify-between gap-3">
            <span>Breeding fee</span><span>{formatMoney(BREEDING_FEE)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span>Stud fee</span><span>{formatMoney(sire?.studFeeAmount ?? 0)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span>Brucellosis tests</span><span>{formatMoney(diseaseTestCost)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3 border-t border-white/10 pt-2 font-semibold text-white">
            <span>Total</span><span>{formatMoney(totalCost)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span>Balance after</span><span>{formatMoney(kennelBalance - totalCost)}</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-purple-100/70">
          <div className="mb-3 font-semibold text-white">Brucellosis testing</div>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={
                damTestRequired ||
                (testDamBrucellosis &&
                  dam !== null &&
                  dam.brucellosisValidUntilEpoch === null)
              }
              disabled={
                dam === null ||
                dam.brucellosisValidUntilEpoch !== null ||
                damTestRequired
              }
              onChange={(event) =>
                onTestDamBrucellosisChange(event.target.checked)
              }
            />
            <span>
              Test dam ({formatMoney(BRUCELLOSIS_TEST_FEE)}) -{" "}
              {brucellosisStatusLabel(dam)}
              {damTestRequired ? " - required by stud owner" : ""}
            </span>
          </label>
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              checked={
                testSireBrucellosis &&
                sire !== null &&
                sire.isOwnedByCurrentKennel &&
                sire.brucellosisValidUntilEpoch === null
              }
              disabled={
                sire === null ||
                !sire.isOwnedByCurrentKennel ||
                sire.brucellosisValidUntilEpoch !== null
              }
              onChange={(event) =>
                onTestSireBrucellosisChange(event.target.checked)
              }
            />
            <span>
              Test sire ({formatMoney(BRUCELLOSIS_TEST_FEE)}) -{" "}
              {brucellosisStatusLabel(sire)}
              {sire && !sire.isOwnedByCurrentKennel
                ? " - outside stud owner controls sire testing"
                : ""}
            </span>
          </label>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-purple-100/70">
          Pregnancy check in about {PREG_CHECK_HOURS} game days. Expected litter
          in about {GESTATION_HOURS} game days.
        </div>
        {errorMessage ? (
          <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {successMessage}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {redirecting
            ? "Confirmed"
            : submitting
              ? "Creating Breeding..."
              : "Confirm Breeding"}
        </button>
      </div>
    </aside>
  );
}

function TraitOutlook({ dam, sire }: { dam: DogCardDto; sire: DogCardDto }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.14em] text-purple-200/70">
            <th className="px-3 py-2">Visible Category</th>
            <th className="px-3 py-2 text-right">Dam</th>
            <th className="px-3 py-2 text-right">Sire</th>
            <th className="px-3 py-2 text-right">Estimated Puppy Range</th>
            <th className="px-3 py-2">Outlook</th>
          </tr>
        </thead>
        <tbody>
          {geneticVisibleCategoryEntries(dam.visibleCategories).map(([key, damValue]) => {
            const sireValue = sire.visibleCategories[key] ?? damValue;
            const midpoint = (damValue + sireValue) / 2;
            const low = Math.max(0, midpoint - 2);
            const high = Math.min(20, midpoint + 2);
            const parentBest = Math.min(
              Math.abs(damValue - 10),
              Math.abs(sireValue - 10)
            );
            const outlook =
              Math.abs(midpoint - 10) <= 1.5
                ? "Likely strength"
                : parentBest < Math.abs(damValue - 10)
                  ? "Sire complements dam"
                  : Math.abs(damValue - sireValue) >= 4
                    ? "Variable"
                    : "Watch closely";

            return (
              <tr key={key} className="border-t border-white/10">
                <td className="px-3 py-2 text-purple-100/80">
                  {formatCategoryName(key)}
                </td>
                <td className="px-3 py-2 text-right text-white">
                  {damValue.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right text-white">
                  {sireValue.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-100">
                  {low.toFixed(1)} - {high.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-purple-100/70">{outlook}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-5 text-purple-100/50">
        Puppy ranges are planning estimates from visible parental categories.
        Individual puppies still vary.
      </p>
    </div>
  );
}

function PairingParentSnapshot({
  label,
  dog,
}: {
  label: string;
  dog: DogCardDto;
}) {
  const traitNotes = visibleTraitNotes(dog);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-wide text-purple-200">
        {label}
      </div>
      <div className="mt-2 font-semibold text-white">
        <DogName dog={dog} />
      </div>
      <div className="mt-3 rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/5 p-3">
        <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-fuchsia-100">
          Visible Trait Numbers
        </div>
        <TraitNumberGrid dog={dog} columns="sm:grid-cols-2 xl:grid-cols-3" />
      </div>
      <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/15 p-3 text-xs sm:grid-cols-2">
        <div>
          <div className="font-semibold uppercase tracking-wide text-emerald-200">
            Strengths
          </div>
          <div className="mt-1 text-purple-100/70">
            {traitNotes.strengths
              .map((category) => `${category.label} ${category.value.toFixed(1)}`)
              .join(" · ")}
          </div>
          <CompactHealthChips dog={dog} kind="strength" />
        </div>
        <div>
          <div className="font-semibold uppercase tracking-wide text-amber-200">
            Watch
          </div>
          <div className="mt-1 text-purple-100/70">
            {traitNotes.watchItems.length > 0
              ? traitNotes.watchItems
                  .map((category) => `${category.label} ${category.value.toFixed(1)}`)
                  .join(" · ")
              : "No pronounced visible watch areas"}
          </div>
          <CompactHealthChips dog={dog} kind="watch" />
        </div>
      </div>
    </div>
  );
}

function CompactPedigreePreview({
  dam,
  sire,
  pedigree,
}: {
  dam: DogCardDto;
  sire: DogCardDto;
  pedigree: PlannerPedigreeDog[];
}) {
  const sharedIds = sharedAncestorIds(sire, dam, pedigree);
  const pedigreeById = new Map(pedigree.map((dog) => [dog.id, dog]));
  const sharedAncestors = [...sharedIds]
    .map((ancestorId) => pedigreeById.get(ancestorId))
    .filter((dog): dog is PlannerPedigreeDog => Boolean(dog));
  const branches = [
    { label: "Sire Branch", dogs: ancestorBranch(sire.id, pedigree) },
    { label: "Dam Branch", dogs: ancestorBranch(dam.id, pedigree) },
  ];

  return (
    <div className="mt-4">
      {sharedAncestors.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {sharedAncestors.map((dog) => (
            <div
              key={dog.id}
              className="rounded-full border border-amber-300/65 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100"
            >
              Shared: {formatDogDisplayName(dog)}
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-4 text-xs font-semibold text-emerald-200">
          No shared ancestors found in the calculated pedigree.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {branches.map((branch) => (
        <div
          key={branch.label}
          className="rounded-xl border border-white/10 bg-black/15 p-3"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">
            {branch.label}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {branch.dogs.length > 0 ? (
              branch.dogs.map(({ dog, generation }, index) => {
                const shared = sharedIds.has(dog.id);

                return (
                  <div
                    key={`${branch.label}-${dog.id}-${generation}-${index}`}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      shared
                        ? "border-amber-300/65 bg-amber-500/15 text-amber-100"
                        : "border-white/10 bg-white/5 text-purple-100/70"
                    }`}
                  >
                    <div className="font-semibold">
                      {formatDogDisplayName(dog)}
                    </div>
                    <div className="mt-1 text-[0.68rem] opacity-75">
                      Generation {generation}
                      {shared ? " · Shared ancestor" : ""}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-purple-100/55">
                No recorded ancestors in this branch.
              </div>
            )}
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}

function PairingAnalysis({
  kennelBalance,
  currentEpoch,
  dam,
  sire,
  pedigree,
  testDamBrucellosis,
  testSireBrucellosis,
  onTestDamBrucellosisChange,
  onTestSireBrucellosisChange,
  submitting,
  redirecting,
  errorMessage,
  successMessage,
  onSubmit,
}: {
  kennelBalance: number;
  currentEpoch: number;
  dam: DogCardDto;
  sire: DogCardDto;
  pedigree: PlannerPedigreeDog[];
  testDamBrucellosis: boolean;
  testSireBrucellosis: boolean;
  onTestDamBrucellosisChange: (checked: boolean) => void;
  onTestSireBrucellosisChange: (checked: boolean) => void;
  submitting: boolean;
  redirecting: boolean;
  errorMessage: string;
  successMessage: string;
  onSubmit: () => void;
}) {
  const coi = pairingCoi(sire, dam, pedigree);
  const diseaseTestCost = brucellosisTestCost({
    dam,
    sire,
    testDamBrucellosis,
    testSireBrucellosis,
  });
  const totalCost = BREEDING_FEE + (sire.studFeeAmount ?? 0) + diseaseTestCost;
  const damTestRequired = requiresDamBrucellosisTest(dam, sire);
  const bothHealthClear =
    hasAllGreenPhenotypeHealthTests(dam.healthTests) &&
    hasAllGreenPhenotypeHealthTests(sire.healthTests);
  const sharedAncestors = sharedAncestorCount(sire, dam, pedigree);
  const healthConcerns = [...healthWarnings(dam), ...healthWarnings(sire)];
  const hasRedHealthConcern = healthConcerns.some(
    (concern) => concern.severity === "red"
  );
  const pregCheckEpoch = currentEpoch + PREG_CHECK_HOURS;
  const expectedLitterEpoch = currentEpoch + GESTATION_HOURS;
  const projectedCooldownUntil = expectedLitterEpoch + WHELPING_COOLDOWN_HOURS;
  const cues = [
    {
      label: coiLabel(coi?.coiPercent ?? null),
      tone: coiTone(coi?.coiPercent ?? null),
    },
    {
      label:
        sharedAncestors === 0
          ? "No shared ancestors found in the calculated pedigree"
          : `${sharedAncestors} shared ancestor${sharedAncestors === 1 ? "" : "s"} found in the calculated pedigree`,
      tone: sharedAncestors === 0 ? "text-emerald-200" : "text-amber-200",
    },
    {
      label: bothHealthClear
        ? "Both parents have all-green phenotype tests"
        : "Review health results before confirming",
      tone: bothHealthClear ? "text-emerald-200" : "text-amber-200",
    },
    {
      label: `${complementCount(dam, sire)} visible trait categories complemented by sire`,
      tone: "text-sky-100",
    },
    {
      label: sire.isOwnedByCurrentKennel
        ? "Owned sire: no stud fee"
        : `Public stud fee: ${formatMoney(sire.studFeeAmount ?? 0)}`,
      tone: "text-purple-100/80",
    },
  ];

  return (
    <section className="mt-8 rounded-[28px] border border-fuchsia-300/45 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_36%),linear-gradient(180deg,rgba(66,30,94,0.98),rgba(20,10,30,0.98))] p-6 shadow-[0_0_42px_rgba(192,132,252,0.14),0_22px_60px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
            Step 3
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Pairing Preview
          </h2>
          <p className="mt-2 text-sm text-purple-100/70">
            Review the litter plan before confirming the breeding.
          </p>
        </div>
        <div className={`text-right ${coiTone(coi?.coiPercent ?? null)}`}>
          <div className="text-xs uppercase tracking-wide">Estimated litter COI</div>
          <div className="mt-1 text-3xl font-bold">
            {coi ? `${coi.coiPercent.toFixed(2)}%` : "Pending"}
          </div>
          {coi ? (
            <div className="text-xs">
              Calculated through {coi.generationDepth} generation
              {coi.generationDepth === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
        <PairingParentSnapshot label="Dam" dog={dam} />
        <PairingParentSnapshot label="Sire" dog={sire} />
        <aside className="rounded-2xl border border-purple-300/20 bg-white/5 p-4">
          <h3 className="font-semibold text-white">Plan Summary</h3>
          <div className="mt-4 space-y-2 text-sm text-purple-100/75">
            <div className="flex justify-between gap-3">
              <span>Breeding fee</span><span>{formatMoney(BREEDING_FEE)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Stud fee</span><span>{formatMoney(sire.studFeeAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Brucellosis tests</span><span>{formatMoney(diseaseTestCost)}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-2 font-semibold text-white">
              <span>Total</span><span>{formatMoney(totalCost)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Balance after</span>
              <span>{formatMoney(kennelBalance - totalCost)}</span>
            </div>
            <div className="border-t border-white/10 pt-2">
              Estimated pregnancy check: {formatGameDate(pregCheckEpoch)}
            </div>
            <div>Estimated litter due: {formatGameDate(expectedLitterEpoch)}</div>
            <div>
              Dam may breed again after: {formatGameDate(projectedCooldownUntil)}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-purple-100/70">
            <div className="mb-3 font-semibold text-white">
              Brucellosis testing
            </div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={
                  damTestRequired ||
                  (testDamBrucellosis &&
                    dam.brucellosisValidUntilEpoch === null)
                }
                disabled={
                  dam.brucellosisValidUntilEpoch !== null || damTestRequired
                }
                onChange={(event) =>
                  onTestDamBrucellosisChange(event.target.checked)
                }
              />
              <span>
                Test dam ({formatMoney(BRUCELLOSIS_TEST_FEE)}) -{" "}
                {brucellosisStatusLabel(dam)}
                {damTestRequired ? " - required by stud owner" : ""}
              </span>
            </label>
            <label className="mt-2 flex items-start gap-2">
              <input
                type="checkbox"
                checked={
                  testSireBrucellosis &&
                  sire.isOwnedByCurrentKennel &&
                  sire.brucellosisValidUntilEpoch === null
                }
                disabled={
                  !sire.isOwnedByCurrentKennel ||
                  sire.brucellosisValidUntilEpoch !== null
                }
                onChange={(event) =>
                  onTestSireBrucellosisChange(event.target.checked)
                }
              />
              <span>
                Test sire ({formatMoney(BRUCELLOSIS_TEST_FEE)}) -{" "}
                {brucellosisStatusLabel(sire)}
                {!sire.isOwnedByCurrentKennel
                  ? " - outside stud owner controls sire testing"
                  : ""}
              </span>
            </label>
            {sire.requiresBrucellosisNegativeDam ? (
              <div className="mt-2 font-semibold text-sky-100">
                This stud owner requires a negative bitch test.
              </div>
            ) : null}
          </div>

        </aside>
      </div>

      {healthConcerns.length > 0 ? (
        <div
          className={`mt-6 rounded-2xl border p-4 ${
            hasRedHealthConcern
              ? "border-red-400/55 bg-red-500/15"
              : "border-amber-300/45 bg-amber-500/10"
          }`}
        >
          <h3
            className={`font-bold ${
              hasRedHealthConcern ? "text-red-100" : "text-amber-100"
            }`}
          >
            Health Review Recommended
          </h3>
          <div className="mt-2 grid gap-1 text-sm">
            {healthConcerns.map((concern) => (
              <div
                key={concern.label}
                className={
                  concern.severity === "red"
                    ? "font-bold text-red-100"
                    : "text-amber-100"
                }
              >
                {concern.label}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-300/35 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100">
          Both parents have complete all-green phenotype health tests.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="font-semibold text-white">Planning Notes</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {cues.map((cue) => (
            <div key={cue.label} className={`text-sm ${cue.tone}`}>
              {cue.label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="font-semibold text-white">Compact Pedigree Preview</h3>
        <p className="mt-2 text-xs leading-5 text-purple-100/60">
          Shared ancestors are highlighted in amber for a quick relationship
          review.
        </p>
        <CompactPedigreePreview dam={dam} sire={sire} pedigree={pedigree} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="font-semibold text-white">Visible Trait Outlook</h3>
        <TraitOutlook dam={dam} sire={sire} />
      </div>

      <div className="mt-6 rounded-2xl border border-fuchsia-300/30 bg-white/5 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
        <h3 className="font-semibold text-white">Final Confirmation</h3>
        <p className="mt-2 text-sm text-purple-100/70">
          You have reviewed the pairing preview, health notes, pedigree, and
          visible trait outlook. Confirm the litter plan when you are ready to
          proceed.
        </p>

        <div className="mt-4 grid gap-3 text-sm text-purple-100/75 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-purple-200/75">
              Dam
            </div>
            <div className="mt-2 font-semibold text-white">
              <DogName dog={dam} />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-purple-200/75">
              Sire
            </div>
            <div className="mt-2 font-semibold text-white">
              <DogName dog={sire} />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-purple-200/75">
              Total Cost
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {formatMoney(totalCost)}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-purple-200/75">
              Balance After
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {formatMoney(kennelBalance - totalCost)}
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {successMessage}
          </div>
        ) : null}

        {/* Keep the actual breeding submit at the end of the worksheet so the
            user reaches it only after the full review pass above. */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || redirecting || kennelBalance < totalCost}
          className="mt-5 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {redirecting
            ? "Confirmed"
            : submitting
              ? "Creating Breeding..."
              : "Confirm Litter Plan"}
        </button>
      </div>
    </section>
  );
}

function Shortlist({
  dam,
  sires,
  pedigree,
}: {
  dam: DogCardDto | null;
  sires: DogCardDto[];
  pedigree: PedigreeDog[];
}) {
  if (!dam || sires.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-sky-300/20 bg-sky-500/5 p-4">
      <h3 className="font-semibold text-white">Pinned Sire Comparison</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-purple-200/70">
              <th className="px-3 py-2">Sire</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2 text-right">Litter COI</th>
              <th className="px-3 py-2 text-right">Stud Fee</th>
              <th className="px-3 py-2 text-right">Complements</th>
            </tr>
          </thead>
          <tbody>
            {sires.map((sire) => {
              const coi = pairingCoi(sire, dam, pedigree);

              return (
                <tr key={sire.id} className="border-t border-white/10">
                  <td className="px-3 py-2 font-semibold text-white">
                    <DogName dog={sire} />
                  </td>
                  <td className="px-3 py-2 text-purple-100/70">
                    {sire.isOwnedByCurrentKennel ? "My Kennel" : "Outside Stud"}
                  </td>
                  <td className={`px-3 py-2 text-right ${coiTone(coi?.coiPercent ?? null)}`}>
                    {coi ? `${coi.coiPercent.toFixed(2)}%` : "Pending"}
                  </td>
                  <td className="px-3 py-2 text-right text-purple-100/80">
                    {formatMoney(sire.studFeeAmount ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-sky-100">
                    {complementCount(dam, sire)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function BreedPageClient({
  experience,
  returnMode,
  kennelName,
  kennelBalance,
  currentEpoch,
  pedigree,
  dogs,
  initialDogId,
  initialStudListingId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const effectiveReturnMode =
    pathname === "/plan-a-litter" ? "stayOnPlanner" : returnMode;
  const initialDog =
    dogs.find(
      (dog) =>
        dog.id === initialDogId &&
        dog.isOwnedByCurrentKennel &&
        dog.isEligibleToBreed
    ) ??
    null;
  const initialStud =
    dogs.find(
      (dog) =>
        dog.studListingId === initialStudListingId && dog.isEligibleToBreed
    ) ?? null;
  const anchorDog = initialDog ?? initialStud;
  const initialBreedCode =
    experience === "worksheet"
      ? ""
      : initialDog?.breedCode2 ?? initialStud?.breedCode2 ?? "";
  const [breedCode2, setBreedCode2] = useState(initialBreedCode);
  const [damId, setDamId] = useState(
    experience === "worksheet" ? "" : initialDog?.sex === "F" ? initialDog.id : ""
  );
  const [sireId, setSireId] = useState(
    experience === "worksheet"
      ? ""
      : initialDog?.sex === "M"
        ? initialDog.id
        : initialStud?.id ?? ""
  );
  const [sireSource, setSireSource] = useState<SireSource>("ALL");
  const [sireSort, setSireSort] = useState<SireSort>("RECOMMENDED");
  const [shortlistedSireIds, setShortlistedSireIds] = useState<string[]>([]);
  const [testDamBrucellosis, setTestDamBrucellosis] = useState(false);
  const [testSireBrucellosis, setTestSireBrucellosis] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const submitInFlightRef = useRef(false);
  const eligibleDogs = useMemo(
    () => dogs.filter((dog) => dog.isEligibleToBreed),
    [dogs]
  );

  const breeds = useMemo(() => {
    const breedByCode = new Map<
      string,
      { code2: string; name: string; groupName: string | null }
    >();

    for (const dog of eligibleDogs) {
      if (dog.isOwnedByCurrentKennel && dog.sex === "F") {
        breedByCode.set(dog.breedCode2, {
          code2: dog.breedCode2,
          name: dog.breedName,
          groupName: dog.breedGroupName,
        });
      }
    }

    return [...breedByCode.values()];
  }, [eligibleDogs]);

  const selectedDam = eligibleDogs.find((dog) => dog.id === damId) ?? null;
  const selectedSire = eligibleDogs.find((dog) => dog.id === sireId) ?? null;
  const dams = useMemo(
    () =>
      eligibleDogs
        .filter(
          (dog) =>
            dog.isOwnedByCurrentKennel &&
            dog.sex === "F" &&
            dog.breedCode2 === breedCode2
        )
        .sort((a, b) => b.ageHours - a.ageHours),
    [breedCode2, eligibleDogs]
  );
  const sires = useMemo(() => {
    const candidates = eligibleDogs.filter(
      (dog) =>
        dog.sex === "M" &&
        dog.breedCode2 === breedCode2 &&
        (dog.isOwnedByCurrentKennel || Boolean(dog.studListingId)) &&
        (dog.isOwnedByCurrentKennel ||
          damMeetsStudRequirements(selectedDam, dog)) &&
        (sireSource === "ALL" ||
          (sireSource === "OWNED" && dog.isOwnedByCurrentKennel) ||
          (sireSource === "PUBLIC" && !dog.isOwnedByCurrentKennel))
    );

    return candidates.sort((a, b) => {
      if (sireSort === "LOWEST_COI") {
        return (
          (pairingCoi(a, selectedDam, pedigree)?.coiPercent ?? 0) -
          (pairingCoi(b, selectedDam, pedigree)?.coiPercent ?? 0)
        );
      }
      if (sireSort === "HEALTH") {
        return (
          Number(hasAllGreenPhenotypeHealthTests(b.healthTests)) -
          Number(hasAllGreenPhenotypeHealthTests(a.healthTests))
        );
      }
      if (sireSort === "FEE") {
        return (a.studFeeAmount ?? 0) - (b.studFeeAmount ?? 0);
      }

      return (
        sireRecommendationScore(b, selectedDam, pedigree) -
        sireRecommendationScore(a, selectedDam, pedigree)
      );
    });
  }, [breedCode2, eligibleDogs, pedigree, selectedDam, sireSort, sireSource]);
  const freeMates = useMemo(() => {
    if (!anchorDog) return [];

    return eligibleDogs
      .filter(
        (dog) =>
          dog.id !== anchorDog.id &&
          dog.breedCode2 === anchorDog.breedCode2 &&
          (anchorDog.sex === "M"
            ? dog.sex === "F" &&
              dog.isOwnedByCurrentKennel &&
              damMeetsStudRequirements(dog, anchorDog)
            : dog.sex === "M" &&
              (dog.isOwnedByCurrentKennel ||
                (Boolean(dog.studListingId) &&
                  damMeetsStudRequirements(anchorDog, dog))))
      )
      .sort((a, b) => {
        if (a.isOwnedByCurrentKennel !== b.isOwnedByCurrentKennel) {
          return Number(b.isOwnedByCurrentKennel) - Number(a.isOwnedByCurrentKennel);
        }

        return dogDisplayName(a).localeCompare(dogDisplayName(b));
      });
  }, [anchorDog, eligibleDogs]);
  const shortlistedSires = shortlistedSireIds
    .map((id) => eligibleDogs.find((dog) => dog.id === id))
    .filter((dog): dog is DogCardDto => Boolean(dog));

  function chooseBreed(nextBreedCode: string) {
    setSuccessMessage("");
    setBreedCode2(nextBreedCode);

    if (selectedDam?.breedCode2 !== nextBreedCode) setDamId("");
    if (selectedSire?.breedCode2 !== nextBreedCode) setSireId("");
    setShortlistedSireIds([]);
    setTestDamBrucellosis(false);
    setTestSireBrucellosis(false);
  }

  function chooseDam(nextDamId: string) {
    setSuccessMessage("");

    if (nextDamId !== damId) {
      setSireId("");
      setShortlistedSireIds([]);
      setTestDamBrucellosis(false);
      setTestSireBrucellosis(false);
    }

    setDamId(nextDamId);
  }

  function toggleShortlist(sireIdToToggle: string) {
    setShortlistedSireIds((current) => {
      if (current.includes(sireIdToToggle)) {
        return current.filter((id) => id !== sireIdToToggle);
      }

      return current.length >= 3 ? [...current.slice(1), sireIdToToggle] : [...current, sireIdToToggle];
    });
  }

  async function handleSubmit() {
    if (!selectedSire || !selectedDam) return;
    if (submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    let unlockSubmit = true;

    try {
      const response = await fetch("/api/breedings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryDogId: selectedSire.id,
          mateDogId: selectedDam.id,
          studListingId: selectedSire.studListingId,
          testDamBrucellosis: shouldChargeDamBrucellosisTest({
            dam: selectedDam,
            sire: selectedSire,
            testDamBrucellosis,
          }),
          testSireBrucellosis: shouldChargeSireBrucellosisTest({
            sire: selectedSire,
            testSireBrucellosis,
          }),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setErrorMessage(data?.error ?? "Breeding could not be created.");
        return;
      }

      if (effectiveReturnMode === "stayOnPlanner") {
        const damName = dogDisplayName(selectedDam);
        const sireName = dogDisplayName(selectedSire);

        setBreedCode2("");
        setDamId("");
        setSireId("");
        setSireSource("ALL");
        setSireSort("RECOMMENDED");
        setShortlistedSireIds([]);
        setTestDamBrucellosis(false);
        setTestSireBrucellosis(false);
        setSuccessMessage(
          `Breeding confirmed for ${damName} x ${sireName}.`
        );
        router.refresh();
        window.setTimeout(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 0);
        return;
      }

      setRedirecting(true);
      unlockSubmit = false;
      const returnDogId = initialDog?.id ?? selectedDam.id;
      setSuccessMessage("Confirmed. Returning to the dog's page...");
      window.setTimeout(() => router.push(`/dogs/${returnDogId}`), 900);
    } catch {
      setErrorMessage("Something went wrong while creating the breeding.");
    } finally {
      setSubmitting(false);
      if (unlockSubmit) {
        submitInFlightRef.current = false;
      }
    }
  }

  if (experience === "breed-dog" && anchorDog) {
    const selectingDams = anchorDog.sex === "M";
    const selectedMate = selectingDams ? selectedDam : selectedSire;

    return (
      <div>
        <div className="theme-card mb-5 rounded-2xl px-4 py-3">
          <p className="theme-copy text-sm">
            Choose an eligible mate for the selected dog.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <FreeAnchorCard dog={anchorDog} />
          </div>
          <section className="theme-panel rounded-2xl p-5 lg:col-span-6">
            <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
              Eligible Mates
            </p>
            <h2 className="theme-heading mt-2 text-xl font-semibold">
              Choose {selectingDams ? "A Dam" : "A Sire"}
            </h2>
            <p className="theme-copy mt-2 text-sm">
              Only dogs currently eligible for this breeding are shown. Outside
              studs are highlighted in blue.
            </p>
            <div className="mt-5 max-h-[72vh] space-y-3 overflow-y-auto pr-1">
              {freeMates.length > 0 ? (
                freeMates.map((dog) => (
                  <FreeMateCard
                    key={`${dog.id}-${dog.studListingId ?? "owned"}`}
                    dog={dog}
                    selected={dog.id === selectedMate?.id}
                    onSelect={() => {
                      if (selectingDams) {
                        setDamId(dog.id);
                      } else {
                        setSireId(dog.id);
                      }
                      setTestDamBrucellosis(false);
                      setTestSireBrucellosis(false);
                    }}
                  />
                ))
              ) : (
                <div className="theme-card theme-copy rounded-xl p-4 text-sm">
                  No eligible mates are currently available for this dog.
                </div>
              )}
            </div>
          </section>
          <div className="lg:col-span-3">
            <FreeBreedingSummary
              kennelBalance={kennelBalance}
              sire={selectedSire}
              dam={selectedDam}
              testDamBrucellosis={testDamBrucellosis}
              testSireBrucellosis={testSireBrucellosis}
              onTestDamBrucellosisChange={setTestDamBrucellosis}
              onTestSireBrucellosisChange={setTestSireBrucellosis}
              submitting={submitting}
              redirecting={redirecting}
              errorMessage={errorMessage}
              successMessage={successMessage}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
        <div className="mt-6 text-xs text-purple-100/50">
          Planning for {kennelName}. Choose a mate and confirm the breeding.
        </div>
      </div>
    );
  }

  if (experience === "breed-dog") {
    return null;
  }

  return (
    <div>
      {successMessage ? (
        <div className="mb-6 rounded-2xl border border-emerald-300/35 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-100 shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
          {successMessage}
        </div>
      ) : null}

      <section className="theme-panel relative overflow-hidden rounded-[28px] p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-100 to-transparent" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="theme-label text-xs font-semibold uppercase tracking-[0.22em]">
              Step 1
            </p>
            <h2 className="theme-heading mt-2 text-2xl font-semibold">
              Choose A Breed
            </h2>
            <p className="theme-copy mt-2 text-sm">
              Parent choices and planning tools appear after you select a breed.
            </p>
          </div>
          <label className="theme-label grid min-w-[280px] gap-2 text-sm">
            Breed
            <select
              autoComplete="off"
              value={breedCode2}
              onChange={(event) => chooseBreed(event.target.value)}
              className="theme-control rounded-xl px-4 py-3 font-semibold outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-300/25"
            >
              <option value="">Choose a breed...</option>
              <BreedSelectOptions options={breeds} />
            </select>
          </label>
        </div>
      </section>

      {breedCode2 ? (
        <>
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="theme-panel rounded-[28px] p-5">
              <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
                Step 2A
              </p>
              <h2 className="theme-heading mt-2 text-xl font-semibold">Choose Dam</h2>
              <p className="theme-copy mt-2 text-sm">
                Your kennel&apos;s eligible females for this breed.
              </p>
              <div className="mt-5 space-y-3">
                {dams.length > 0 ? (
                  dams.map((dog) => (
                    <DogOptionCard
                      key={dog.id}
                      dog={dog}
                      currentEpoch={currentEpoch}
                      selected={dog.id === damId}
                      pedigree={pedigree}
                      onSelect={() => chooseDam(dog.id)}
                    />
                  ))
                ) : (
                  <div className="theme-card theme-copy rounded-xl p-4 text-sm">
                    No females of this breed are currently in your kennel.
                  </div>
                )}
              </div>
            </div>

            <div className="theme-panel rounded-[28px] p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
                    Step 2B
                  </p>
                  <h2 className="theme-heading mt-2 text-xl font-semibold">Choose Sire</h2>
                </div>
                {selectedDam ? (
                  <div className="flex flex-wrap gap-2">
                    {(["ALL", "OWNED", "PUBLIC"] as const).map((source) => (
                      <button
                        key={source}
                        type="button"
                        onClick={() => setSireSource(source)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          sireSource === source
                            ? "border-sky-300/50 bg-sky-500/20 text-sky-100"
                            : "theme-neutral-badge"
                        }`}
                      >
                        {source === "OWNED" ? "My Kennel" : source === "PUBLIC" ? "Outside Studs" : "All"}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {selectedDam ? (
                <>
                  <label className="theme-label mt-4 grid gap-2 text-xs uppercase tracking-wide">
                    Sort Sires
                    <select
                      value={sireSort}
                      onChange={(event) => setSireSort(event.target.value as SireSort)}
                      className="theme-control rounded-xl px-3 py-2 text-sm font-semibold normal-case tracking-normal outline-none"
                    >
                      <option value="RECOMMENDED">Recommended</option>
                      <option value="LOWEST_COI">Lowest Litter COI</option>
                      <option value="HEALTH">Health Clear First</option>
                      <option value="FEE">Lowest Stud Fee</option>
                    </select>
                  </label>
                  <div className="mt-5 space-y-3">
                    {sires.length > 0 ? (
                      sires.map((dog) => (
                        <DogOptionCard
                          key={`${dog.id}-${dog.studListingId ?? "owned"}`}
                          dog={dog}
                          currentEpoch={currentEpoch}
                          selected={dog.id === sireId}
                          pairingDam={selectedDam}
                          pedigree={pedigree}
                          shortlisted={shortlistedSireIds.includes(dog.id)}
                          onSelect={() => {
                            setSuccessMessage("");
                            setSireId(dog.id);
                            setTestDamBrucellosis(false);
                            setTestSireBrucellosis(false);
                          }}
                          onToggleShortlist={() => toggleShortlist(dog.id)}
                        />
                      ))
                    ) : (
                      <div className="theme-card theme-copy rounded-xl p-4 text-sm">
                        No sires match this breed and source filter.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="theme-card theme-copy mt-5 rounded-xl p-4 text-sm">
                  Select an eligible dam first to compare available sires.
                </div>
              )}
            </div>
          </section>

          <Shortlist dam={selectedDam} sires={shortlistedSires} pedigree={pedigree} />

          {selectedDam && selectedSire ? (
            <PairingAnalysis
              kennelBalance={kennelBalance}
              currentEpoch={currentEpoch}
              dam={selectedDam}
              sire={selectedSire}
              pedigree={pedigree}
              testDamBrucellosis={testDamBrucellosis}
              testSireBrucellosis={testSireBrucellosis}
              onTestDamBrucellosisChange={setTestDamBrucellosis}
              onTestSireBrucellosisChange={setTestSireBrucellosis}
              submitting={submitting}
              redirecting={redirecting}
              errorMessage={errorMessage}
              successMessage={successMessage}
              onSubmit={handleSubmit}
            />
          ) : (
            <div className="theme-card theme-copy mt-6 rounded-2xl p-5 text-sm">
              Select a dam and sire to unlock the full pairing preview.
            </div>
          )}
        </>
      ) : null}

      <div className="mt-6 text-xs text-purple-100/50">
        Planning for {kennelName}. Pairing estimates support breeder judgment and do not guarantee individual puppy outcomes.
      </div>
    </div>
  );
}
