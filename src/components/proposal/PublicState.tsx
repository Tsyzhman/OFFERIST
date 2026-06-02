import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PublicState({
  title,
  copy,
  showDashboardLink = false,
}: {
  title: string;
  copy: string;
  showDashboardLink?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-center text-zinc-950">
      <ThemeToggle className="fixed right-4 top-4 z-10 no-print" />
      <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          PRISMA
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600">{copy}</p>
        {showDashboardLink ? (
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Вернуться к списку КП
          </Link>
        ) : null}
      </div>
    </main>
  );
}
