"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import {
  isThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "@/lib/theme";

const THEME_CHANGE_EVENT = "prisma-theme-change";

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
  const label =
    nextTheme === "dark" ? "Включить тёмную тему" : "Включить светлую тему";

  function toggleTheme() {
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={theme === "dark"}
      title={label}
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus:ring-4 focus:ring-zinc-100",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun size={17} aria-hidden="true" />
      ) : (
        <Moon size={17} aria-hidden="true" />
      )}
    </button>
  );
}

function subscribeToTheme(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === THEME_STORAGE_KEY) {
      onChange();
    }
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function getThemeSnapshot(): ThemeMode {
  const current = document.documentElement.dataset.theme;
  if (isThemeMode(current)) {
    return current;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(stored)) {
      return stored;
    }
  } catch {
    return getServerThemeSnapshot();
  }

  return getServerThemeSnapshot();
}

function getServerThemeSnapshot(): ThemeMode {
  return "light";
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme still applies for the current page when storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: theme }),
  );
}
