"use client";

import {
  CheckCircle2,
  Copy,
  Layers3,
  Pencil,
  Trash2,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  calculateItemTotal,
  categories,
  categoryLabels,
  formatMoney,
  priorityLabels,
  statusLabels,
  unitLabels,
} from "@/lib/proposal";
import type { ChangeItem } from "@/lib/types";

type ChangeItemListProps = {
  items: ChangeItem[];
  currency: string;
  activeId?: string | null;
  onEdit: (item: ChangeItem) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleType: (id: string, type: "required" | "optional") => void;
  onToggleSelected: (id: string, selected: boolean) => void;
};

export function ChangeItemList({
  items,
  currency,
  activeId,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleType,
  onToggleSelected,
}: ChangeItemListProps) {
  const grouped = categories
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Список корректировок
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">
            Корректировки по категориям
          </h2>
        </div>
        <div className="rounded-md bg-zinc-100 p-2 text-zinc-700">
          <Layers3 size={20} aria-hidden="true" />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
          Пока нет корректировок. Добавьте первую позицию через форму выше.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {grouped.map((group) => (
            <div key={group.category} className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {categoryLabels[group.category]}
                </h3>
                <span className="text-xs text-zinc-500">
                  {group.items.length} поз.
                </span>
              </div>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <ChangeListCard
                    key={item.id}
                    item={item}
                    currency={currency}
                    isActive={activeId === item.id}
                    onEdit={() => onEdit(item)}
                    onDuplicate={() => onDuplicate(item.id)}
                    onDelete={() => onDelete(item.id)}
                    onToggleType={(type) => onToggleType(item.id, type)}
                    onToggleSelected={(selected) =>
                      onToggleSelected(item.id, selected)
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChangeListCard({
  item,
  currency,
  isActive,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleType,
  onToggleSelected,
}: {
  item: ChangeItem;
  currency: string;
  isActive: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleType: (type: "required" | "optional") => void;
  onToggleSelected: (selected: boolean) => void;
}) {
  const itemTotal = calculateItemTotal(item);

  return (
    <article
      className={`rounded-lg border p-3 transition ${
        isActive
          ? "border-emerald-300 bg-emerald-50/60"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-zinc-950">
              {item.title || "Без названия"}
            </h4>
            <Badge tone={item.required ? "dark" : "light"}>
              {item.required ? "Обязательная" : "Опция"}
            </Badge>
            <Badge tone={item.priority === "high" ? "warning" : "neutral"}>
              {priorityLabels[item.priority]}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600">
            {item.description || "Описание пока не заполнено."}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-zinc-950">
            {formatMoney(itemTotal, currency)}
          </div>
          <div className="text-xs text-zinc-500">
            {item.quantity} x {unitLabels[item.unit]}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
        <div className="rounded-md bg-zinc-50 px-2 py-1">
          Статус: <span className="font-medium text-zinc-700">{statusLabels[item.status]}</span>
        </div>
        <div className="rounded-md bg-zinc-50 px-2 py-1">
          Дни: <span className="font-medium text-zinc-700">{item.estimatedDays}</span>
        </div>
        <div className="rounded-md bg-zinc-50 px-2 py-1">
          Объем:{" "}
          <span className="font-medium text-zinc-700">
            {item.deliverables.length} пункт.
          </span>
        </div>
      </div>

      {item.internalNote ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          Внутренне: {item.internalNote}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid h-9 grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1">
            <button
              type="button"
              onClick={() => onToggleType("required")}
              className={`rounded px-2 text-xs font-semibold transition ${
                item.required
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Обязательная
            </button>
            <button
              type="button"
              onClick={() => onToggleType("optional")}
              className={`rounded px-2 text-xs font-semibold transition ${
                item.optional
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Опция
            </button>
          </div>
          <label className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-2 text-xs font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={item.optional ? item.selected : true}
              disabled={!item.optional}
              onChange={(event) => onToggleSelected(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500"
            />
            Выбрана
          </label>
        </div>

        <div className="flex items-center gap-1">
          <IconButton label="Редактировать" onClick={onEdit}>
            <Pencil size={15} aria-hidden="true" />
          </IconButton>
          <IconButton label="Дублировать" onClick={onDuplicate}>
            <Copy size={15} aria-hidden="true" />
          </IconButton>
          <IconButton label="Удалить" onClick={onDelete} danger>
            <Trash2 size={15} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function IconButton({
  label,
  children,
  onClick,
  danger = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition ${
        danger
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "dark" | "light" | "warning" | "neutral";
}) {
  const tones = {
    dark: "bg-zinc-950 text-white",
    light: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    neutral: "bg-zinc-100 text-zinc-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {tone === "dark" ? <CheckCircle2 size={12} aria-hidden="true" /> : null}
      {tone === "light" ? <WalletCards size={12} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
