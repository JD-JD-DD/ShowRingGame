"use client";

export function JumpToCurrentWeekButton() {
  return (
    <button
      type="button"
      onClick={() => {
        document
          .getElementById("current-week")
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
        window.history.replaceState(null, "", "#current-week");
      }}
      className="rounded-2xl border border-fuchsia-300/35 bg-fuchsia-500/10 px-5 py-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
    >
      Jump to Current Week
    </button>
  );
}
