import { AlertTriangle, CalendarDays } from "lucide-react";
import { calculateTotalDays, categoryLabels } from "@/lib/proposal";
import type { ProposalData } from "@/lib/types";

type TimelineImpactProps = {
  data: ProposalData;
};

export function TimelineImpact({ data }: TimelineImpactProps) {
  const includedItems = data.items.filter(
    (item) => item.required || (item.optional && item.selected),
  );
  const totalDays = calculateTotalDays(data.items);
  const maxDays = Math.max(...includedItems.map((item) => item.estimatedDays), 1);

  return (
    <section className="proposal-section border-t border-zinc-200 px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Влияние на сроки
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-zinc-950">
            Влияние на сроки
          </h2>
          <p className="mt-3 text-base leading-7 text-zinc-600">
            Срок указан как суммарная оценка выбранного объема. Позиции с
            высоким приоритетом выделены отдельно.
          </p>
        </div>
        <div className="proposal-card rounded-lg border border-zinc-200 bg-white p-4 text-right">
          <div className="flex items-center justify-end gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            <CalendarDays size={16} aria-hidden="true" />
            Суммарная оценка
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-950">
            {totalDays}
          </div>
        </div>
      </div>

      <div className="mt-7 space-y-3">
        {includedItems.map((item) => (
          <div
            key={item.id}
            className={`proposal-card rounded-lg border p-4 ${
              item.priority === "high"
                ? "border-amber-200 bg-amber-50"
                : "border-zinc-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-zinc-950">{item.title}</h3>
                  {item.priority === "high" ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                      <AlertTriangle size={13} aria-hidden="true" />
                      Высокий приоритет
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {categoryLabels[item.category]}
                </p>
              </div>
              <div className="text-sm font-semibold text-zinc-950">
                {item.estimatedDays} дн.
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${
                  item.priority === "high" ? "bg-amber-500" : "bg-emerald-600"
                }`}
                style={{
                  width: `${Math.max(8, (item.estimatedDays / maxDays) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
