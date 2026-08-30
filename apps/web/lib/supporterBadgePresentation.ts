import type { SupportPresentationTierValue, SupportStatusPresentationValue } from "@/lib/supportPresentation";

export type SupporterBadgePresentation = { visible: true; tier: SupportPresentationTierValue } | { visible: false };

export function getSupporterBadgePresentation(args: {
  tier?: SupportPresentationTierValue | null;
  status?: SupportStatusPresentationValue | string | null;
  showSupporterBadge: boolean;
  currentPaidPeriodEnd?: Date | null;
  now?: Date;
}): SupporterBadgePresentation {
  if (!args.showSupporterBadge || !args.tier) return { visible: false };
  if (args.status === "ACTIVE" || args.status === "PAYMENT_RETRY") return { visible: true, tier: args.tier };
  if (args.status === "CANCELLATION_SCHEDULED" && args.currentPaidPeriodEnd && args.currentPaidPeriodEnd > (args.now ?? new Date())) return { visible: true, tier: args.tier };
  return { visible: false };
}
