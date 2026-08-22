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
  puppySelection: { select: { status: true, turnDeadlineAt: true, selectedDog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } } } },
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

function contractLabel(value: { status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED"; puppySelection: { status: string } | null }) {
  if (value.status === "PENDING") return "Pending Approval";
  if (value.status === "DECLINED") return "Declined";
  if (value.status === "EXPIRED") return "Approval Expired";
  if (value.puppySelection && !["SELECTED", "FORFEITED", "UNFULFILLABLE"].includes(value.puppySelection.status)) return "Puppy Selection";
  return "Accepted / Breeding History";
}

function toItem(contract: ContractHistoryRecord | null, kennelId: string) {
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
  const otherKennel = role === "Stud Owner" ? contract.damKennel.name : contract.sireKennel.name;
  return {
    id: contract.id,
    requestedAt: contract.requestedAt.toISOString(), acceptedAt: contract.acceptedAt?.toISOString() ?? null,
    sire: { id: contract.sireDog.id, name: formatDogDisplayName(contract.sireDog) },
    dam: { id: contract.damDog.id, name: formatDogDisplayName(contract.damDog) },
    role, otherKennel, compensationSummary: summary?.compensationSummary ?? "Contract terms unavailable",
    puppyTermsSummary: summary?.puppyTermsSummary ?? null, restrictionsSummary: summary?.restrictionsSummary ?? null,
    lifecycleLabel: contractLabel(contract),
    returnService: contract.returnService ? {
      status: contract.returnService.status, label: returnServiceLabel(contract.returnService),
      expiresAt: contract.returnService.expiresAt.toISOString(), availableAt: contract.returnService.availableAt.toISOString(),
      usedAt: contract.returnService.usedAt?.toISOString() ?? null, extinguishedAt: contract.returnService.extinguishedAt?.toISOString() ?? null,
      trigger: contract.returnService.trigger === "NO_LITTER" ? "No Litter" : "Small Litter",
      returnAttempt: contract.returnService.returnBreedingAttempt,
    } : null,
    puppySelection: contract.puppySelection ? { status: contract.puppySelection.status, deadlineAt: contract.puppySelection.turnDeadlineAt?.toISOString() ?? null, selectedDog: contract.puppySelection.selectedDog ? { id: contract.puppySelection.selectedDog.id, name: formatDogDisplayName(contract.puppySelection.selectedDog) } : null } : null,
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
  const items = rows.slice(0, PAGE_SIZE).flatMap((row) => {
    const item = toItem(row, args.kennelId);
    return item ? [item] : [];
  });
  return { items, nextCursor: hasMore ? rows[PAGE_SIZE - 1]?.id ?? null : null, hasMore };
}

export async function getStudContractHistoryDetail(args: { kennelId: string; contractId: string }) {
  const contract = await db.studContract.findFirst({ where: { id: args.contractId, OR: [{ sireKennelId: args.kennelId }, { damKennelId: args.kennelId }] }, include: contractInclude });
  return toItem(contract, args.kennelId);
}
