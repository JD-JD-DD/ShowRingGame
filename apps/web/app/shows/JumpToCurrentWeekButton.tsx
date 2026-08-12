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
      className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
    >
      Jump to Current Week
    </button>
  );
}
