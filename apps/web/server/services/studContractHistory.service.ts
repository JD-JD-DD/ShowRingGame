import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getCurrentEpoch } from "@/lib/gameClock";
import { evaluateDamAgainstStudContractRequirements } from "@/lib/studContractEligibility";
import { formatCompactStudOfferSummary } from "@/lib/studOfferPresentation";
import { getBreedingEligibilityMessage, getIndividualBreedingEligibility } from "@/server/services/breedingEligibility.service";
import { hasPendingVeterinaryCareFromRecords } from "@/server/services/emergencyVetCare.service";
import { BRUCELLOSIS_DISEASE_CODE } from "@showring/rules";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 10;
const statusFilterValues = ["all", "pending", "active", "complete", "declined", "expired"] as const;
const actionFilterValues = ["all", "needs-action", "manual-approval", "puppy-selection", "return-service"] as const;
const sortOrderValues = ["newest", "oldest"] as const;

export type StudContractStatusFilter = (typeof statusFilterValues)[number];
export type StudContractActionFilter = (typeof actionFilterValues)[number];
export type StudContractSortOrder = (typeof sortOrderValues)[number];

function parseFilter<T extends readonly string[]>(value: string | null | undefined, allowed: T, fallback: T[number]): T[number] {
  if (typeof value !== "string") return fallback;
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

export function parseStudContractHistoryFilters(args: { status?: string | null; action?: string | null; sort?: string | null }) {
  return {
    statusFilter: parseFilter(args.status, statusFilterValues, "all"),
    actionFilter: parseFilter(args.action, actionFilterValues, "all"),
    sortOrder: parseFilter(args.sort, sortOrderValues, "newest"),
  };
}

const currentDogSelect = {
  id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true,
  ownerKennelId: true, breedCode2: true, sex: true, lifecycleState: true, isBreedingActive: true, birthEpoch: true,
  breedingAttemptsAsSire: { orderBy: [{ createdEpoch: "desc" }, { id: "desc" }], take: 1, select: { createdEpoch: true } },
  breedingAttemptsAsDam: { where: { status: { in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"] } }, take: 1, select: { status: true } },
  dammedLitters: { orderBy: { bornEpoch: "desc" }, take: 1, select: { bornEpoch: true } },
  reproductiveEmergencies: { select: { id: true, status: true, resolvedEpoch: true, reproductiveConsequence: true } },
  emergencyCareEvents: { select: { status: true } },
  healthTests: { where: { isPublic: true }, select: { id: true, testTypeCode: true, resultCode: true, testedAtEpoch: true, createdAt: true } },
  infectiousDiseaseStatuses: { select: { diseaseCode: true, status: true } },
  infectiousDiseaseTests: { select: { diseaseCode: true, resultCode: true, validUntilEpoch: true } },
} satisfies Prisma.DogSelect;

const studContractHistoryArgs = {
  include: {
    sireDog: { select: currentDogSelect },
    damDog: { select: currentDogSelect },
    sireKennel: { select: { id: true, name: true } },
    damKennel: { select: { id: true, name: true } },
    healthRequirements: { select: { healthTestCode: true, requirementLevel: true } },
    breedingAttempt: { select: { id: true, status: true, createdEpoch: true } },
    puppySelection: { select: { id: true, status: true, currentActor: true, turnDeadlineAt: true, completedAt: true, selectedDog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } } } },
    returnService: { include: { returnBreedingAttempt: { select: { id: true, status: true, createdEpoch: true } } } },
  },
} satisfies Prisma.StudContractDefaultArgs;
type ContractHistoryRecord = Prisma.StudContractGetPayload<typeof studContractHistoryArgs>;

function returnServiceLabel(value: { status: "AVAILABLE" | "USED" | "EXPIRED" | "EXTINGUISHED"; expiresAt: Date; extinguishmentReason: string | null }) {
  if (value.status === "AVAILABLE") return "Available";
  if (value.status === "USED") return "Used";
  if (value.status === "EXPIRED") return "Expired";
  const labels: Record<string, string> = {
    SIRE_OWNERSHIP_CHANGED: "Permanently ended — sire changed kennels",
    DAM_OWNERSHIP_CHANGED: "Permanently ended — dam changed kennels",
    SIRE_DIED: "Permanently ended — sire died",
    DAM_DIED: "Permanently ended — dam died",
    PERMANENT_BREEDING_INELIGIBILITY: "Permanently ended — required dog permanently ineligible",
  };
  return labels[value.extinguishmentReason ?? ""] ?? "Permanently ended";
}

function selectionIsActive(value: { status: string } | null) {
  return value?.status === "DAM_FIRST_PICK" || value?.status === "STUD_PICK";
}

function contractIsComplete(contract: ContractHistoryRecord) {
  if (contract.status !== "ACCEPTED" || contract.returnService?.status === "AVAILABLE") return false;
  if (contract.puppySelection && !["FORFEITED", "UNFULFILLABLE", "COMPLETED"].includes(contract.puppySelection.status)) return false;
  return ["CHECKED_NOT_PREGNANT", "WHELPED", "FAILED", "CANCELLED", "REPRODUCTIVE_EMERGENCY"].includes(contract.breedingAttempt?.status ?? "");
}

function contractLabel(contract: ContractHistoryRecord) {
  if (contract.status === "PENDING") return "Pending";
  if (contract.status === "DECLINED") return "Declined";
  if (contract.status === "EXPIRED") return "Expired";
  return contractIsComplete(contract) ? "Complete" : "Active";
}

function attemptState(status: string | undefined) {
  const labels: Record<string, string> = {
    INITIATED: "Pregnancy pending", CHECKED_NOT_PREGNANT: "No litter", PREGNANT: "Pregnant", WHELPED: "Whelped",
    REPRODUCTIVE_EMERGENCY: "Breeding ended", FAILED: "Breeding ended", CANCELLED: "Breeding ended",
  };
  return labels[status ?? ""] ?? "Breeding attempted";
}

function completeContractWhere(): Prisma.StudContractWhereInput {
  return {
    status: "ACCEPTED",
    breedingAttempt: { is: { status: { in: ["CHECKED_NOT_PREGNANT", "WHELPED", "FAILED", "CANCELLED", "REPRODUCTIVE_EMERGENCY"] } } },
    AND: [
      { OR: [{ returnService: { is: null } }, { returnService: { is: { status: { not: "AVAILABLE" } } } }] },
      { OR: [{ puppySelection: { is: null } }, { puppySelection: { is: { status: { in: ["FORFEITED", "UNFULFILLABLE", "COMPLETED"] } } } }] },
    ],
  };
}

function actionWhere(kennelId: string, now: Date, actionFilter: StudContractActionFilter): Prisma.StudContractWhereInput | null {
  const manualApproval: Prisma.StudContractWhereInput = { sireKennelId: kennelId, status: "PENDING", approvalMode: "MANUAL", approvalDeadlineAt: { gt: now } };
  const puppySelection: Prisma.StudContractWhereInput = {
    OR: [
      { sireKennelId: kennelId, puppySelection: { is: { status: "STUD_PICK", currentActor: "STUD_OWNER", turnDeadlineAt: { gt: now } } } },
      { damKennelId: kennelId, puppySelection: { is: { status: "DAM_FIRST_PICK", currentActor: "DAM_OWNER", turnDeadlineAt: { gt: now } } } },
    ],
  };
  const returnService: Prisma.StudContractWhereInput = { damKennelId: kennelId, returnService: { is: { status: "AVAILABLE" } } };
  if (actionFilter === "manual-approval") return manualApproval;
  if (actionFilter === "puppy-selection") return puppySelection;
  if (actionFilter === "return-service") return returnService;
  if (actionFilter === "needs-action") return { OR: [manualApproval, puppySelection, returnService] };
  return null;
}

function historyWhere(args: { kennelId: string; statusFilter: StudContractStatusFilter; actionFilter: StudContractActionFilter; now: Date }): Prisma.StudContractWhereInput {
  const conditions: Prisma.StudContractWhereInput[] = [{ OR: [{ sireKennelId: args.kennelId }, { damKennelId: args.kennelId }] }];
  if (args.statusFilter === "pending") conditions.push({ status: "PENDING" });
  if (args.statusFilter === "declined") conditions.push({ status: "DECLINED" });
  if (args.statusFilter === "expired") conditions.push({ status: "EXPIRED" });
  if (args.statusFilter === "complete") conditions.push(completeContractWhere());
  if (args.statusFilter === "active") conditions.push({ status: "ACCEPTED", NOT: completeContractWhere() });
  const action = actionWhere(args.kennelId, args.now, args.actionFilter);
  if (action) conditions.push(action);
  return { AND: conditions };
}

function approvalAvailability(contract: ContractHistoryRecord, currentEpoch: number) {
  const sire = contract.sireDog;
  const dam = contract.damDog;
  if (sire.ownerKennelId !== contract.sireKennelId || sire.lifecycleState !== "ALIVE" || sire.sex !== "M" || sire.breedCode2 !== dam.breedCode2) return { canApprove: false, reason: "The original sire is no longer eligible for this request." };
  if (!sire.isBreedingActive) return { canApprove: false, reason: "Breeding inactive." };
  const sireEligibility = getIndividualBreedingEligibility({ currentEpoch, birthEpoch: sire.birthEpoch, lifecycleState: sire.lifecycleState, sex: sire.sex, latestSireAttemptCreatedEpoch: sire.breedingAttemptsAsSire[0]?.createdEpoch ?? null });
  if (!sireEligibility.isEligible) return { canApprove: false, reason: getBreedingEligibilityMessage(sireEligibility) ?? "The sire is not currently breeding eligible." };
  if (hasPendingVeterinaryCareFromRecords({ emergencyCareEvents: sire.emergencyCareEvents, reproductiveEmergencies: sire.reproductiveEmergencies })) return { canApprove: false, reason: "Pending veterinary care." };
  if (dam.ownerKennelId !== contract.damKennelId || dam.lifecycleState !== "ALIVE" || dam.sex !== "F" || dam.breedCode2 !== sire.breedCode2) return { canApprove: false, reason: "The original dam is no longer eligible for this request." };
  if (!dam.isBreedingActive) return { canApprove: false, reason: "Breeding inactive." };
  const damEligibility = getIndividualBreedingEligibility({
    currentEpoch, birthEpoch: dam.birthEpoch, lifecycleState: dam.lifecycleState, sex: dam.sex,
    activeBreedingAttemptStatus: dam.breedingAttemptsAsDam[0]?.status ?? null,
    lastWhelpedEpoch: dam.dammedLitters[0]?.bornEpoch ?? null,
    resolvedReproductiveEmergencies: dam.reproductiveEmergencies.filter((event) => ["RESOLVED_TREATED", "RESOLVED_UNTREATED"].includes(event.status)),
  });
  if (!damEligibility.isEligible) return { canApprove: false, reason: getBreedingEligibilityMessage(damEligibility) ?? "The dam is not currently breeding eligible." };
  if (hasPendingVeterinaryCareFromRecords({ emergencyCareEvents: dam.emergencyCareEvents, reproductiveEmergencies: dam.reproductiveEmergencies })) return { canApprove: false, reason: "Pending veterinary care." };
  const requirementCheck = evaluateDamAgainstStudContractRequirements({
    brucellosisNegativeRequired: contract.brucellosisNegativeRequired,
    healthRequirements: contract.healthRequirements,
    titleRequirement: contract.titleRequirement,
  }, {
    hasValidNegativeBrucellosis: !dam.infectiousDiseaseStatuses.some((status) => status.diseaseCode === BRUCELLOSIS_DISEASE_CODE && status.status === "INFECTED") && dam.infectiousDiseaseTests.some((test) => test.diseaseCode === BRUCELLOSIS_DISEASE_CODE && test.resultCode === "NEGATIVE" && (test.validUntilEpoch ?? -1) >= currentEpoch),
    healthResults: dam.healthTests.map((test) => ({ healthTestCode: test.testTypeCode, resultCode: test.resultCode, testedAtEpoch: test.testedAtEpoch, createdAtEpoch: test.createdAt.getTime(), id: test.id })),
    titleDog: dam,
  });
  const requirementFailure = [requirementCheck.brucellosis, ...requirementCheck.health, requirementCheck.title].find((result) => !result.eligible);
  return requirementFailure?.message ? { canApprove: false, reason: requirementFailure.message } : { canApprove: true, reason: null };
}

function toItem(contract: ContractHistoryRecord | null, kennelId: string, now = new Date(), currentEpoch = getCurrentEpoch()) {
  if (!contract) return null;
  const summary = formatCompactStudOfferSummary({
    compensationType: contract.compensationType,
    cashAmount: contract.cashAmount,
    puppyPickPosition: contract.puppyPickPosition,
    puppySex: contract.puppySex,
    brucellosisNegativeRequired: contract.brucellosisNegativeRequired,
    titleRequirement: contract.titleRequirement,
    approvalMode: contract.approvalMode,
    healthRequirements: contract.healthRequirements,
  });
  const role = contract.sireKennelId === kennelId ? "Stud Owner" : "Dam Owner";
  const isStudOwner = role === "Stud Owner";
  const otherKennel = isStudOwner ? contract.damKennel.name : contract.sireKennel.name;
  const approvalDeadline = contract.approvalDeadlineAt;
  const approvalDeadlineAt = approvalDeadline?.toISOString() ?? null;
  const availability = contract.status === "PENDING" && contract.approvalMode === "MANUAL" ? approvalAvailability(contract, currentEpoch) : null;
  const manualApproval = contract.status === "PENDING" && contract.approvalMode === "MANUAL" && approvalDeadlineAt
    ? { deadlineAt: approvalDeadlineAt, isActionable: isStudOwner && approvalDeadline !== null && approvalDeadline > now, canApprove: isStudOwner && approvalDeadline !== null && approvalDeadline > now && availability?.canApprove === true, availabilityReason: !isStudOwner ? "Awaiting stud-owner decision" : approvalDeadline !== null && approvalDeadline > now ? availability?.reason ?? "Approval required" : "Approval deadline passed" }
    : null;
  const canSelectPuppy = Boolean(contract.puppySelection && selectionIsActive(contract.puppySelection) && contract.puppySelection.turnDeadlineAt && contract.puppySelection.turnDeadlineAt > now && ((contract.puppySelection.currentActor === "STUD_OWNER" && isStudOwner) || (contract.puppySelection.currentActor === "DAM_OWNER" && !isStudOwner)));
  const action = manualApproval?.isActionable
    ? { kind: "MANUAL_APPROVAL" as const, label: "Review request", deadlineAt: manualApproval.deadlineAt }
    : canSelectPuppy && contract.puppySelection?.turnDeadlineAt
      ? { kind: "PUPPY_SELECTION" as const, label: "Choose puppy", selectionId: contract.puppySelection.id, deadlineAt: contract.puppySelection.turnDeadlineAt.toISOString() }
      : contract.returnService?.status === "AVAILABLE" && !isStudOwner
        ? { kind: "RETURN_SERVICE" as const, label: "Use Return Service", returnServiceId: contract.returnService.id, expiresAt: contract.returnService.expiresAt.toISOString() }
        : { kind: "NONE" as const, label: "No action available" };
  const currentDeadline = manualApproval
    ? { kind: "APPROVAL" as const, at: manualApproval.deadlineAt }
    : selectionIsActive(contract.puppySelection) && contract.puppySelection?.turnDeadlineAt
      ? { kind: "PUPPY_SELECTION" as const, at: contract.puppySelection.turnDeadlineAt.toISOString() }
      : contract.returnService?.status === "AVAILABLE"
        ? { kind: "RETURN_SERVICE" as const, at: contract.returnService.expiresAt.toISOString() }
        : null;
  const currentState = contract.status === "PENDING"
    ? manualApproval?.availabilityReason ?? "Pending approval"
    : contract.status === "DECLINED" ? "Declined"
      : contract.status === "EXPIRED" ? "Expired"
        : action.kind === "PUPPY_SELECTION" ? "Puppy selection due"
          : selectionIsActive(contract.puppySelection) ? "Puppy selection in progress"
            : contract.puppySelection?.status === "SELECTED" ? "Puppy selected"
              : contract.puppySelection?.status === "COMPLETED" ? "Puppy selection complete"
                : contract.puppySelection?.status === "FORFEITED" ? "Puppy selection forfeited"
                  : contract.puppySelection?.status === "UNFULFILLABLE" ? "Puppy Back cannot be fulfilled"
                    : contract.returnService?.status === "AVAILABLE" ? "Return Service available"
                      : contract.returnService?.status === "USED" ? "Return Service used"
                        : contract.returnService?.status === "EXPIRED" ? "Return Service expired"
                          : contractIsComplete(contract) ? "Contract complete"
                            : attemptState(contract.breedingAttempt?.status);
  return {
    id: contract.id,
    requestedAt: contract.requestedAt.toISOString(), acceptedAt: contract.acceptedAt?.toISOString() ?? null,
    sire: { id: contract.sireDog.id, name: formatDogDisplayName(contract.sireDog) },
    dam: { id: contract.damDog.id, name: formatDogDisplayName(contract.damDog) },
    role, otherKennel, compensationSummary: summary?.compensationSummary ?? "Contract terms unavailable",
    puppyTermsSummary: summary?.puppyTermsSummary ?? null, restrictionsSummary: summary?.restrictionsSummary ?? null,
    lifecycleLabel: contractLabel(contract), currentState, currentDeadline, action, manualApproval,
    returnService: contract.returnService ? {
      id: contract.returnService.id, status: contract.returnService.status, label: returnServiceLabel(contract.returnService),
      expiresAt: contract.returnService.expiresAt.toISOString(), availableAt: contract.returnService.availableAt.toISOString(),
      usedAt: contract.returnService.usedAt?.toISOString() ?? null, extinguishedAt: contract.returnService.extinguishedAt?.toISOString() ?? null,
      trigger: contract.returnService.trigger === "NO_LITTER" ? "No Litter" : "Small Litter",
      returnAttempt: contract.returnService.returnBreedingAttempt,
    } : null,
    isDamContractingKennel: contract.damKennelId === kennelId,
    puppySelection: contract.puppySelection ? { id: contract.puppySelection.id, status: contract.puppySelection.status, currentActor: contract.puppySelection.currentActor, deadlineAt: contract.puppySelection.turnDeadlineAt?.toISOString() ?? null, completedAt: contract.puppySelection.completedAt?.toISOString() ?? null, selectedDog: contract.puppySelection.selectedDog ? { id: contract.puppySelection.selectedDog.id, name: formatDogDisplayName(contract.puppySelection.selectedDog) } : null } : null,
    outcome: { originalAttempt: contract.breedingAttempt, liveBornPuppyCount: contract.liveBornPuppyCount, puppyBackMinimumMet: contract.puppyBackMinimumMet, smallLitterReturnServiceMet: contract.smallLitterReturnServiceMet },
    terms: { approvalMode: summary?.approvalSummary ?? contract.approvalMode, noLitterReturnService: contract.noLitterReturnService, smallLitterReturnThreshold: contract.smallLitterReturnThreshold, brucellosisNegativeRequired: contract.brucellosisNegativeRequired, titleRequirement: contract.titleRequirement, healthRequirements: contract.healthRequirements, puppyPickPosition: contract.puppyPickPosition, puppySex: contract.puppySex, minimumLitterSize: contract.minimumLitterSize },
    kennels: { sire: contract.sireKennel, dam: contract.damKennel },
  };
}

export async function listStudContractsForKennel(args: { kennelId: string; cursor?: string | null; statusFilter?: StudContractStatusFilter; actionFilter?: StudContractActionFilter; sortOrder?: StudContractSortOrder }) {
  const now = new Date();
  const currentEpoch = getCurrentEpoch();
  const statusFilter = args.statusFilter ?? "all";
  const actionFilter = args.actionFilter ?? "all";
  const sortOrder = args.sortOrder ?? "newest";
  const rows = await db.studContract.findMany({
    where: historyWhere({ kennelId: args.kennelId, statusFilter, actionFilter, now }),
    orderBy: [{ requestedAt: sortOrder === "newest" ? "desc" : "asc" }, { id: sortOrder === "newest" ? "desc" : "asc" }], take: PAGE_SIZE + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}), include: studContractHistoryArgs.include,
  });
  const hasMore = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE).flatMap((row) => {
    const item = toItem(row, args.kennelId, now, currentEpoch);
    return item ? [item] : [];
  });
  return { items, nextCursor: hasMore ? rows[PAGE_SIZE - 1]?.id ?? null : null, hasMore };
}

export async function getStudContractHistoryDetail(args: { kennelId: string; contractId: string }) {
  const contract = await db.studContract.findFirst({ where: { id: args.contractId, OR: [{ sireKennelId: args.kennelId }, { damKennelId: args.kennelId }] }, include: studContractHistoryArgs.include });
  return toItem(contract, args.kennelId, new Date(), getCurrentEpoch());
}
