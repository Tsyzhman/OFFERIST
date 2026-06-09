export const THEME_STORAGE_KEY = "prisma-theme";
export const THEME_COOKIE_NAME = THEME_STORAGE_KEY;
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const DEFAULT_THEME: ThemeMode = "dark";
export const THEME_CHANGE_EVENT = "prisma-theme-change";

export type ThemeMode = "light" | "dark";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function resolveThemeMode(
  value: unknown,
  fallback: ThemeMode = DEFAULT_THEME,
): ThemeMode {
  return isThemeMode(value) ? value : fallback;
}
