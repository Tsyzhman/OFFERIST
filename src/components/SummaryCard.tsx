import { CalendarClock, CircleDollarSign, Layers3 } from "lucide-react";
import type { ReactNode } from "react";
import {
  calculateGrandTotal,
  calculateOptionalSubtotal,
  calculateRequiredSubtotal,
  calculateTotalDays,
  formatMoney,
} from "@/lib/proposal";
import type { ProposalData } from "@/lib/types";

type SummaryCardProps = {
  data: ProposalData;
  compact?: boolean;
};

export function SummaryCard({ data, compact = false }: SummaryCardProps) {
  const requiredSubtotal = calculateRequiredSubtotal(data.items);
  const optionalSubtotal = calculateOptionalSubtotal(data.items);
  const grandTotal = calculateGrandTotal(data.items);
  const totalDays = calculateTotalDays(data.items);
  const requiredCount = data.items.filter((item) => item.required).length;
  const selectedOptionalCount = data.items.filter(
    (item) => item.optional && item.selected,
  ).length;

  return (
    <aside
      className={`builder-summary rounded-lg border border-zinc-200 bg-white/95 p-4 shadow-sm shadow-zinc-200/60 backdrop-blur ${
        compact ? "" : "sticky top-24 z-20"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Сводка proposal
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">
            {formatMoney(grandTotal, data.project.currency)}
          </h2>
        </div>
        <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
          <CircleDollarSign size={20} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <SummaryMetric
          icon={<Layers3 size={16} aria-hidden="true" />}
          label="Обязательные"
          value={formatMoney(requiredSubtotal, data.project.currency)}
          detail={`${requiredCount} поз.`}
        />
        <SummaryMetric
          icon={<CircleDollarSign size={16} aria-hidden="true" />}
          label="Выбранные опции"
          value={formatMoney(optionalSubtotal, data.project.currency)}
          detail={`${selectedOptionalCount} опц.`}
        />
        <SummaryMetric
          icon={<CalendarClock size={16} aria-hidden="true" />}
          label="Сроки"
          value={`${totalDays} дн.`}
          detail="выбранный объем"
        />
      </div>
    </aside>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
        <span className="text-zinc-700">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-zinc-950">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{detail}</div>
    </div>
  );
}
