"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { useInitialTheme } from "@/components/ThemeProvider";
import {
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
  isThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const initialTheme = useInitialTheme();
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => initialTheme,
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
    // Fall through to cookie/system fallback.
  }

  const cookieTheme = readThemeCookie();
  if (isThemeMode(cookieTheme)) {
    return cookieTheme;
  }

  return getSystemTheme();
}

function getSystemTheme(): ThemeMode {
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return DEFAULT_THEME;
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
  writeThemeCookie(theme);
  window.dispatchEvent(
    new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: theme }),
  );
}

function readThemeCookie(): string | null {
  const prefix = `${THEME_COOKIE_NAME}=`;
  const item = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix));

  if (!item) {
    return null;
  }

  return decodeURIComponent(item.slice(prefix.length));
}

function writeThemeCookie(theme: ThemeMode) {
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(
    theme,
  )}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
