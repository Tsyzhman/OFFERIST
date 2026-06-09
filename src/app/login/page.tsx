import { LockKeyhole } from "lucide-react";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const hasError = firstParam(query.error) === "1";
  const nextPath = normalizeNextPath(firstParam(query.next));

  return (
    <main className="flex min-h-screen items-center justify-center bg-main px-4 py-12 text-step-m">
      <section className="w-full max-w-sm rounded-lg border border-white/10 bg-paper p-6 shadow-2xl shadow-black/30">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent">
            <LockKeyhole size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              PRISMA
            </p>
            <h1 className="text-xl font-semibold text-zinc-950">Вход в админку</h1>
          </div>
        </div>

        <form action="/api/admin/session" method="post" className="mt-6 space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Админ-секрет</span>
            <input
              name="secret"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              className="mt-1 h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
            />
          </label>

          {hasError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
              Секрет не подошёл. Проверьте значение `PROPOSAL_ADMIN_SECRET`.
            </p>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-strong focus:outline-none focus:ring-4 focus:ring-accent-soft"
          >
            Войти
          </button>
        </form>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith("/login")) {
    return "/";
  }

  return value;
}
