"use client";

import { useId, useSyncExternalStore } from "react";

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "forest-glen", label: "Forest Glen" },
  { value: "seaside", label: "Seaside" },
  { value: "galaxy-light", label: "Galaxy Light" },
  { value: "rosewood", label: "Rosewood" },
  { value: "high-desert", label: "High Desert" },
  { value: "midnight-forest", label: "Midnight Forest" },
  { value: "deep-sea", label: "Deep Sea" },
  { value: "galaxy", label: "Galaxy" },
  { value: "black-cherry", label: "Black Cherry" },
  { value: "ember", label: "Ember" },
] as const;

type Theme = (typeof themeOptions)[number]["value"];

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
  const currentTheme = document.documentElement.dataset.theme;

  return themeOptions.some((option) => option.value === currentTheme)
    ? (currentTheme as Theme)
    : "light";
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
        {themeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
