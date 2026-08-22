import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { formatCompactStudOfferSummary } from "@/lib/studOfferPresentation";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 10;

const contractInclude = {
  sireDog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
  damDog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
  sireKennel: { select: { id: true, name: true } },
  damKennel: { select: { id: true, name: true } },
  healthRequirements: { select: { healthTestCode: true, requirementLevel: true } },
  breedingAttempt: { select: { id: true, status: true, createdEpoch: true } },
  puppySelection: { select: { id: true, status: true, currentActor: true, turnDeadlineAt: true, completedAt: true, selectedDog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } } } },
  returnService: { include: { returnBreedingAttempt: { select: { id: true, status: true, createdEpoch: true } } } },
} as const;
type ContractHistoryRecord = Prisma.StudContractGetPayload<{ include: typeof contractInclude }>;

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

function toItem(contract: ContractHistoryRecord | null, kennelId: string, now = new Date()) {
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
  const manualApproval = contract.status === "PENDING" && contract.approvalMode === "MANUAL" && approvalDeadlineAt
    ? { deadlineAt: approvalDeadlineAt, isAvailable: isStudOwner && approvalDeadline !== null && approvalDeadline > now, availabilityReason: !isStudOwner ? "Awaiting stud-owner decision" : approvalDeadline !== null && approvalDeadline > now ? "Approval required" : "Approval deadline passed" }
    : null;
  const canSelectPuppy = Boolean(contract.puppySelection && selectionIsActive(contract.puppySelection) && contract.puppySelection.turnDeadlineAt && contract.puppySelection.turnDeadlineAt > now && ((contract.puppySelection.currentActor === "STUD_OWNER" && isStudOwner) || (contract.puppySelection.currentActor === "DAM_OWNER" && !isStudOwner)));
  const action = manualApproval?.isAvailable
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

export async function listStudContractsForKennel(args: { kennelId: string; cursor?: string | null }) {
  const rows = await db.studContract.findMany({
    where: { OR: [{ sireKennelId: args.kennelId }, { damKennelId: args.kennelId }] },
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}), include: contractInclude,
  });
  const hasMore = rows.length > PAGE_SIZE;
  const now = new Date();
  const items = rows.slice(0, PAGE_SIZE).flatMap((row) => {
    const item = toItem(row, args.kennelId, now);
    return item ? [item] : [];
  });
  return { items, nextCursor: hasMore ? rows[PAGE_SIZE - 1]?.id ?? null : null, hasMore };
}

export async function getStudContractHistoryDetail(args: { kennelId: string; contractId: string }) {
  const contract = await db.studContract.findFirst({ where: { id: args.contractId, OR: [{ sireKennelId: args.kennelId }, { damKennelId: args.kennelId }] }, include: contractInclude });
  return toItem(contract, args.kennelId);
}
