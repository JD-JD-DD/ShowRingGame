import Link from "next/link";
import { redirect } from "next/navigation";

import { LittersListClient } from "@/components/litters/LittersListClient";
import { StudContractPuppySelectionActions } from "@/components/litters/StudContractPuppySelectionActions";
import { getCurrentEpoch } from "@/lib/gameClock";
import { formatRealDurationHoursLong } from "@/lib/gameTimeFormat";
import { getSessionUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  getLitterManagementOptions,
  listLittersForKennel,
  parseLitterArchiveFilters,
} from "@/server/services/litter.service";

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function breedingProgressLabel(attempt: {
  status: string;
  reproductiveEmergencyStatus: string | null;
}): string {
  if (attempt.status === "INITIATED") return "Pregnancy not yet confirmed";
  if (attempt.status === "PREGNANT") return "Pregnancy confirmed";
  if (attempt.status === "REPRODUCTIVE_EMERGENCY") {
    if (attempt.reproductiveEmergencyStatus === "PENDING") {
      return "Reproductive emergency — care decision required";
    }
    if (attempt.reproductiveEmergencyStatus === "TREATMENT_AUTHORIZED") {
      return "Reproductive emergency — treatment in progress";
    }
    if (attempt.reproductiveEmergencyStatus === "TREATMENT_DECLINED") {
      return "Reproductive emergency — outcome pending";
    }
  }
  return statusLabel(attempt.status);
}

const focusLinkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatSelectionDeadline(deadline: Date | null): string {
  return deadline
    ? deadline.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "Not yet scheduled";
}

export default async function LittersPage({ searchParams }: PageProps) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await getKennelForUser(userId);

  if (!kennel) {
    redirect("/onboarding");
  }

  const currentEpoch = getCurrentEpoch();
  const filters = parseLitterArchiveFilters(await searchParams);
  const {
    litters,
    nextCursor,
    hasMore,
    totalCount,
    totalPuppyCount,
    historicalTotalCount,
    activeBreedings,
  } = await listLittersForKennel({
    kennelId: kennel.id,
    currentEpoch,
    filters,
  });
  const managementOptions = await getLitterManagementOptions({ kennelId: kennel.id });
  const puppySelections = await db.studContractPuppySelection.findMany({
    where: { contract: { OR: [{ sireKennelId: kennel.id }, { damKennelId: kennel.id }] } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      currentActor: true,
      turnDeadlineAt: true,
      damFirstPickDogId: true,
      damFirstPickForfeitedAt: true,
      litter: { select: { serial7: true, puppies: { where: { lifecycleState: "ALIVE" }, orderBy: { litterOrder: "asc" }, select: { id: true, callName: true, registeredName: true, regNumber: true, sex: true } } } },
      contract: { select: { puppyPickPosition: true, puppySex: true, sireKennelId: true, damKennelId: true } },
    },
  });

  const pregnantBreedings = activeBreedings.filter(
    (attempt) => attempt.status === "PREGNANT"
  );

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div>
            <p className="theme-label text-sm uppercase tracking-[0.25em]">
              Breeding Records
            </p>
            <h1 className="theme-heading mt-2 text-4xl font-semibold tracking-tight">
              Litters
            </h1>
            <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
              Follow active pregnancies and review every litter whelped by your
              kennel.
            </p>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="theme-card rounded-2xl p-5">
            <div className="theme-label text-xs uppercase tracking-wide">
              {filters.search || filters.breedCode2 || filters.gameYear || filters.sort !== "newest"
                ? "Matching Litters"
                : "Total Litters"}
            </div>
            <div className="theme-heading mt-2 text-3xl font-semibold">{totalCount}</div>
            {totalCount !== historicalTotalCount ? (
              <div className="theme-copy mt-1 text-xs">
                {historicalTotalCount} total historical litters
              </div>
            ) : null}
          </div>
          <div className="theme-card rounded-2xl p-5">
            <div className="theme-label text-xs uppercase tracking-wide">
              Puppies Whelped
            </div>
            <div className="theme-heading mt-2 text-3xl font-semibold">{totalPuppyCount}</div>
          </div>
          <div className="theme-status-success rounded-2xl border p-5">
            <div className="text-xs uppercase tracking-wide">
              Pregnant Dams
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {pregnantBreedings.length}
            </div>
          </div>
        </section>

        {activeBreedings.length > 0 ? (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="theme-heading text-2xl font-semibold">In Progress</h2>
              <span className="theme-copy text-sm">
                {activeBreedings.length} active
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {activeBreedings.map((attempt) => (
                <article
                  key={attempt.id}
                  className="theme-panel rounded-2xl p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="theme-label text-xs uppercase tracking-wide">
                        {breedingProgressLabel(attempt)}
                      </div>
                      <h3 className="theme-heading mt-2 text-lg font-semibold">
                        <Link href={`/dogs/${attempt.damId}`} className={`hover:underline ${focusLinkClass}`}>
                          {attempt.damName}
                        </Link>{" "}
                        x{" "}
                        <Link href={`/dogs/${attempt.sireId}`} className={`hover:underline ${focusLinkClass}`}>
                          {attempt.sireName}
                        </Link>
                      </h3>
                      <p className="theme-copy mt-1 text-sm">
                        Breed code {attempt.breedCode2}
                      </p>
                    </div>
                    <div className="theme-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                      Attempt
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="theme-card rounded-xl p-4">
                      <div className="theme-label text-xs uppercase tracking-wide">
                        Pregnancy Check
                      </div>
                      <div className="theme-heading mt-1 text-sm font-semibold">
                        {attempt.hoursUntilPregCheck === null
                          ? "Not scheduled"
                          : `Pregnancy check in ${formatRealDurationHoursLong(attempt.hoursUntilPregCheck)}`}
                      </div>
                    </div>
                    <div className="theme-card rounded-xl p-4">
                      <div className="theme-label text-xs uppercase tracking-wide">
                        Due
                      </div>
                      <div className="theme-heading mt-1 text-sm font-semibold">
                        {attempt.hoursUntilDue === null
                          ? "Not scheduled"
                          : `Due in ${formatRealDurationHoursLong(attempt.hoursUntilDue)}`}
                      </div>
                    </div>
                  </div>
                  {attempt.status === "REPRODUCTIVE_EMERGENCY" &&
                  attempt.reproductiveEmergencyStatus === "PENDING" ? (
                    <Link
                      href={`/dogs/${attempt.damId}#whelping-emergency`}
                      className={`theme-status-danger mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-semibold ${focusLinkClass}`}
                    >
                      Review emergency care
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {puppySelections.length > 0 ? (
          <section className="mb-8">
            <h2 className="theme-heading mb-4 text-2xl font-semibold">Stud Contract Selection</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {puppySelections.map((selection) => {
                const isStudOwner = selection.contract.sireKennelId === kennel.id;
                const isActive = selection.status === "STUD_PICK" || selection.status === "DAM_FIRST_PICK";
                const deadlinePassed = selection.turnDeadlineAt !== null && selection.turnDeadlineAt.getTime() <= Date.now();
                const title = selection.status === "DAM_FIRST_PICK"
                  ? "Dam owner first selection"
                  : selection.status === "STUD_PICK"
                    ? "Stud owner selection"
                    : statusLabel(selection.status);
                return (
                  <article key={selection.id} className="theme-panel rounded-2xl p-5">
                    <div className="theme-label text-xs uppercase tracking-wide">{title}</div>
                    <h3 className="theme-heading mt-2 text-lg font-semibold">Litter {selection.litter.serial7}</h3>
                    <p className="theme-copy mt-2 text-sm">
                      {selection.contract.puppyPickPosition === "FIRST" ? "First Pick" : "Second Pick"}
                      {selection.status === "DAM_FIRST_PICK" && isStudOwner
                        ? " — the dam owner currently has the protected first selection."
                        : ""}
                    </p>
                    {selection.status === "DAM_FIRST_PICK" ? (
                      <p className="theme-copy mt-2 text-sm">The dam owner’s protected first selection is not restricted by the stud owner’s sex requirement.</p>
                    ) : null}
                    {selection.status === "STUD_PICK" ? (
                      <p className="theme-copy mt-2 text-sm">Puppy sex requirement: {selection.contract.puppySex ?? "EITHER"}. No puppy will be selected automatically.</p>
                    ) : null}
                    {selection.damFirstPickForfeitedAt ? (
                      <p className="theme-copy mt-2 text-sm">Protected first-pick deadline missed. The dam owner’s first-pick right was forfeited.</p>
                    ) : null}
                    {selection.status === "FORFEITED" ? (
                      <p className="theme-copy mt-2 text-sm">Puppy Back selection deadline missed. The stud owner’s puppy-selection right was forfeited. No puppy was selected.</p>
                    ) : null}
                    {selection.status === "UNFULFILLABLE" ? (
                      <p className="theme-copy mt-2 text-sm">Puppy Back cannot be fulfilled because no living puppy satisfies the contract sex requirement.</p>
                    ) : null}
                    {isActive && (!isStudOwner || selection.currentActor === "STUD_OWNER") ? (
                      <p className="theme-copy mt-3 text-sm">{deadlinePassed ? "Selection deadline passed — awaiting processing." : `Selection deadline: ${formatSelectionDeadline(selection.turnDeadlineAt)}`}</p>
                    ) : null}
                    {isActive && !deadlinePassed && ((selection.currentActor === "DAM_OWNER" && !isStudOwner) || (selection.currentActor === "STUD_OWNER" && isStudOwner)) ? (
                      <StudContractPuppySelectionActions
                        selectionId={selection.id}
                        action={selection.currentActor === "DAM_OWNER" ? "DAM_PROTECTED_PICK" : "STUD_PICK"}
                        puppies={selection.litter.puppies
                          .filter((puppy) => selection.currentActor === "DAM_OWNER" || (puppy.id !== selection.damFirstPickDogId && (selection.contract.puppySex === "EITHER" || selection.contract.puppySex === null || (selection.contract.puppySex === "MALE" ? puppy.sex === "M" : puppy.sex === "F"))))
                          .map((puppy) => ({ id: puppy.id, label: puppy.callName ?? puppy.registeredName ?? puppy.regNumber }))}
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="theme-heading text-2xl font-semibold">Whelped Litters</h2>
          </div>

          <LittersListClient
            key={JSON.stringify(filters)}
            initialLitters={litters}
            initialCursor={nextCursor}
            initialHasMore={hasMore}
            filters={filters}
            managementOptions={managementOptions}
            hasHistoricalLitters={historicalTotalCount > 0}
          />
        </section>
      </div>
    </main>
  );
}
