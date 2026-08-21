import Link from "next/link";
import { PendingStudRequestActions } from "@/components/stud-contract/PendingStudRequestActions";
import { redirect } from "next/navigation";
import { formatDogDisplayName } from "@/lib/dogNames";
import { formatRealDuration } from "@/lib/gameTimeFormat";
import { formatCompactStudOfferSummary } from "@/lib/studOfferPresentation";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  getBreedingEligibilityMessage,
  getIndividualBreedingEligibility,
} from "@/server/services/breedingEligibility.service";
import { getKennelForUser } from "@/server/services/kennel.service";

function formatRequestedAt(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function PendingStudRequestsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const kennel = await getKennelForUser(userId);
  if (!kennel) redirect("/onboarding");
  const currentEpoch = getCurrentEpoch();
  const requests = await db.studContract.findMany({
    where: { sireKennelId: kennel.id, status: "PENDING" },
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    include: {
      healthRequirements: true,
      sireDog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true, birthEpoch: true, lifecycleState: true, sex: true, breed: { select: { name: true } } } },
      damDog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      damKennel: { select: { name: true } },
    },
  });
  const sireIds = [...new Set(requests.map((request) => request.sireDogId))];
  const latestAttempts = sireIds.length ? await db.breedingAttempt.findMany({
    where: { sireId: { in: sireIds } },
    orderBy: [{ sireId: "asc" }, { createdEpoch: "desc" }, { id: "desc" }],
    distinct: ["sireId"],
    select: { sireId: true, createdEpoch: true },
  }) : [];
  const latestAttemptBySireId = new Map(latestAttempts.map((attempt) => [attempt.sireId, attempt.createdEpoch]));

  return <main className="min-h-screen px-6 py-8"><section className="theme-panel mx-auto max-w-6xl rounded-[28px] px-6 py-8">
    <p className="theme-label text-sm uppercase tracking-[0.22em]">Stud Contracts</p>
    <h1 className="theme-heading mt-2 text-4xl font-bold">Pending Stud Requests</h1>
    <p className="theme-copy mt-3">Requests are independent and do not reserve a sire. Approval actions will be available in a later stage.</p>
    {requests.length === 0 ? <p className="theme-copy mt-6 rounded-2xl border border-white/10 p-4">No pending Manual Approval requests.</p> : <div className="mt-6 grid gap-4">
      {requests.map((request) => {
        const summary = formatCompactStudOfferSummary({
          compensationType: request.compensationType,
          cashAmount: request.cashAmount,
          puppyPickPosition: request.puppyPickPosition,
          puppySex: request.puppySex,
          brucellosisNegativeRequired: request.brucellosisNegativeRequired,
          titleRequirement: request.titleRequirement,
          approvalMode: request.approvalMode,
          healthRequirements: request.healthRequirements,
        });
        const availability = getIndividualBreedingEligibility({
          currentEpoch, birthEpoch: request.sireDog.birthEpoch,
          lifecycleState: request.sireDog.lifecycleState,
          sex: request.sireDog.sex,
          latestSireAttemptCreatedEpoch: latestAttemptBySireId.get(request.sireDogId) ?? null,
        });
        const remaining = request.approvalDeadlineAt
          ? request.approvalDeadlineAt.getTime() - Date.now()
          : 0;
        return <article key={request.id} className="theme-card rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="theme-heading text-xl font-semibold">{formatDogDisplayName(request.sireDog)} <span className="theme-copy text-sm">· {request.sireDog.breed.name}</span></h2><p className="theme-copy mt-1 text-sm">Request from {request.damKennel.name} for {formatDogDisplayName(request.damDog)}.</p></div><span className="theme-status-info rounded-full px-3 py-1 text-sm font-semibold">Pending</span></div>
          <dl className="theme-copy mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4"><div><dt className="theme-label">Contract</dt><dd className="mt-1">{summary?.compensationSummary}{summary?.puppyTermsSummary ? ` · ${summary.puppyTermsSummary}` : ""}{summary?.restrictionsSummary ? ` · ${summary.restrictionsSummary}` : ""}</dd></div><div><dt className="theme-label">Requested</dt><dd className="mt-1">{formatRequestedAt(request.requestedAt)}</dd></div><div><dt className="theme-label">Time remaining</dt><dd className="mt-1">{remaining > 0 ? `${formatRealDuration(remaining)} remaining` : "Deadline passed"}</dd></div><div><dt className="theme-label">Stud availability</dt><dd className="mt-1">{availability.isEligible ? "Available" : availability.reasonCode === "STUD_RECOVERY" ? `Stud Recovery — ${availability.remainingHours}h remaining` : getBreedingEligibilityMessage(availability) ?? "Currently unavailable"}</dd></div></dl>
          <div className="mt-4 flex flex-wrap gap-2"><Link href={`/dogs/${request.sireDog.id}`} className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold">View Stud</Link><Link href={`/dogs/${request.damDog.id}`} className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold">View Dam</Link><PendingStudRequestActions contractId={request.id} canApprove={remaining > 0 && availability.isEligible} /></div>
        </article>;
      })}
    </div>}
  </section></main>;
}
