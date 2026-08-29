export const SUPPORT_POLICY_STATEMENT =
  "Bronze, Silver, and Gold Supporter badges recognize voluntary monthly support of ShowRing Game. Support level does not affect gameplay, rankings, visibility, or competitive outcomes. Players may choose whether their supporter badge is displayed publicly.";

export const SUPPORT_BADGE_ONLY_BENEFIT =
  "The Supporter badge is currently the only benefit of monthly support.";

export const SUPPORT_TIERS = [
  { tier: "BRONZE", label: "Bronze Supporter", monthlyAmount: 2 },
  { tier: "SILVER", label: "Silver Supporter", monthlyAmount: 5 },
  { tier: "GOLD", label: "Gold Supporter", monthlyAmount: 10 },
] as const;

export type SupportPresentationTier = (typeof SUPPORT_TIERS)[number];
export type SupportPresentationTierValue = SupportPresentationTier["tier"];

export type SupportStatusPresentationValue =
  | "PENDING"
  | "ACTIVE"
  | "PAYMENT_RETRY"
  | "CANCELLATION_SCHEDULED"
  | "ENDED";

export const SUPPORT_STATUS_PRESENTATION: Record<SupportStatusPresentationValue, string> = {
  PENDING: "Pending confirmation",
  ACTIVE: "Active",
  PAYMENT_RETRY: "Payment issue",
  CANCELLATION_SCHEDULED: "Cancelling",
  ENDED: "Not currently supporting",
};

export function getSupportStatusLabel(status: SupportStatusPresentationValue): string {
  return SUPPORT_STATUS_PRESENTATION[status];
}

export const SUPPORT_FAQ = [
  {
    question: "Can I cancel anytime?",
    answer: "Yes. Your support remains active through the paid period after cancellation.",
  },
  {
    question: "Can I change my support level?",
    answer: "Yes. Upgrades are intended to take effect immediately. Downgrades take effect at the next paid-period boundary.",
  },
  {
    question: "Can I hide my supporter badge?",
    answer: "Yes. Players can choose whether their supporter badge is displayed publicly from Account / Settings.",
  },
  {
    question: "Does Gold get gameplay advantages over Bronze?",
    answer: "No. Support level does not affect gameplay, rankings, visibility, or competitive outcomes.",
  },
  {
    question: "Will supporter tiers become Premium tiers later?",
    answer: "No specific mapping is promised. Premium convenience features and pricing will be announced separately before launch.",
  },
] as const;

export function formatSupportAmount(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getSupportTierPresentation(tier: SupportPresentationTierValue): SupportPresentationTier {
  return SUPPORT_TIERS.find((candidate) => candidate.tier === tier) ?? SUPPORT_TIERS[0];
}
