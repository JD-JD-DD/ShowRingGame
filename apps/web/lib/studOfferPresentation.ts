import { PHENOTYPE_HEALTH_TESTS } from "@showring/rules";

export type StudOfferPresentationSnapshot = {
  compensationType: "CASH" | "PUPPY_BACK" | "CASH_AND_PUPPY_BACK";
  cashAmount: number | null;
  puppyPickPosition: "FIRST" | "SECOND" | null;
  puppySex: "EITHER" | "MALE" | "FEMALE" | null;
  brucellosisNegativeRequired: boolean;
  titleRequirement: "NONE" | "CH_OR_HIGHER" | "GCH_OR_HIGHER";
  approvalMode: "AUTOMATIC" | "MANUAL";
  healthRequirements: Array<{
    healthTestCode: string;
    requirementLevel: "NONE" | "GREEN_OR_YELLOW" | "GREEN_ONLY";
  }>;
};

export type CompactStudOfferSummary = {
  compensationSummary: string;
  puppyTermsSummary: string | null;
  restrictionsSummary: string | null;
  approvalSummary: "Automatic Approval" | "Manual Approval";
  requirements: Pick<StudOfferPresentationSnapshot, "brucellosisNegativeRequired" | "healthRequirements" | "titleRequirement">;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCompactStudOfferSummary(
  offer: StudOfferPresentationSnapshot | null
): CompactStudOfferSummary | null {
  if (!offer) return null;

  const cash = offer.cashAmount === null ? null : currencyFormatter.format(offer.cashAmount);
  const compensationSummary =
    offer.compensationType === "CASH"
      ? cash ?? "Cash"
      : offer.compensationType === "PUPPY_BACK"
        ? "Puppy Back"
        : `${cash ?? "Cash"} + Puppy Back`;
  const puppyTermsSummary =
    offer.compensationType === "CASH"
      ? null
      : `${offer.puppyPickPosition === "SECOND" ? "Second" : "First"} Pick • ${offer.puppySex === "MALE" ? "Male" : offer.puppySex === "FEMALE" ? "Female" : "Either"}`;
  const restrictions = offer.healthRequirements.flatMap((requirement) => {
    if (requirement.requirementLevel === "NONE") return [];
    const label = PHENOTYPE_HEALTH_TESTS[requirement.healthTestCode as keyof typeof PHENOTYPE_HEALTH_TESTS]?.label ?? requirement.healthTestCode;
    return [`${label} ${requirement.requirementLevel === "GREEN_ONLY" ? "Green only" : "Green/Yellow"}`];
  });
  if (offer.brucellosisNegativeRequired) restrictions.push("Brucellosis negative");
  if (offer.titleRequirement === "CH_OR_HIGHER") restrictions.push("CH or higher");
  if (offer.titleRequirement === "GCH_OR_HIGHER") restrictions.push("GCH or higher");

  return {
    compensationSummary,
    puppyTermsSummary,
    restrictionsSummary: restrictions.length > 0 ? restrictions.join(" • ") : null,
    approvalSummary:
      offer.approvalMode === "MANUAL" ? "Manual Approval" : "Automatic Approval",
    requirements: {
      brucellosisNegativeRequired: offer.brucellosisNegativeRequired,
      healthRequirements: offer.healthRequirements,
      titleRequirement: offer.titleRequirement,
    },
  };
}
