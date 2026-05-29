"use client";

import { CheckSquare, Square } from "lucide-react";
import {
  calculateGrandTotal,
  calculateItemTotal,
  calculateOptionalSubtotal,
  calculateRequiredSubtotal,
  categoryLabels,
  formatMoney,
  unitLabels,
} from "@/lib/proposal";
import type { ChangeItem, ProposalData } from "@/lib/types";

type PricingBreakdownProps = {
  data: ProposalData;
  onToggleOptional: (id: string, selected: boolean) => void;
};

export function PricingBreakdown({
  data,
  onToggleOptional,
}: PricingBreakdownProps) {
  const currency = data.project.currency;
  const requiredSubtotal = calculateRequiredSubtotal(data.items);
  const optionalSubtotal = calculateOptionalSubtotal(data.items);
  const grandTotal = calculateGrandTotal(data.items);

  return (
    <section className="proposal-section border-t border-zinc-200 px-6 py-10 sm:px-10">
      <SectionHeading
        eyebrow="Бюджет"
        title="Стоимость по позициям"
        copy="Опциональные позиции можно включать и выключать локально, чтобы сразу увидеть влияние на итоговый бюджет."
      />

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[760px] border-collapse bg-white text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Позиция</th>
              <th className="px-4 py-3 font-semibold">Категория</th>
              <th className="px-4 py-3 font-semibold">Тип</th>
              <th className="px-4 py-3 font-semibold">Кол-во</th>
              <th className="px-4 py-3 font-semibold">Ед.</th>
              <th className="px-4 py-3 font-semibold">Цена</th>
              <th className="px-4 py-3 text-right font-semibold">Итого</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.items.map((item) => (
              <PricingRow
                key={item.id}
                item={item}
                currency={currency}
                onToggleOptional={onToggleOptional}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <TotalTile
          label="Обязательные"
          value={formatMoney(requiredSubtotal, currency)}
        />
        <TotalTile
          label="Выбранные опции"
          value={formatMoney(optionalSubtotal, currency)}
        />
        <TotalTile
          label="Итого"
          value={formatMoney(grandTotal, currency)}
          strong
        />
      </div>

      {data.project.paymentTerms ? (
        <div className="proposal-card mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
          <span className="font-semibold">Условия оплаты: </span>
          {data.project.paymentTerms}
        </div>
      ) : null}
    </section>
  );
}

function PricingRow({
  item,
  currency,
  onToggleOptional,
}: {
  item: ChangeItem;
  currency: string;
  onToggleOptional: (id: string, selected: boolean) => void;
}) {
  const included = item.required || item.selected;

  return (
    <tr className={included ? "text-zinc-800" : "text-zinc-400"}>
      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-3">
          {item.optional ? (
            <label className="no-print mt-0.5 inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(event) =>
                  onToggleOptional(item.id, event.target.checked)
                }
                className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500"
              />
            </label>
          ) : (
            <span className="mt-0.5 text-zinc-900">
              <CheckSquare size={16} aria-hidden="true" />
            </span>
          )}
          <div>
            <div className="font-medium text-zinc-950">{item.title}</div>
            {item.optional ? (
              <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                {item.selected ? (
                  <CheckSquare size={13} aria-hidden="true" />
                ) : (
                  <Square size={13} aria-hidden="true" />
                )}
                {item.selected ? "Выбрана" : "Не выбрана"}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top">{categoryLabels[item.category]}</td>
      <td className="px-4 py-3 align-top">
        {item.required ? "Обязательная" : "Опция"}
      </td>
      <td className="px-4 py-3 align-top">{item.quantity}</td>
      <td className="px-4 py-3 align-top">{unitLabels[item.unit]}</td>
      <td className="px-4 py-3 align-top">
        {formatMoney(item.price, currency)}
      </td>
      <td className="px-4 py-3 text-right align-top font-semibold text-zinc-950">
        {formatMoney(calculateItemTotal(item), currency)}
      </td>
    </tr>
  );
}

function TotalTile({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`proposal-card rounded-lg border p-4 ${
        strong
          ? "border-zinc-950 bg-zinc-950 text-white"
          : "border-zinc-200 bg-white text-zinc-950"
      }`}
    >
      <div
        className={`text-xs font-semibold uppercase tracking-[0.14em] ${
          strong ? "text-zinc-300" : "text-zinc-500"
        }`}
      >
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
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
