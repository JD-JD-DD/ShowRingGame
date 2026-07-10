export type InvitationalRecognitionBadgeProps = {
  label: string;
  className?: string;
};

const badgeClassName =
  "inline-flex max-w-full items-center justify-center rounded-full border border-[#9a741b]/70 bg-[linear-gradient(135deg,#fff6bf_0%,#d5a737_44%,#f7e8a1_70%,#8f681a_100%)] px-3 py-1 text-xs font-semibold text-[#211226] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_3px_rgba(15,23,42,0.22)] ring-1 ring-white/25";

export function InvitationalRecognitionBadge({
  label,
  className,
}: InvitationalRecognitionBadgeProps) {
  return (
    <span className={[badgeClassName, className].filter(Boolean).join(" ")}>
      {label}
    </span>
  );
}
