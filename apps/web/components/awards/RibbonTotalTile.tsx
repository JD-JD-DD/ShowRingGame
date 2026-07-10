type RibbonTotalTileProps = {
  label: string;
  count: number;
  assetPath: string;
  alt: string;
};

export function RibbonTotalTile({
  label,
  count,
  assetPath,
  alt,
}: RibbonTotalTileProps) {
  const subdued = count === 0;

  return (
    <div
      className={`flex h-full flex-col items-center rounded-2xl border px-3 py-4 text-center ${
        subdued
          ? "border-white/10 bg-black/20"
          : "border-[var(--dog-border)] bg-white/5"
      }`}
    >
      <div className="flex min-h-32 w-full items-center justify-center">
        <img
          src={assetPath}
          alt={alt}
          className={`h-28 w-full object-contain ${subdued ? "opacity-55" : ""}`}
        />
      </div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dog-label)]">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl font-bold ${
          subdued ? "text-[var(--dog-copy)]" : "text-white"
        }`}
      >
        {count}
      </div>
    </div>
  );
}
