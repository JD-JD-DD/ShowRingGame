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
    <div className="rounded-2xl border border-[var(--dog-border)] bg-black/20 px-4 py-3">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--dog-label)]">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${
          subdued ? "text-[var(--dog-copy)]" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
