"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FilePenLine,
  Link2,
  MoreHorizontal,
  Plus,
  Settings2,
  Trash2,
  CopyPlus,
} from "lucide-react";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  getEffectiveStatus,
  getPublicUrl,
  getRecommendedPackage,
  proposalStatusLabels,
  proposalStatusTone,
} from "@/lib/proposal";
import type { Proposal, ProposalListFilter, ToastState } from "@/lib/types";
import { Toast } from "@/components/proposal/Ui";

type DashboardClientProps = {
  proposals: Proposal[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_PAGE_LIMIT = 50;
const SHOW_ALL_LIMIT = 500;

const filters: Array<{ id: ProposalListFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "draft", label: "Черновики" },
  { id: "published", label: "Опубликованные" },
  { id: "hidden", label: "Скрытые" },
  { id: "expired", label: "Истёкшие" },
  { id: "approved", label: "Одобренные" },
  { id: "rejected", label: "Отклонённые" },
];

export function DashboardClient({
  proposals,
  total,
  limit,
  offset,
}: DashboardClientProps) {
  const router = useRouter();
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<ProposalListFilter>("all");
  const [toast, setToast] = useState<ToastState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const items = useMemo(
    () => proposals.filter((proposal) => !removedIds.has(proposal.id)),
    [proposals, removedIds],
  );
  const totalItems = Math.max(0, total - removedIds.size);
  const currentPage = Math.floor(offset / limit) + 1;
  const shownFrom = items.length > 0 ? offset + 1 : 0;
  const shownTo = Math.min(offset + items.length, totalItems);
  const hasPrevious = currentPage > 1;
  const hasNext = shownTo < totalItems;
  const filterCounts = useMemo(() => {
    const counts: Partial<Record<ProposalListFilter, number>> = { all: items.length };
    for (const proposal of items) {
      const status = getEffectiveStatus(proposal);
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") {
      return items;
    }

    return items.filter((proposal) => getEffectiveStatus(proposal) === filter);
  }, [filter, items]);

  async function copyLink(proposal: Proposal) {
    if (getEffectiveStatus(proposal) !== "published") {
      showToast(
        "warning",
        "Сначала опубликуйте КП, чтобы скопировать клиентскую ссылку.",
      );
      return;
    }

    const url = getPublicUrl(window.location.origin, proposal.shareSlug);

    try {
      await navigator.clipboard.writeText(url);
      showToast("success", "Ссылка скопирована");
    } catch {
      window.prompt("Скопируйте клиентскую ссылку", url);
      showToast("success", "Клиентская ссылка готова");
    }
  }

  async function duplicate(id: string) {
    setBusyId(id);
    const response = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateFromId: id }),
    });
    const result = (await response.json()) as { proposal?: Proposal; error?: string };
    setBusyId(null);

    if (!response.ok || !result.proposal) {
      showToast("error", result.error || "Не удалось дублировать КП");
      return;
    }

    router.push(`/proposal/${result.proposal.id}/edit`);
  }

  async function remove(id: string) {
    const confirmed = window.confirm("Удалить КП? Это действие нельзя отменить.");
    if (!confirmed) {
      return;
    }

    setBusyId(id);
    const response = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    setBusyId(null);

    if (!response.ok) {
      showToast("error", "Не удалось удалить КП");
      return;
    }

    setRemovedIds((current) => new Set(current).add(id));
    showToast("success", "КП удалено");
  }

  function showToast(tone: NonNullable<ToastState>["tone"], message: string) {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 2400);
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/"
            className="text-base font-semibold tracking-[0.18em] text-zinc-900"
          >
            PRISMA
          </Link>
          <Link
            href="/proposal/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            <Plus size={16} aria-hidden="true" />
            Новое КП
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-6 py-10">
        <section className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Коммерческие предложения
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Создавайте КП, публикуйте приватные клиентские ссылки и отслеживайте
            просмотры без лишних персональных данных.
          </p>
        </section>

        <div className="mt-8 border-b border-zinc-200">
          <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-1">
            {filters.map((item) => {
              const count = filterCounts[item.id] ?? 0;
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`group inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition ${
                    active
                      ? "border-zinc-900 text-zinc-950"
                      : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
                  }`}
                >
                  {item.label}
                  {count > 0 ? (
                    <span
                      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                        active
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {filtered.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">КП</th>
                      <th className="px-5 py-3 font-semibold">Клиент</th>
                      <th className="px-5 py-3 font-semibold">Статус</th>
                      <th className="px-5 py-3 font-semibold">Обновлено</th>
                      <th className="px-5 py-3 font-semibold">Срок</th>
                      <th className="px-5 py-3 font-semibold">Просмотры</th>
                      <th className="px-5 py-3 text-right font-semibold">Цена</th>
                      <th className="w-0 px-5 py-3 font-semibold">
                        <span className="sr-only">Действия</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filtered.map((proposal) => {
                      const status = getEffectiveStatus(proposal);
                      const pack = getRecommendedPackage(proposal);

                      return (
                        <tr
                          key={proposal.id}
                          className="align-middle transition hover:bg-zinc-50"
                        >
                          <td className="px-5 py-4">
                            <Link
                              href={`/proposal/${proposal.id}/edit`}
                              className="block font-semibold text-zinc-950 hover:underline"
                            >
                              {proposal.title}
                            </Link>
                            <div className="mt-0.5 text-xs text-zinc-500">
                              v{proposal.version}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-medium text-zinc-800">
                              {proposal.clientName || (
                                <span className="text-zinc-400">— не указан</span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-500">
                              {proposal.clientCompany || ""}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <StatusDot
                              tone={proposalStatusTone[status]}
                              label={proposalStatusLabels[status]}
                            />
                          </td>
                          <td className="px-5 py-4 text-zinc-600">
                            {formatDateTime(proposal.updatedAt)}
                          </td>
                          <td className="px-5 py-4 text-zinc-600">
                            {formatDate(proposal.validUntil)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-semibold tabular-nums text-zinc-900">
                              {proposal.viewsCount}
                            </div>
                            {proposal.lastViewedAt ? (
                              <div className="mt-0.5 text-xs text-zinc-500">
                                {formatDateTime(proposal.lastViewedAt)}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-5 py-4 text-right font-medium tabular-nums text-zinc-800">
                            {pack ? formatMoney(pack.price, proposal.currency) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <IconLink
                                href={`/proposal/${proposal.id}/edit`}
                                label="Редактировать"
                              >
                                <FilePenLine size={16} aria-hidden="true" />
                              </IconLink>
                              <IconButton
                                onClick={() => copyLink(proposal)}
                                label="Скопировать ссылку"
                              >
                                <Copy size={16} aria-hidden="true" />
                              </IconButton>
                              <RowMenu
                                proposalId={proposal.id}
                                disabled={busyId === proposal.id}
                                onDuplicate={() => duplicate(proposal.id)}
                                onRemove={() => remove(proposal.id)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col items-start justify-between gap-3 border-t border-zinc-200 px-5 py-3 text-xs text-zinc-500 md:flex-row md:items-center">
                <span>
                  Показано {shownFrom}–{shownTo} из {totalItems}
                </span>
                <div className="flex items-center gap-1">
                  {limit < SHOW_ALL_LIMIT && totalItems > limit ? (
                    <Link
                      href={pageHref(1, Math.min(totalItems, SHOW_ALL_LIMIT))}
                      className="inline-flex h-8 items-center rounded-md px-2.5 font-semibold text-zinc-700 transition hover:bg-zinc-100"
                    >
                      Все ({Math.min(totalItems, SHOW_ALL_LIMIT)})
                    </Link>
                  ) : null}
                  <PageNav
                    href={hasPrevious ? pageHref(currentPage - 1, limit) : null}
                    label="Назад"
                    icon={<ChevronLeft size={14} aria-hidden="true" />}
                  />
                  <PageNav
                    href={hasNext ? pageHref(currentPage + 1, limit) : null}
                    label="Далее"
                    icon={<ChevronRight size={14} aria-hidden="true" />}
                    trailing
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-4 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <Link2 size={20} aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-zinc-950">
                КП не найдены
              </h2>
              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                В выбранном фильтре пока нет коммерческих предложений.
              </p>
            </div>
          )}
        </section>
      </div>
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </main>
  );
}

function pageHref(page: number, limit: number) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (limit !== DEFAULT_PAGE_LIMIT) {
    params.set("limit", String(limit));
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function StatusDot({ tone, label }: { tone: string; label: string }) {
  const dotColor = resolveDotColor(tone);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-zinc-700">
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`}
      />
      {label}
    </span>
  );
}

function resolveDotColor(tone: string): string {
  if (tone.includes("emerald")) return "bg-emerald-500";
  if (tone.includes("teal")) return "bg-teal-500";
  if (tone.includes("amber")) return "bg-amber-500";
  if (tone.includes("rose")) return "bg-rose-500";
  if (tone.includes("slate")) return "bg-slate-400";
  return "bg-zinc-400";
}

function PageNav({
  href,
  label,
  icon,
  trailing,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  trailing?: boolean;
}) {
  const className =
    "inline-flex h-8 items-center gap-1 rounded-md px-2.5 font-semibold transition";

  if (!href) {
    return (
      <span className={`${className} text-zinc-300`}>
        {!trailing && icon}
        {label}
        {trailing && icon}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${className} text-zinc-700 hover:bg-zinc-100`}
    >
      {!trailing && icon}
      {label}
      {trailing && icon}
    </Link>
  );
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
    >
      {children}
    </Link>
  );
}

function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function RowMenu({
  proposalId,
  disabled,
  onDuplicate,
  onRemove,
}: {
  proposalId: string;
  disabled: boolean;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handle(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", handle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", handle);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Ещё"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg shadow-zinc-900/5"
        >
          <MenuLink
            href={`/proposal/${proposalId}/preview`}
            onSelect={() => setOpen(false)}
            icon={<Eye size={14} aria-hidden="true" />}
          >
            Предпросмотр
          </MenuLink>
          <MenuLink
            href={`/proposal/${proposalId}/edit#sharing`}
            onSelect={() => setOpen(false)}
            icon={<Settings2 size={14} aria-hidden="true" />}
          >
            Настройки публикации
          </MenuLink>
          <MenuButton
            onSelect={() => {
              setOpen(false);
              onDuplicate();
            }}
            icon={<CopyPlus size={14} aria-hidden="true" />}
          >
            Дублировать
          </MenuButton>
          <div className="my-1 h-px bg-zinc-100" />
          <MenuButton
            onSelect={() => {
              setOpen(false);
              onRemove();
            }}
            icon={<Trash2 size={14} aria-hidden="true" />}
            danger
          >
            Удалить
          </MenuButton>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onSelect,
  icon,
  children,
}: {
  href: string;
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
    >
      <span className="text-zinc-400">{icon}</span>
      {children}
    </Link>
  );
}

function MenuButton({
  onSelect,
  icon,
  children,
  danger,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
        danger
          ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
      }`}
    >
      <span className={danger ? "text-rose-400" : "text-zinc-400"}>{icon}</span>
      {children}
    </button>
  );
}
