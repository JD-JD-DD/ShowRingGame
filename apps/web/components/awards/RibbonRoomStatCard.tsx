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
    <div className="theme-card rounded-2xl px-4 py-3">
      <div className="theme-label text-[0.68rem] font-semibold uppercase tracking-[0.18em]">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          subdued ? "theme-copy" : "theme-heading"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
