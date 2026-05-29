"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Copy,
  Eye,
  FilePenLine,
  Link2,
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
import { Badge, Button, Toast } from "@/components/proposal/Ui";

type DashboardClientProps = {
  proposals: Proposal[];
};

const filters: Array<{ id: ProposalListFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "draft", label: "Черновики" },
  { id: "published", label: "Опубликованные" },
  { id: "hidden", label: "Скрытые" },
  { id: "expired", label: "Истёкшие" },
  { id: "approved", label: "Одобренные" },
  { id: "rejected", label: "Отклонённые" },
];

export function DashboardClient({ proposals }: DashboardClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(proposals);
  const [filter, setFilter] = useState<ProposalListFilter>("all");
  const [toast, setToast] = useState<ToastState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

    setItems((current) => [result.proposal as Proposal, ...current]);
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

    setItems((current) => current.filter((proposal) => proposal.id !== id));
    showToast("success", "КП удалено");
  }

  function showToast(tone: NonNullable<ToastState>["tone"], message: string) {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 2400);
  }

  return (
    <main className="bg-noise min-h-screen bg-main px-4 py-6 text-paper">
      <div className="relative z-10 mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-4 rounded-lg border border-white/10 bg-paper p-5 text-zinc-950 shadow-xl shadow-black/20 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              OFFERIST
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Коммерческие предложения
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Создавайте КП, публикуйте приватные клиентские ссылки и отслеживайте просмотры без лишних персональных данных.
            </p>
          </div>
          <Link href="/proposal/new">
            <Button className="w-full lg:w-auto">
              <Plus size={18} aria-hidden="true" />
              Новое КП
            </Button>
          </Link>
        </header>

        <section className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  filter === item.id
                    ? "bg-accent text-white"
                    : "bg-white/10 text-paper/80 hover:bg-white/15 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-paper text-zinc-950 shadow-xl shadow-black/20">
          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">КП</th>
                    <th className="px-4 py-3">Клиент</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3">Обновлено</th>
                    <th className="px-4 py-3">Публикация</th>
                    <th className="px-4 py-3">Срок действия</th>
                    <th className="px-4 py-3">Просмотры</th>
                    <th className="px-4 py-3">Цена</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map((proposal) => {
                    const status = getEffectiveStatus(proposal);
                    const pack = getRecommendedPackage(proposal);

                    return (
                      <tr key={proposal.id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-zinc-950">
                            {proposal.title}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            Версия {proposal.version}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-zinc-800">
                            {proposal.clientName || "Клиент не указан"}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {proposal.clientCompany || "Компания не указана"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={proposalStatusTone[status]}>
                            {proposalStatusLabels[status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-zinc-600">
                          {formatDateTime(proposal.updatedAt)}
                        </td>
                        <td className="px-4 py-4 text-zinc-600">
                          {proposal.publishedAt
                            ? formatDateTime(proposal.publishedAt)
                            : "Не опубликовано"}
                        </td>
                        <td className="px-4 py-4 text-zinc-600">
                          {formatDate(proposal.validUntil)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-zinc-900">
                            {proposal.viewsCount}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {formatDateTime(proposal.lastViewedAt)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-zinc-700">
                          {pack ? formatMoney(pack.price, proposal.currency) : "Не указано"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <IconLink href={`/proposal/${proposal.id}/edit`} label="Редактировать">
                              <FilePenLine size={16} aria-hidden="true" />
                            </IconLink>
                            <IconLink href={`/proposal/${proposal.id}/preview`} label="Предпросмотр">
                              <Eye size={16} aria-hidden="true" />
                            </IconLink>
                            <IconButton onClick={() => copyLink(proposal)} label="Скопировать ссылку">
                              <Copy size={16} aria-hidden="true" />
                            </IconButton>
                            <IconLink href={`/proposal/${proposal.id}/edit#sharing`} label="Настройки публикации">
                              <Settings2 size={16} aria-hidden="true" />
                            </IconLink>
                            <IconButton
                              onClick={() => duplicate(proposal.id)}
                              label="Дублировать"
                              disabled={busyId === proposal.id}
                            >
                              <CopyPlus size={16} aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              onClick={() => remove(proposal.id)}
                              label="Удалить"
                              disabled={busyId === proposal.id}
                              danger
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-4 py-12 text-center">
              <Link2 size={32} className="text-zinc-400" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-semibold text-zinc-950">
                КП не найдены
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
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
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
    >
      {children}
    </Link>
  );
}

function IconButton({
  label,
  children,
  danger,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
      }`}
    >
      {children}
    </button>
  );
}
