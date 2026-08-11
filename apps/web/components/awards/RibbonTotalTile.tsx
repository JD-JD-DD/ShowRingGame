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
      className="flex h-full flex-col items-center rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-4 text-center shadow-[var(--shadow-soft)]"
    >
      <div className="flex min-h-[9.5rem] w-full items-center justify-center rounded-[18px] bg-[var(--color-surface-inset)] px-2">
        <img
          src={assetPath}
          alt={alt}
          className={`h-32 w-full object-contain ${subdued ? "opacity-55 saturate-75" : ""}`}
        />
      </div>
      <div className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold tracking-tight ${
          subdued ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text)]"
        }`}
      >
        {count}
      </div>
    </div>
  );
}
