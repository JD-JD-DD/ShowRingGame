import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AutomaticStudContractConfirmation } from "@/components/stud-contract/AutomaticStudContractConfirmation";
import { ManualStudContractRequest } from "@/components/stud-contract/ManualStudContractRequest";
import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { RETURN_SERVICE_FINE_PRINT } from "@/lib/studContractDisclosures";
import {
  getBreedingEligibilityMessage,
  getIndividualBreedingEligibility,
} from "@/server/services/breedingEligibility.service";
import { getKennelForUser } from "@/server/services/kennel.service";
import { resolvePublicStudForSire } from "@/server/services/publicStud.service";
import { evaluateCurrentDamAgainstStudContractRequirements } from "@/server/services/studContractEligibility.service";
import { getCurrentPublishedStudOffersForSires } from "@/server/services/studOffer.service";
import { PHENOTYPE_HEALTH_TESTS } from "@showring/rules";

type PageProps = {
  searchParams?: Promise<{
    studListingId?: string | string[];
    sireDogId?: string | string[];
    damDogId?: string | string[];
    source?: string | string[];
  }>;
};

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || null;
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default async function StudContractPage({ searchParams }: PageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const kennel = await getKennelForUser(userId);
  if (!kennel) redirect("/onboarding");

  const query = searchParams ? await searchParams : {};
  const listingId = first(query.studListingId);
  const sireId = first(query.sireDogId);
  const damId = first(query.damDogId);
  if (!sireId) notFound();

  const publicStud = await resolvePublicStudForSire({
    sireDogId: sireId,
    ...(listingId ? { legacyListingId: listingId } : {}),
  });
  if (
    !publicStud ||
    publicStud.sireDogId !== sireId ||
    publicStud.ownerKennelId === kennel.id ||
    (publicStud.source === "LEGACY_PLAYER_STUD" &&
      (!listingId || publicStud.legacyListingId !== listingId))
  ) {
    notFound();
  }

  const sire = await db.dog.findUnique({
    where: { id: publicStud.sireDogId },
    select: {
      id: true,
      ownerKennelId: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      breedCode2: true,
      sex: true,
      birthEpoch: true,
      lifecycleState: true,
      isBreedingActive: true,
      breed: { select: { name: true } },
    },
  });
  if (!sire || sire.sex !== "M" || sire.ownerKennelId !== publicStud.ownerKennelId) {
    notFound();
  }

  const offer =
    publicStud.source === "STUD_OFFER"
      ? (await getCurrentPublishedStudOffersForSires([sireId]))[0] ?? null
      : null;
  if (publicStud.source === "STUD_OFFER" && !offer) notFound();

  const currentEpoch = getCurrentEpoch();
  const latest = await db.breedingAttempt.findFirst({
    where: { sireId },
    orderBy: [{ createdEpoch: "desc" }, { id: "desc" }],
    select: { createdEpoch: true },
  });
  const availability = getIndividualBreedingEligibility({
    currentEpoch,
    birthEpoch: sire.birthEpoch,
    lifecycleState: sire.lifecycleState,
    sex: sire.sex,
    latestSireAttemptCreatedEpoch: latest?.createdEpoch ?? null,
  });
  const dam = damId
    ? await db.dog.findFirst({
        where: { id: damId, ownerKennelId: kennel.id },
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
          breedCode2: true,
          sex: true,
          birthEpoch: true,
          lifecycleState: true,
          isBreedingActive: true,
          breedingAttemptsAsDam: {
            where: { status: { in: ["INITIATED", "PREGNANT"] } },
            orderBy: { createdEpoch: "desc" },
            take: 1,
            select: { status: true },
          },
          dammedLitters: {
            orderBy: { bornEpoch: "desc" },
            take: 1,
            select: { bornEpoch: true },
          },
        },
      })
    : null;
  if (damId && !dam) notFound();

  const mismatch =
    dam && (dam.sex !== "F" || dam.breedCode2 !== sire.breedCode2 || dam.id === sireId);
  const damAvailability = dam
    ? getIndividualBreedingEligibility({
        currentEpoch,
        birthEpoch: dam.birthEpoch,
        lifecycleState: dam.lifecycleState,
        sex: dam.sex,
        activeBreedingAttemptStatus: dam.breedingAttemptsAsDam[0]?.status ?? null,
        lastWhelpedEpoch: dam.dammedLitters[0]?.bornEpoch ?? null,
      })
    : null;
  const damAvailabilityMessage = damAvailability
    ? getBreedingEligibilityMessage(damAvailability)
    : null;
  const contractEligibility =
    dam && offer
      ? await evaluateCurrentDamAgainstStudContractRequirements({
          damDogId: dam.id,
          currentEpoch,
          requirements: {
            brucellosisNegativeRequired: offer.brucellosisNegativeRequired,
            healthRequirements: offer.healthRequirements,
            titleRequirement: offer.titleRequirement,
          },
        })
      : null;
  const pendingManualRequest = dam
    ? await db.studContract.findFirst({
        where: { damDogId: dam.id, sireDogId: sireId, status: "PENDING" },
        select: { approvalDeadlineAt: true },
      })
    : null;
  const back =
    first(query.source) === "plan-a-litter"
      ? "/plan-a-litter"
      : first(query.source) === "breed-dog"
        ? "/breed"
        : "/studs";
  const actionAvailable =
    dam && offer && !mismatch && contractEligibility?.eligible && damAvailability?.isEligible && availability.isEligible;

  const actionUnavailableMessage =
    "This Stud Contract is available to review, but submission is not yet available from this offer.";

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="theme-panel mx-auto max-w-3xl rounded-[28px] px-6 py-8">
        <p className="theme-label text-sm uppercase tracking-[0.22em]">Stud Contract</p>
        <h1 className="theme-heading mt-2 text-4xl font-bold">Stud Contract Terms</h1>
        <section className="theme-card mt-6 rounded-2xl p-4">
          <h2 className="theme-heading text-lg font-semibold">Sire</h2>
          <p className="theme-copy mt-2">{formatDogDisplayName(sire)} · {sire.breed.name} · {sire.regNumber}</p>
          <p className="theme-copy mt-2 text-sm">
            Sire availability: {!sire.isBreedingActive
              ? "Breeding Inactive"
              : availability.isEligible
                ? "Available"
                : availability.reasonCode === "STUD_RECOVERY"
                  ? `Stud Recovery — ${availability.remainingHours} real hours remaining`
                  : getBreedingEligibilityMessage(availability) ?? "Currently unavailable"}
          </p>
          <Link href={`/dogs/${sireId}`} className="theme-secondary-button mt-3 inline-flex rounded-xl px-3 py-2 text-sm font-semibold">
            View Dog
          </Link>
        </section>

        {dam ? (
          <section className="theme-card mt-4 rounded-2xl p-4">
            <h2 className="theme-heading text-lg font-semibold">Selected Dam</h2>
            <p className="theme-copy mt-2">{formatDogDisplayName(dam)} · {dam.regNumber}</p>
            <p className="theme-copy mt-2 text-sm">
              Ordinary breeding status: {!dam.isBreedingActive
                ? "Breeding Inactive"
                : damAvailability?.isEligible
                  ? "Available"
                  : damAvailabilityMessage ?? "Currently unavailable"}
            </p>
            <p className="theme-copy mt-2 text-sm">
              {mismatch
                ? "This dam cannot be paired with this sire."
                : contractEligibility
                  ? `Contract Requirements: ${contractEligibility.eligible ? "Meets" : "Does not currently meet"}`
                  : "Stud Contract terms are not currently published."}
            </p>
            {contractEligibility ? (
              <ul className="theme-copy mt-2 grid gap-1 text-sm">
                <li>Brucellosis: {contractEligibility.brucellosis.eligible ? "Meets" : contractEligibility.brucellosis.message}</li>
                {contractEligibility.health.map((item) => (
                  <li key={item.healthTestCode}>{item.healthTestLabel}: {item.eligible ? "Meets" : item.message}</li>
                ))}
                <li>Title: {contractEligibility.title.eligible ? "Meets" : contractEligibility.title.message}</li>
              </ul>
            ) : null}
          </section>
        ) : (
          <section className="theme-status-info mt-4 rounded-2xl p-4">
            <p>Choose an eligible owned dam in the existing planner to see pairing context.</p>
            <Link href="/plan-a-litter" className="theme-secondary-button mt-3 inline-flex rounded-xl px-3 py-2 text-sm font-semibold">
              Choose a Dam
            </Link>
          </section>
        )}

        {!offer ? (
          <p className="theme-status-danger mt-4 rounded-2xl p-4" role="status">Stud contract terms are not currently published for this sire.</p>
        ) : (
          <section className="theme-card mt-4 rounded-2xl p-4">
            <h2 className="theme-heading text-lg font-semibold">Published Terms</h2>
            <div className="theme-copy mt-3 grid gap-3 text-sm">
              <p><b>Compensation:</b>{" "}{offer.compensationType === "PUPPY_BACK" ? "Puppy Back" : offer.compensationType === "CASH" ? offer.cashAmount === null ? "Cash" : money.format(offer.cashAmount) : `${offer.cashAmount === null ? "Cash" : money.format(offer.cashAmount)} + Puppy Back`}</p>
              {offer.compensationType !== "CASH" ? <><p><b>Puppy-Back Terms:</b> {offer.puppyPickPosition === "SECOND" ? "Second Pick" : "First Pick"} · Required Sex: {offer.puppySex === "MALE" ? "Male" : offer.puppySex === "FEMALE" ? "Female" : "Either"} · Minimum qualifying litter: {offer.minimumLitterSize} puppies born alive at whelping</p><p>Deaths after whelping do not change the contractual count. Selection opens after litter creation and is never automatic. First Pick is due 24 real hours after puppy age; Second Pick gives the dam 24 real hours and the stud owner a fixed birth-plus-48-real-hour deadline, which does not move even if selection starts early. Required sex is mandatory, with no alternate-sex or cash substitution; missed rights are forfeited. A selected puppy&apos;s death may reopen stud selection before Day 56. Puppy-Back failure alone does not create Return Service.</p></> : null}
              <p><b>Return Service:</b> No-litter: {offer.noLitterReturnService ? "Offered" : "Not offered"}. Small-litter: {offer.smallLitterReturnThreshold === null ? "Not offered" : `${offer.smallLitterReturnThreshold} or fewer puppies born alive at whelping`}.</p>
              <p><b>Dam Requirements:</b> Brucellosis: {offer.brucellosisNegativeRequired ? "Negative required" : "No restriction"}. Title: {offer.titleRequirement === "CH_OR_HIGHER" ? "CH or higher" : offer.titleRequirement === "GCH_OR_HIGHER" ? "GCH or higher" : "No restriction"}. {offer.healthRequirements.map((requirement) => `${PHENOTYPE_HEALTH_TESTS[requirement.healthTestCode as keyof typeof PHENOTYPE_HEALTH_TESTS]?.label ?? requirement.healthTestCode}: ${requirement.requirementLevel === "GREEN_ONLY" ? "Green only" : requirement.requirementLevel === "GREEN_OR_YELLOW" ? "Green or Yellow" : "No restriction"}`).join(" · ")}</p>
              <p><b>Approval:</b>{" "}{offer.approvalMode === "MANUAL" ? "Manual Approval — individual approval is required; future requests remain open for 24 real hours and do not reserve the sire." : "Automatic Approval — qualifying breedings do not require individual approval from the stud owner."}</p>
            </div>
          </section>
        )}

        {offer ? <section className="theme-card mt-4 rounded-2xl p-4"><h2 className="theme-heading text-lg font-semibold">Return Service and availability</h2><p className="theme-copy mt-2 text-sm">{RETURN_SERVICE_FINE_PRINT}</p></section> : null}
        {dam && actionAvailable && offer?.approvalMode === "AUTOMATIC" ? publicStud.source === "LEGACY_PLAYER_STUD" ? <AutomaticStudContractConfirmation studListingId={publicStud.legacyListingId} sireDogId={sireId} damDogId={dam.id} /> : <p className="theme-status-info mt-4 rounded-2xl p-4" role="status">{actionUnavailableMessage}</p> : null}
        {pendingManualRequest ? <section className="theme-status-info mt-4 rounded-2xl p-4" role="status"><p className="font-semibold">Stud approval pending</p><p className="mt-1 text-sm">No breeding or payment has occurred. Decision deadline: {pendingManualRequest.approvalDeadlineAt?.toLocaleString() ?? "Unavailable"}.</p></section> : dam && actionAvailable && offer?.approvalMode === "MANUAL" ? publicStud.source === "LEGACY_PLAYER_STUD" ? <ManualStudContractRequest studListingId={publicStud.legacyListingId} sireDogId={sireId} damDogId={dam.id} /> : <p className="theme-status-info mt-4 rounded-2xl p-4" role="status">{actionUnavailableMessage}</p> : null}
        <Link href={back} className="theme-secondary-button mt-8 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold">Go Back</Link>
      </section>
    </main>
  );
}
