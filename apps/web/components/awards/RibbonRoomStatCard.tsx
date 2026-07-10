type RibbonRoomStatCardProps = {
  label: string;
  value: number | string;
  subdued?: boolean;
};

export function RibbonRoomStatCard({
  label,
  value,
  subdued = false,
}: RibbonRoomStatCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--dog-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(5,10,24,0.5))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          subdued ? "text-[var(--dog-copy)]" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
