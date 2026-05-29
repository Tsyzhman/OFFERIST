"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSignature,
  MessageCircle,
  Printer,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  formatDate,
  formatMoney,
  getRecommendedPackage,
} from "@/lib/proposal";
import type { Proposal, ProposalPackage, ToastState } from "@/lib/types";
import { Badge, Button, Toast } from "./Ui";

type PublicProposalViewProps = {
  proposal: Proposal;
  previewMode?: boolean;
};

export function PublicProposalView({
  proposal,
  previewMode = false,
}: PublicProposalViewProps) {
  const recommended = getRecommendedPackage(proposal);
  const [selectedPackageId, setSelectedPackageId] = useState(
    proposal.selectedPackageId || recommended?.id,
  );
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const selectedPackage = useMemo(
    () =>
      proposal.packages.find((item) => item.id === selectedPackageId) ??
      recommended,
    [proposal.packages, recommended, selectedPackageId],
  );
  const showPrices = proposal.shareSettings.showPrices;
  const showTimeline = proposal.shareSettings.showTimeline;

  async function selectPackage(item: ProposalPackage) {
    setSelectedPackageId(item.id);

    if (!previewMode) {
      await track("package_selected", {
        packageId: item.id,
        metadata: { packageName: item.name },
      });
    }

    showToast("success", "Пакет выбран. Мы увидим ваш выбор в КП.");
  }

  async function handleCta(action: string) {
    if (action === "download_pdf") {
      window.print();
    }

    if (!previewMode) {
      await track("cta_clicked", { metadata: { action, comment } });
    }

    showToast(
      "success",
      "Спасибо, действие зафиксировано. Мы свяжемся с вами для следующего шага.",
    );
  }

  async function track(
    eventType: "package_selected" | "cta_clicked",
    payload: { packageId?: string; metadata?: Record<string, unknown> },
  ) {
    await fetch("/api/public-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shareSlug: proposal.shareSlug,
        eventType,
        ...payload,
      }),
    }).catch(() => undefined);
  }

  function showToast(tone: NonNullable<ToastState>["tone"], message: string) {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 2600);
  }

  return (
    <article className="min-h-screen bg-paper text-zinc-950">
      <div className="fixed bottom-5 right-5 z-40 flex flex-wrap gap-2 no-print">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          Сохранить PDF
        </Button>
      </div>

      <section className="bg-noise relative overflow-hidden border-b border-white/10 bg-main text-white">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(142,68,173,0.28),rgba(230,126,34,0.12)_56%,rgba(2,11,20,0)_86%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_320px] lg:py-20">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
              <span className="inline-flex items-center gap-2 rounded-md bg-paper px-3 py-1.5 font-semibold text-zinc-950">
                <BadgeCheck size={16} aria-hidden="true" />
                OFFERIST
              </span>
              <span>{proposal.version}</span>
              <span>{formatDate(proposal.proposalDate)}</span>
            </div>
            <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Подготовлено для {proposal.clientCompany || proposal.clientName || "клиента"}
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold sm:text-6xl">
              {proposal.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-200">
              {proposal.shortIntro}
            </p>
          </div>
          <div className="self-end rounded-lg border border-white/15 bg-white/[0.08] p-5 backdrop-blur">
            <Metric label="Клиент" value={proposal.clientName || "Не указан"} />
            <Metric
              label="Срок действия"
              value={formatDate(proposal.validUntil)}
            />
            <Metric
              label="Рекомендованный пакет"
              value={recommended?.name || "Не выбран"}
            />
            {showPrices ? (
              <Metric
                label="Бюджет"
                value={selectedPackage ? formatMoney(selectedPackage.price, proposal.currency) : "Не указан"}
              />
            ) : null}
          </div>
        </div>
      </section>

      <Section id="summary" eyebrow="Краткое резюме" title="Краткое резюме">
        <div className="grid gap-4 md:grid-cols-3">
          <Insight title="Задача" copy={proposal.clientProblem || "Задача будет уточнена на старте работ."} />
          <Insight title="Цель" copy={proposal.businessGoal || "Цель будет зафиксирована в плане работ."} />
          <Insight title="Решение" copy={proposal.proposedSolutionSummary || "Состав решения описан в пакетах ниже."} />
        </div>
      </Section>

      <Section id="context" eyebrow="Мы поняли вашу задачу" title="Контекст клиента">
        <TwoColumnText
          leftTitle="Исходная ситуация"
          left={proposal.clientContext}
          rightTitle="Что важно решить"
          right={proposal.clientProblem}
        />
      </Section>

      <Section id="solution" eyebrow="Предлагаемое решение" title="Как мы предлагаем двигаться">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <p className="text-lg leading-8 text-zinc-700">
            {proposal.proposedSolutionSummary}
          </p>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Sparkles size={18} aria-hidden="true" />
              Почему это подходит
            </div>
            <p className="mt-3 text-sm leading-6 text-emerald-950">
              {proposal.whyUs || "Решение подбирается под цель, ограничения и ожидаемый результат клиента."}
            </p>
          </div>
        </div>
      </Section>

      <Section id="deliverables" eyebrow="Состав работ" title="Что входит в предложение">
        <div className="grid gap-4 md:grid-cols-2">
          {proposal.deliverables.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-5">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {item.description}
              </p>
              {item.clientValue ? (
                <p className="mt-4 rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                  {item.clientValue}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section id="packages" eyebrow="Пакеты и стоимость" title="Выберите удобный формат">
        <div className="grid gap-4 lg:grid-cols-3">
          {proposal.packages.map((item) => {
            const selected = selectedPackageId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-lg border bg-white p-5 transition ${
                  selected
                    ? "border-emerald-400 shadow-lg shadow-emerald-100"
                    : "border-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold">{item.name}</h3>
                  {item.isRecommended ? (
                    <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">
                      Рекомендованный пакет
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-3 min-h-16 text-sm leading-6 text-zinc-600">
                  {item.description}
                </p>
                {showPrices ? (
                  <div className="mt-5 text-3xl font-semibold">
                    {formatMoney(item.price, proposal.currency)}
                  </div>
                ) : null}
                {showTimeline ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                    <CalendarDays size={16} aria-hidden="true" />
                    {item.duration}
                  </div>
                ) : null}
                <ul className="mt-5 space-y-2 text-sm leading-6 text-zinc-700">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {proposal.shareSettings.allowPackageSelection ? (
                  <Button
                    className="mt-6 w-full"
                    variant={selected ? "primary" : "secondary"}
                    onClick={() => selectPackage(item)}
                  >
                    Выбрать пакет
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>

      {proposal.shareSettings.showComparisonTable ? (
        <Section id="comparison" eyebrow="Сравнение пакетов" title="Что отличается">
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Пакет</th>
                  <th className="px-4 py-3">Стоимость</th>
                  <th className="px-4 py-3">Сроки</th>
                  <th className="px-4 py-3">Ключевой состав</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {proposal.packages.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4 font-semibold">{item.name}</td>
                    <td className="px-4 py-4">{showPrices ? formatMoney(item.price, proposal.currency) : "По запросу"}</td>
                    <td className="px-4 py-4">{showTimeline ? item.duration : "По согласованию"}</td>
                    <td className="px-4 py-4 text-zinc-600">{item.features.slice(0, 3).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {showTimeline ? (
        <Section id="timeline" eyebrow="Сроки и этапы" title="Как будет проходить работа">
          <div className="grid gap-4 md:grid-cols-2">
            {proposal.processSteps.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-950 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-zinc-500">
                    {item.duration}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section id="fit" eyebrow="Почему это решение подходит" title="Логика выбора">
        <p className="max-w-4xl text-lg leading-8 text-zinc-700">
          {proposal.whyUs}
        </p>
      </Section>

      <Section id="proof" eyebrow="Кейсы / доверие" title="На что можно опереться">
        <div className="grid gap-4 md:grid-cols-3">
          {proposal.proofItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-5">
              <ShieldCheck size={22} className="text-emerald-700" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {item.description}
              </p>
              <p className="mt-4 text-sm font-semibold leading-6 text-zinc-950">
                {item.result}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="assumptions" eyebrow="Условия оценки" title="При каких условиях оценка актуальна">
        <ListGrid items={proposal.assumptions} empty="Условия оценки будут уточнены перед стартом." />
      </Section>

      <Section id="out-of-scope" eyebrow="Что не входит" title="За границами текущего предложения">
        <ListGrid items={proposal.outOfScope} empty="Исключения не указаны." />
      </Section>

      <Section id="terms" eyebrow="Коммерческие условия" title="Условия работы">
        <TwoColumnText
          leftTitle="Оплата"
          left={proposal.paymentTerms}
          rightTitle="Примечания"
          right={proposal.legalNotes}
        />
      </Section>

      <Section id="next-step" eyebrow="Следующий шаг" title="Как продолжить">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-lg leading-8 text-zinc-700">
              {proposal.nextStepText}
            </p>
            {proposal.publicNotes ? (
              <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                {proposal.publicNotes}
              </p>
            ) : null}
            {proposal.shareSettings.allowClientComment ? (
              <div className="mt-5">
                <label className="block">
                  <span className="text-sm font-semibold text-zinc-700">
                    Комментарий к КП
                  </span>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
                <Button className="mt-3" variant="secondary" onClick={() => handleCta("client_comment")}>
                  Отправить комментарий
                </Button>
              </div>
            ) : null}
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
            <h3 className="text-lg font-semibold">
              {selectedPackage ? selectedPackage.name : "Выбранный пакет"}
            </h3>
            {selectedPackage && showPrices ? (
              <div className="mt-3 text-3xl font-semibold">
                {formatMoney(selectedPackage.price, proposal.currency)}
              </div>
            ) : null}
            {selectedPackage && showTimeline ? (
              <p className="mt-2 text-sm text-zinc-500">{selectedPackage.duration}</p>
            ) : null}
            <div className="mt-5 grid gap-2">
              <Button onClick={() => handleCta("discuss")}>
                <MessageCircle size={16} aria-hidden="true" />
                Обсудить КП
              </Button>
              <Button variant="secondary" onClick={() => handleCta("select_package")}>
                <CheckCircle2 size={16} aria-hidden="true" />
                Выбрать этот пакет
              </Button>
              <Button variant="secondary" onClick={() => handleCta("request_contract")}>
                <FileSignature size={16} aria-hidden="true" />
                Запросить договор
              </Button>
              <Button variant="secondary" onClick={() => handleCta("download_pdf")}>
                <Download size={16} aria-hidden="true" />
                Скачать PDF
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </article>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="proposal-section border-b border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-zinc-950">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function Insight({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{copy}</p>
    </div>
  );
}

function TwoColumnText({
  leftTitle,
  left,
  rightTitle,
  right,
}: {
  leftTitle: string;
  left: string;
  rightTitle: string;
  right: string;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="text-lg font-semibold">{leftTitle}</h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600">
          {left || "Будет уточнено."}
        </p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="text-lg font-semibold">{rightTitle}</h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600">
          {right || "Будет уточнено."}
        </p>
      </div>
    </div>
  );
}

function ListGrid({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
        {empty}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item} className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700">
          <ArrowRight size={16} className="mt-1 shrink-0 text-emerald-700" aria-hidden="true" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}
