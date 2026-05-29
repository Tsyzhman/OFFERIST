"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileSignature,
  Layers3,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  calculateGrandTotal,
  calculateItemTotal,
  calculateTotalDays,
  categories,
  categoryLabels,
  formatMoney,
  priorityLabels,
  statusLabels,
  unitLabels,
} from "@/lib/proposal";
import type { ChangeItem, ProposalData } from "@/lib/types";
import { PricingBreakdown } from "./PricingBreakdown";
import { TimelineImpact } from "./TimelineImpact";

type ProposalPreviewProps = {
  data: ProposalData;
  onToggleOptional: (id: string, selected: boolean) => void;
};

export function ProposalPreview({
  data,
  onToggleOptional,
}: ProposalPreviewProps) {
  const requiredItems = data.items.filter((item) => item.required);
  const optionalItems = data.items.filter((item) => item.optional);
  const grandTotal = calculateGrandTotal(data.items);
  const totalDays = calculateTotalDays(data.items);
  const assumptions = splitLines(data.project.assumptions);
  const outOfScope = splitLines(data.project.outOfScope);
  const grouped = categories
    .map((category) => ({
      category,
      items: data.items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);
  const highlights = [
    `${requiredItems.length} обязательных изменений включены в базовый объем.`,
    `${optionalItems.length} опциональных изменений можно подключить по приоритету.`,
    `Итог выбранного объема: ${formatMoney(grandTotal, data.project.currency)}.`,
    `Суммарное влияние на сроки: ${totalDays} дней.`,
    data.project.introSummary,
  ].filter(Boolean);

  return (
    <article className="proposal-preview overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm shadow-zinc-200/70">
      <section className="proposal-section relative overflow-hidden px-6 py-10 sm:px-10 sm:py-12">
        <div className="absolute right-8 top-8 hidden h-24 w-24 rounded-full border border-emerald-200 bg-emerald-50 sm:block" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-zinc-600">
            <span className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3 py-1.5 text-white">
              <BadgeCheck size={16} aria-hidden="true" />
              OFFERIST
            </span>
            <span>{data.project.version}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
            <span>{data.project.proposalDate}</span>
          </div>

          <div className="mt-10 max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Подготовлено для {data.project.clientName || "клиента"}
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-zinc-950 sm:text-6xl">
              {data.project.projectTitle || "Proposal корректировок"}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-600">
              {data.project.introSummary}
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <CoverMetric
              icon={<CircleDollarSign size={20} aria-hidden="true" />}
              label="Итоговая стоимость"
              value={formatMoney(grandTotal, data.project.currency)}
            />
            <CoverMetric
              icon={<CalendarClock size={20} aria-hidden="true" />}
              label="Влияние на сроки"
              value={`${totalDays} дн.`}
            />
            <CoverMetric
              icon={<ClipboardCheck size={20} aria-hidden="true" />}
              label="Подготовил"
              value={data.project.preparedBy || "Team"}
            />
          </div>
        </div>
      </section>

      <section className="proposal-section border-t border-zinc-200 px-6 py-10 sm:px-10">
        <SectionHeading
          eyebrow="Краткое резюме"
          title="Ключевые выводы"
          copy="Proposal разделяет обязательный объем и опции, чтобы быстро согласовать бюджет, сроки и границы работ."
        />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {highlights.slice(0, 5).map((highlight, index) => (
            <div
              key={highlight}
              className="proposal-card rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-sm font-semibold text-emerald-700 shadow-sm">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-zinc-700">{highlight}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="proposal-section border-t border-zinc-200 px-6 py-10 sm:px-10">
        <SectionHeading
          eyebrow="Обзор корректировок"
          title="Состав корректировок"
          copy="Позиции сгруппированы по категории. В каждой карточке показаны ценность для клиента, бюджет, сроки и детали объема."
        />

        <div className="mt-8 space-y-8">
          {grouped.map((group) => (
            <div key={group.category}>
              <div className="mb-3 flex items-center justify-between border-b border-zinc-100 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {categoryLabels[group.category]}
                </h3>
                <span className="text-xs text-zinc-500">
                  {group.items.length} поз.
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((item) => (
                  <ChangePreviewCard
                    key={item.id}
                    item={item}
                    currency={data.project.currency}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <PricingBreakdown data={data} onToggleOptional={onToggleOptional} />
      <TimelineImpact data={data} />

      <section className="proposal-section border-t border-zinc-200 px-6 py-10 sm:px-10">
        <SectionHeading
          eyebrow="Допущения"
          title="Условия оценки"
          copy="Оценка действительна при сохранении этих условий."
        />
        <ListBlock
          icon={<ShieldCheck size={18} aria-hidden="true" />}
          items={assumptions}
          empty="Условия пока не заполнены."
        />
      </section>

      <section className="proposal-section border-t border-zinc-200 px-6 py-10 sm:px-10">
        <SectionHeading
          eyebrow="Не входит в объем"
          title="Что не входит"
          copy="Этот блок помогает избежать неучтенных ожиданий и разрастания объема до старта работ."
        />
        <ListBlock
          icon={<Layers3 size={18} aria-hidden="true" />}
          items={outOfScope}
          empty="Исключения пока не заполнены."
        />
      </section>

      <section className="proposal-section border-t border-zinc-200 px-6 py-10 sm:px-10">
        <SectionHeading
          eyebrow="Согласование"
          title="Следующий шаг"
          copy="После выбора подходящего сценария команда фиксирует объем и готовит старт работ."
        />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <VisualAction
            icon={<CheckCircle2 size={18} aria-hidden="true" />}
            title="Согласовать полный пакет"
            copy="Согласовать обязательные и выбранные optional-позиции."
          />
          <VisualAction
            icon={<ShieldCheck size={18} aria-hidden="true" />}
            title="Согласовать только обязательное"
            copy="Запустить только обязательный объем."
          />
          <VisualAction
            icon={<MessageSquareText size={18} aria-hidden="true" />}
            title="Запросить обсуждение"
            copy="Обсудить объем, приоритеты или сроки."
          />
        </div>

        <div className="proposal-card mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <FileSignature size={18} aria-hidden="true" />
            Согласование клиента
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <SignatureLine label="Имя / подпись клиента" />
            <SignatureLine label="Дата" />
          </div>
        </div>
      </section>
    </article>
  );
}

function ChangePreviewCard({
  item,
  currency,
}: {
  item: ChangeItem;
  currency: string;
}) {
  const included = item.required || item.selected;

  return (
    <article
      className={`proposal-card rounded-lg border p-5 ${
        included
          ? "border-zinc-200 bg-white"
          : "border-zinc-200 bg-zinc-50 text-zinc-500"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.required ? "dark" : "light"}>
              {item.required
                ? "Обязательная"
                : item.selected
                  ? "Опция выбрана"
                  : "Опция"}
            </Badge>
            <Badge tone={item.priority === "high" ? "warning" : "neutral"}>
              {priorityLabels[item.priority]}
            </Badge>
          </div>
          <h3 className="mt-3 text-xl font-semibold text-zinc-950">
            {item.title}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold text-zinc-950">
            {formatMoney(calculateItemTotal(item), currency)}
          </div>
          <div className="text-xs text-zinc-500">
            {item.quantity} x {unitLabels[item.unit]}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-600">{item.description}</p>
      <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
          Ценность для клиента
        </div>
        <p className="mt-1 text-sm leading-6 text-emerald-950">
          {item.clientValue || "Ценность для клиента пока не заполнена."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <span>{item.estimatedDays} дн.</span>
        <span className="h-1 w-1 rounded-full bg-zinc-300" />
        <span>{statusLabels[item.status]}</span>
      </div>

      <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
          Детали
        </summary>
        <div className="mt-3 grid gap-4 text-sm leading-6 text-zinc-600 sm:grid-cols-2">
          <DetailList title="Что входит" items={item.deliverables} />
          <DetailList title="Не входит" items={item.outOfScope} />
        </div>
        {item.dependencyNote ? (
          <div className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-zinc-600">
            <span className="font-semibold text-zinc-900">Зависимости: </span>
            {item.dependencyNote}
          </div>
        ) : null}
      </details>
    </article>
  );
}

function CoverMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="proposal-card rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        <span className="text-emerald-700">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-semibold text-zinc-950">
        {title}
      </h2>
      <p className="mt-3 text-base leading-7 text-zinc-600">{copy}</p>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-semibold text-zinc-900">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <ArrowRight
                size={14}
                className="mt-1 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-zinc-500">Не заполнено.</p>
      )}
    </div>
  );
}

function ListBlock({
  icon,
  items,
  empty,
}: {
  icon: ReactNode;
  items: string[];
  empty: string;
}) {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      {items.length > 0 ? (
        items.map((item) => (
          <div
            key={item}
            className="proposal-card flex gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700"
          >
            <span className="mt-0.5 text-emerald-700">{icon}</span>
            {item}
          </div>
        ))
      ) : (
        <div className="proposal-card rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
          {empty}
        </div>
      )}
    </div>
  );
}

function VisualAction({
  icon,
  title,
  copy,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <button
      type="button"
      disabled
      className="proposal-card cursor-default rounded-lg border border-zinc-200 bg-white p-4 text-left opacity-90"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      <span className="mt-4 block font-semibold text-zinc-950">{title}</span>
      <span className="mt-2 block text-sm leading-6 text-zinc-600">{copy}</span>
    </button>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="h-12 border-b border-zinc-300" />
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
    </div>
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
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
