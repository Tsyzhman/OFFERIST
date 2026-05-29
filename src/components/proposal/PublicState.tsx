import Link from "next/link";

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
    <main className="bg-noise flex min-h-screen items-center justify-center bg-main px-4 text-center text-zinc-950">
      <div className="relative z-10 max-w-md rounded-lg border border-white/10 bg-paper p-8 shadow-xl shadow-black/25">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          OFFERIST
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600">{copy}</p>
        {showDashboardLink ? (
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Вернуться к списку КП
          </Link>
        ) : null}
      </div>
    </main>
  );
}
