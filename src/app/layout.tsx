import type { Metadata } from "next";
import { Onest } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import {
  DEFAULT_THEME,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  resolveThemeMode,
} from "@/lib/theme";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const themeScript = `
(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const cookieName = ${JSON.stringify(THEME_COOKIE_NAME)};
  const cookieMaxAge = ${JSON.stringify(THEME_COOKIE_MAX_AGE_SECONDS)};
  const fallbackTheme = ${JSON.stringify(DEFAULT_THEME)};
  const isThemeMode = (value) => value === "light" || value === "dark";
  const readCookieTheme = () => {
    const prefix = cookieName + "=";
    const item = document.cookie
      .split("; ")
      .find((part) => part.startsWith(prefix));
    if (!item) return null;
    return decodeURIComponent(item.slice(prefix.length));
  };
  const writeCookieTheme = (theme) => {
    document.cookie = cookieName + "=" + encodeURIComponent(theme)
      + "; Path=/; Max-Age=" + cookieMaxAge + "; SameSite=Lax";
  };

  try {
    const stored = window.localStorage.getItem(storageKey);
    const cookieTheme = readCookieTheme();
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const theme = isThemeMode(stored)
      ? stored
      : isThemeMode(cookieTheme)
        ? cookieTheme
        : systemTheme;

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (stored !== theme) {
      window.localStorage.setItem(storageKey, theme);
    }
    if (cookieTheme !== theme) {
      writeCookieTheme(theme);
    }
  } catch {
    const current = document.documentElement.dataset.theme;
    const theme = isThemeMode(current) ? current : fallbackTheme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }
})();
`;

export const metadata: Metadata = {
  title: "PRISMA",
  description:
    "PRISMA — коммерческие предложения по приватной ссылке",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = resolveThemeMode(
    cookieStore.get(THEME_COOKIE_NAME)?.value,
  );

  return (
    <html
      lang="ru"
      className={`${onest.variable} h-full antialiased`}
      data-theme={initialTheme}
      style={{ colorScheme: initialTheme }}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="prisma-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
