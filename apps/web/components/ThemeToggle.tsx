"use client";

import { useId, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "showring-theme";
const THEME_CHANGE_EVENT = "showring-theme-change";

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, () => "light");
  const selectId = useId();

  function setTheme(nextTheme: Theme) {
    if (nextTheme === theme) return;

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <div className="game-header__color-mode rounded-xl px-3 py-2">
      <label htmlFor={selectId} className="block text-xs font-semibold">
        Color Mode
      </label>
      <select
        id={selectId}
        value={theme}
        onChange={(event) => setTheme(event.target.value as Theme)}
        className="game-header__color-mode-select mt-1 w-full rounded-lg px-2 py-1 text-sm font-semibold"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
