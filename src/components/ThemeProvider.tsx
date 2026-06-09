"use client";

import { createContext, useContext } from "react";
import { DEFAULT_THEME, type ThemeMode } from "@/lib/theme";

const InitialThemeContext = createContext<ThemeMode>(DEFAULT_THEME);

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: ThemeMode;
}) {
  return (
    <InitialThemeContext.Provider value={initialTheme}>
      {children}
    </InitialThemeContext.Provider>
  );
}

export function useInitialTheme() {
  return useContext(InitialThemeContext);
}
