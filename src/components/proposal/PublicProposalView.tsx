"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  FileSignature,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  DEFAULT_TRUST_LINE,
  formatDate,
  formatMoney,
  getRecommendedPackage,
  proposalToBlocks,
} from "@/lib/proposal";
import type {
  Proposal,
  ProposalBlock,
  ProposalEstimateModule,
  ProposalEventType,
  ProposalMediaItem,
  ProposalOpenQuestionItem,
  ProposalOpenQuestionStatus,
  ProposalPackage,
  ProposalProblemSplitItem,
  ProposalRoiCalculatorBlockProps,
  ProposalRoleItem,
  ProposalVariantItem,
  ToastState,
} from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge, Button, Toast } from "./Ui";

type PublicProposalViewProps = {
  proposal: Proposal;
  previewMode?: boolean;
};

type CtaAction = "approve" | "discuss" | "request_contract";

type ConfigurationSelectionSummary = {
  blockId: string;
  moduleIds: string[];
  moduleNames: string[];
  total: number;
};

type VariantSelectionSummary = {
  blockId: string;
  variantId: string;
  variantName: string;
  price?: number;
  duration?: string;
};

export function PublicProposalView({
  proposal,
  previewMode = false,
}: PublicProposalViewProps) {
  const recommended = getRecommendedPackage(proposal);
  const [selectedPackageId, setSelectedPackageId] = useState(
    proposal.selectedPackageId || recommended?.id,
  );
  const [toast, setToast] = useState<ToastState>(null);
  const selectedPackage = useMemo(
    () =>
      proposal.packages.find((item) => item.id === selectedPackageId) ??
      recommended,
    [proposal.packages, recommended, selectedPackageId],
  );
  const blocks = useMemo(
    () =>
      [...(proposal.blocks.length ? proposal.blocks : proposalToBlocks(proposal))]
        .filter((block) => block.visible)
        .sort((a, b) => a.order - b.order),
    [proposal],
  );
  const showPrices = proposal.shareSettings.showPrices;
  const showTimeline = proposal.shareSettings.showTimeline;
  const trustLine = proposal.trustLine?.trim() || DEFAULT_TRUST_LINE;
  const [selectedConfiguration, setSelectedConfiguration] =
    useState<ConfigurationSelectionSummary | null>(() =>
      getInitialConfigurationSelection(blocks),
    );
  const [selectedVariant, setSelectedVariant] =
    useState<VariantSelectionSummary | null>(() =>
      getInitialVariantSelection(blocks),
    );

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

  async function handleCta(action: CtaAction) {
    const targetUrl = getCtaUrl(action);

    if (!previewMode) {
      await track("cta_clicked", {
        metadata: {
          action,
          selectedPackageId: selectedPackage?.id,
          selectedPackageName: selectedPackage?.name,
          selectionSummary: getClientSelectionSummary({
            selectedPackage,
            selectedConfiguration,
            selectedVariant,
            proposal,
            showPrices,
            showTimeline,
          }),
          targetUrl: targetUrl || undefined,
        },
      });
    }

    if (targetUrl && !previewMode) {
      window.location.assign(targetUrl);
      return;
    }

    showToast(
      "success",
      targetUrl
        ? "В клиентской версии откроется указанная ссылка."
        : "Спасибо, действие зафиксировано. Мы свяжемся с вами для следующего шага.",
    );
  }

  function getCtaUrl(action: CtaAction) {
    if (action === "approve") {
      return proposal.shareSettings.approveUrl;
    }

    if (action === "discuss") {
      return proposal.shareSettings.discussUrl;
    }

    return "";
  }

  async function track(
    eventType: ProposalEventType,
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

  function renderBlock(block: ProposalBlock) {
    switch (block.type) {
      case "hero":
        return (
          <HeroBlock
            proposal={proposal}
            recommended={recommended}
            selectedPackage={selectedPackage}
            showPrices={showPrices}
          />
        );
      case "summary":
        return <SummaryBlock proposal={proposal} />;
      case "context":
        return <ContextBlock proposal={proposal} />;
      case "solution":
        return <SolutionBlock proposal={proposal} />;
      case "deliverables":
        return <DeliverablesBlock proposal={proposal} />;
      case "packages":
        return (
          <PackagesBlock
            proposal={proposal}
            selectedPackageId={selectedPackageId}
            showPrices={showPrices}
            showTimeline={showTimeline}
            onSelectPackage={selectPackage}
          />
        );
      case "comparison":
        return proposal.shareSettings.showComparisonTable ? (
          <ComparisonBlock
            proposal={proposal}
            showPrices={showPrices}
            showTimeline={showTimeline}
          />
        ) : null;
      case "timeline":
        return showTimeline ? <TimelineBlock proposal={proposal} /> : null;
      case "whyUs":
        return <WhyUsBlock proposal={proposal} />;
      case "proof":
        return <ProofBlock proposal={proposal} />;
      case "assumptions":
        return <AssumptionsBlock proposal={proposal} />;
      case "outOfScope":
        return <OutOfScopeBlock proposal={proposal} />;
      case "terms":
        return <TermsBlock proposal={proposal} />;
      case "nextStep":
        return (
          <NextStepBlock
            proposal={proposal}
            selectedPackage={selectedPackage}
            showPrices={showPrices}
            showTimeline={showTimeline}
            trustLine={trustLine}
            selectedConfiguration={selectedConfiguration}
            selectedVariant={selectedVariant}
            onCta={handleCta}
          />
        );
      case "roles":
        return <RolesBlock block={block} />;
      case "problemSplit":
        return <ProblemSplitBlock block={block} />;
      case "openQuestions":
        return <OpenQuestionsBlock block={block} />;
      case "roiCalculator":
        return <RoiCalculatorBlock block={block} proposal={proposal} />;
      case "estimateConfigurator":
        return (
          <EstimateConfiguratorBlock
            block={block}
            proposal={proposal}
            onConfigurationChange={(metadata) => {
              setSelectedConfiguration(metadata);
              if (!previewMode) {
                void track("configuration_changed", { metadata });
              }
            }}
          />
        );
      case "variantPicker":
        return (
          <VariantPickerBlock
            block={block}
            proposal={proposal}
            onVariantSelect={(metadata) => {
              setSelectedVariant(metadata);
              if (!previewMode) {
                void track("variant_selected", { metadata });
              }
            }}
          />
        );
      case "media":
        return <MediaBlock block={block} />;
      default:
        return null;
    }
  }

  return (
    <article className="min-h-screen bg-main text-ink">
      <div className="fixed bottom-5 right-5 z-40 flex flex-wrap justify-end gap-2 no-print">
        <ThemeToggle />
      </div>

      {blocks.map((block) => (
        <Fragment key={block.id}>{renderBlock(block)}</Fragment>
      ))}

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </article>
  );
}

function HeroBlock({
  proposal,
  recommended,
  selectedPackage,
  showPrices,
}: {
  proposal: Proposal;
  recommended?: ProposalPackage;
  selectedPackage?: ProposalPackage;
  showPrices: boolean;
}) {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#020b14] text-[#ecf0f1]">
      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_320px] lg:py-20">
        <div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#ecf0f1]/65">
            <span className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 font-semibold text-white">
              <BadgeCheck size={16} aria-hidden="true" />
              PRISMA
            </span>
            <span>{proposal.version}</span>
            <span>{formatDate(proposal.proposalDate)}</span>
          </div>
          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-[#e67e22]">
            Подготовлено для {proposal.clientCompany || proposal.clientName || "клиента"}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
            {proposal.title}
          </h1>
          {hasText(proposal.shortIntro) ? (
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#ecf0f1]/75">
              {proposal.shortIntro}
            </p>
          ) : null}
        </div>
        <div className="card-dark self-end rounded-lg p-5">
          <Metric label="Клиент" value={proposal.clientName || "Не указан"} />
          <Metric label="Срок действия" value={formatDate(proposal.validUntil)} />
          <Metric
            label="Рекомендованный пакет"
            value={recommended?.name || "Не выбран"}
          />
          {showPrices ? (
            <Metric
              label="Бюджет"
              value={
                selectedPackage
                  ? formatMoney(selectedPackage.price, proposal.currency)
                  : "Не указан"
              }
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SummaryBlock({ proposal }: { proposal: Proposal }) {
  const insights = [
    { title: "Задача", copy: proposal.clientProblem },
    { title: "Цель", copy: proposal.businessGoal },
    { title: "Решение", copy: proposal.proposedSolutionSummary },
  ].filter((item) => hasText(item.copy));

  if (!insights.length) {
    return null;
  }

  return (
    <Section id="summary" eyebrow="Краткое резюме" title="Краткое резюме">
      <div className="grid gap-4 md:grid-cols-3">
        {insights.map((item) => (
          <Insight key={item.title} title={item.title} copy={item.copy} />
        ))}
      </div>
    </Section>
  );
}

function ContextBlock({ proposal }: { proposal: Proposal }) {
  if (!hasText(proposal.clientContext) && !hasText(proposal.clientProblem)) {
    return null;
  }

  return (
    <Section id="context" eyebrow="Мы поняли вашу задачу" title="Контекст клиента">
      <TwoColumnText
        leftTitle="Исходная ситуация"
        left={proposal.clientContext}
        rightTitle="Что важно решить"
        right={proposal.clientProblem}
      />
    </Section>
  );
}

function SolutionBlock({ proposal }: { proposal: Proposal }) {
  if (!hasText(proposal.proposedSolutionSummary) && !hasText(proposal.whyUs)) {
    return null;
  }

  return (
    <Section id="solution" eyebrow="Предлагаемое решение" title="Как мы предлагаем двигаться">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {hasText(proposal.proposedSolutionSummary) ? (
          <p className="text-lg leading-8 text-ink-soft">
            {proposal.proposedSolutionSummary}
          </p>
        ) : null}
        {hasText(proposal.whyUs) ? (
          <div className="glass-card rounded-lg p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-accent-strong">
              <Sparkles size={18} aria-hidden="true" />
              Почему это подходит
            </div>
            <p className="mt-3 text-sm leading-6 text-ink">{proposal.whyUs}</p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function DeliverablesBlock({ proposal }: { proposal: Proposal }) {
  if (!proposal.deliverables.length) {
    return null;
  }

  return (
    <Section id="deliverables" eyebrow="Состав работ" title="Что входит в предложение">
      <div className="grid gap-4 md:grid-cols-2">
        {proposal.deliverables.map((item) => (
          <div key={item.id} className="glass-card rounded-lg p-5">
            <h3 className="text-lg font-semibold">{item.title}</h3>
            {hasText(item.description) ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                {item.description}
              </p>
            ) : null}
            {hasText(item.clientValue) ? (
              <p className="mt-4 rounded-md bg-main-soft p-3 text-sm leading-6 text-ink-soft">
                {item.clientValue}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

function PackagesBlock({
  proposal,
  selectedPackageId,
  showPrices,
  showTimeline,
  onSelectPackage,
}: {
  proposal: Proposal;
  selectedPackageId?: string;
  showPrices: boolean;
  showTimeline: boolean;
  onSelectPackage: (item: ProposalPackage) => void;
}) {
  if (!proposal.packages.length) {
    return null;
  }

  return (
    <Section id="packages" eyebrow="Пакеты и стоимость" title="Выберите удобный формат">
      <div className="grid gap-4 lg:grid-cols-3">
        {proposal.packages.map((item) => {
          const selected = selectedPackageId === item.id;

          return (
            <div
              key={item.id}
              className={`glass-card rounded-lg p-5 transition ${
                selected ? "border-accent shadow-lg shadow-accent/20" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">{item.name}</h3>
                {item.isRecommended ? (
                  <Badge className="bg-accent-soft text-accent-strong ring-accent/30">
                    Рекомендованный пакет
                  </Badge>
                ) : null}
              </div>
              {hasText(item.description) ? (
                <p className="mt-3 min-h-16 text-sm leading-6 text-muted">
                  {item.description}
                </p>
              ) : null}
              {showPrices ? (
                <div className="mt-5 text-3xl font-semibold">
                  {formatMoney(item.price, proposal.currency)}
                </div>
              ) : null}
              {showTimeline && hasText(item.duration) ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <CalendarDays size={16} aria-hidden="true" />
                  {item.duration}
                </div>
              ) : null}
              {item.features.length ? (
                <ul className="mt-5 space-y-2 text-sm leading-6 text-ink-soft">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2
                        size={16}
                        className="mt-1 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {proposal.shareSettings.allowPackageSelection ? (
                <Button
                  className="mt-6 w-full"
                  variant={selected ? "primary" : "secondary"}
                  onClick={() => onSelectPackage(item)}
                >
                  Выбрать пакет
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ComparisonBlock({
  proposal,
  showPrices,
  showTimeline,
}: {
  proposal: Proposal;
  showPrices: boolean;
  showTimeline: boolean;
}) {
  if (!proposal.packages.length) {
    return null;
  }

  return (
    <Section id="comparison" eyebrow="Сравнение пакетов" title="Что отличается">
      <div className="glass-card overflow-x-auto rounded-lg">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-main-soft text-muted">
            <tr>
              <th className="px-4 py-3">Пакет</th>
              <th className="px-4 py-3">Стоимость</th>
              <th className="px-4 py-3">Сроки</th>
              <th className="px-4 py-3">Ключевой состав</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {proposal.packages.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-4 font-semibold">{item.name}</td>
                <td className="px-4 py-4">
                  {showPrices
                    ? formatMoney(item.price, proposal.currency)
                    : "По запросу"}
                </td>
                <td className="px-4 py-4">
                  {showTimeline && hasText(item.duration)
                    ? item.duration
                    : "По согласованию"}
                </td>
                <td className="px-4 py-4 text-muted">
                  {item.features.slice(0, 3).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function TimelineBlock({ proposal }: { proposal: Proposal }) {
  if (!proposal.processSteps.length) {
    return null;
  }

  return (
    <Section id="timeline" eyebrow="Сроки и этапы" title="Как будет проходить работа">
      <div className="grid gap-4 md:grid-cols-2">
        {proposal.processSteps.map((item, index) => (
          <div key={item.id} className="glass-card rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white">
                {index + 1}
              </span>
              {hasText(item.duration) ? (
                <span className="text-sm font-semibold text-muted">
                  {item.duration}
                </span>
              ) : null}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
            {hasText(item.description) ? (
              <p className="mt-2 text-sm leading-6 text-muted">
                {item.description}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

function WhyUsBlock({ proposal }: { proposal: Proposal }) {
  if (!hasText(proposal.whyUs)) {
    return null;
  }

  return (
    <Section id="fit" eyebrow="Почему это решение подходит" title="Логика выбора">
      <p className="max-w-4xl text-lg leading-8 text-ink-soft">
        {proposal.whyUs}
      </p>
    </Section>
  );
}

function ProofBlock({ proposal }: { proposal: Proposal }) {
  if (!proposal.proofItems.length) {
    return null;
  }

  return (
    <Section id="proof" eyebrow="Кейсы / доверие" title="На что можно опереться">
      <div className="grid gap-4 md:grid-cols-3">
        {proposal.proofItems.map((item) => (
          <div key={item.id} className="glass-card rounded-lg p-5">
            <ShieldCheck size={22} className="text-accent" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
            {hasText(item.description) ? (
              <p className="mt-2 text-sm leading-6 text-muted">
                {item.description}
              </p>
            ) : null}
            {hasText(item.result) ? (
              <p className="mt-4 text-sm font-semibold leading-6 text-ink-strong">
                {item.result}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

function RolesBlock({ block }: { block: ProposalBlock }) {
  const roles = getRoleItems(block.props);

  if (!roles.length) {
    return null;
  }

  return (
    <Section
      id={`roles-${block.id}`}
      eyebrow="Роли и ответственность"
      title="Кто за что отвечает"
    >
      <div className="glass-card overflow-x-auto rounded-lg">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-main-soft text-muted">
            <tr>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3">Что получает</th>
              <th className="px-4 py-3">Ответственность</th>
              <th className="px-4 py-3">Наблюдаемость</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {roles.map((item, index) => (
              <tr key={`${item.role}-${index}`}>
                <td className="px-4 py-4 font-semibold text-ink-strong">
                  {item.role}
                </td>
                <td className="px-4 py-4 text-muted">{item.gets}</td>
                <td className="px-4 py-4 text-muted">{item.responsibility}</td>
                <td className="px-4 py-4 text-muted">{item.observability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ProblemSplitBlock({ block }: { block: ProposalBlock }) {
  const { asIsTitle, consequenceTitle, items } = getProblemSplitItems(
    block.props,
  );

  if (!items.length) {
    return null;
  }

  return (
    <Section
      id={`problem-${block.id}`}
      eyebrow="Проблема и последствия"
      title="Что происходит сейчас и к чему это приводит"
    >
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-main px-4 py-3 text-sm font-semibold text-[#ecf0f1]">
            {asIsTitle}
          </div>
          <div className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white">
            {consequenceTitle}
          </div>
        </div>
        {items.map((item, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-2">
            <div className="glass-card rounded-lg p-4 text-sm leading-6 text-ink-soft">
              {item.asIs}
            </div>
            <div className="glass-card rounded-lg border-accent/30 p-4 text-sm leading-6 text-ink-soft">
              {item.consequence}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function OpenQuestionsBlock({ block }: { block: ProposalBlock }) {
  const items = getOpenQuestionItems(block.props);

  if (!items.length) {
    return null;
  }

  return (
    <Section
      id={`open-questions-${block.id}`}
      eyebrow="Факты / допущения / вопросы"
      title="Что уже известно и что нужно уточнить"
    >
      <div className="grid gap-3">
        {items.map((item, index) => (
          <div key={index} className="glass-card rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
                  openQuestionStatusTone[item.status]
                }`}
              >
                {openQuestionStatusLabels[item.status]}
              </span>
              <h3 className="text-base font-semibold text-ink-strong">
                {item.question}
              </h3>
            </div>
            {hasText(item.note) ? (
              <p className="mt-3 text-sm leading-6 text-muted">{item.note}</p>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

function RoiCalculatorBlock({
  block,
  proposal,
}: {
  block: ProposalBlock;
  proposal: Proposal;
}) {
  const config = getRoiCalculatorConfig(block.props);
  const [operationsPerMonth, setOperationsPerMonth] = useState(
    config?.operationsPerMonth ?? 0,
  );
  const [manualCostPerOperation, setManualCostPerOperation] = useState(
    config?.manualCostPerOperation ?? 0,
  );
  const [automationSharePercent, setAutomationSharePercent] = useState(
    config?.automationSharePercent ?? 0,
  );

  if (!config) {
    return null;
  }

  const monthlyBefore = operationsPerMonth * manualCostPerOperation;
  const monthlySaving = monthlyBefore * (automationSharePercent / 100);
  const monthlyAfter = Math.max(0, monthlyBefore - monthlySaving);
  const paybackMonths =
    config.implementationCost && monthlySaving > 0
      ? config.implementationCost / monthlySaving
      : null;

  return (
    <Section
      id={`roi-${block.id}`}
      eyebrow="Экономика"
      title="Как меняется стоимость ручной работы"
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card rounded-lg p-5">
          <div className="space-y-5">
            <NumberControl
              label="Операций в месяц"
              value={operationsPerMonth}
              min={0}
              step={1}
              onChange={setOperationsPerMonth}
            />
            <NumberControl
              label="Стоимость операции вручную"
              value={manualCostPerOperation}
              min={0}
              step={100}
              onChange={setManualCostPerOperation}
            />
            <div>
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor={`roi-share-${block.id}`}
                  className="text-sm font-semibold text-ink-strong"
                >
                  Доля автоматизации
                </label>
                <span className="text-sm font-semibold text-accent-strong">
                  {Math.round(automationSharePercent)}%
                </span>
              </div>
              <input
                id={`roi-share-${block.id}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={automationSharePercent}
                onChange={(event) =>
                  setAutomationSharePercent(Number(event.target.value) || 0)
                }
                className="mt-3 w-full accent-[var(--accent)]"
              />
            </div>
          </div>
          {hasText(config.note) ? (
            <p className="mt-5 border-t border-line-soft pt-4 text-sm leading-6 text-muted">
              {config.note}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <RoiResultCard
            label="Было"
            value={formatMoney(monthlyBefore, proposal.currency)}
          />
          <RoiResultCard
            label="Стало"
            value={formatMoney(monthlyAfter, proposal.currency)}
          />
          <RoiResultCard
            label="Экономия в месяц"
            value={formatMoney(monthlySaving, proposal.currency)}
            accent
          />
          {paybackMonths ? (
            <div className="glass-card rounded-lg p-5 sm:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Окупаемость
              </p>
              <p className="mt-2 text-3xl font-semibold text-ink-strong">
                {paybackMonths.toLocaleString("ru-RU", {
                  maximumFractionDigits: 1,
                })}{" "}
                мес.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function EstimateConfiguratorBlock({
  block,
  proposal,
  onConfigurationChange,
}: {
  block: ProposalBlock;
  proposal: Proposal;
  onConfigurationChange: (metadata: ConfigurationSelectionSummary) => void;
}) {
  const modules = getEstimateModules(block.props);
  const [selectedIds, setSelectedIds] = useState(() =>
    getDefaultEstimateModuleIds(modules),
  );

  if (!modules.length) {
    return null;
  }

  const selectedModules = modules.filter((item) => selectedIds.includes(item.id));
  const total = selectedModules.reduce((sum, item) => sum + item.price, 0);

  function toggleModule(module: ProposalEstimateModule) {
    const selected = selectedIds.includes(module.id);
    const nextIds = selected
      ? removeModuleAndDependents(module.id, selectedIds, modules)
      : addModuleWithDependencies(module.id, selectedIds, modules);
    const nextModules = modules.filter((item) => nextIds.includes(item.id));
    const nextTotal = nextModules.reduce((sum, item) => sum + item.price, 0);

    setSelectedIds(nextIds);
    onConfigurationChange({
      blockId: block.id,
      moduleIds: nextIds,
      moduleNames: nextModules.map((item) => item.name),
      total: nextTotal,
    });
  }

  return (
    <Section
      id={`estimate-${block.id}`}
      eyebrow="Конфигуратор сметы"
      title="Соберите стартовый объём"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3">
          {modules.map((module) => {
            const checked = selectedIds.includes(module.id);
            const dependency = module.dependsOn
              ? modules.find((item) => item.id === module.dependsOn)
              : undefined;

            return (
              <label
                key={module.id}
                className={`glass-card flex gap-4 rounded-lg p-4 transition ${
                  checked ? "border-accent/50 bg-accent-soft/40" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleModule(module)}
                  className="mt-1 h-4 w-4 rounded border-line-soft text-accent focus:ring-accent"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold text-ink-strong">
                      {module.name}
                    </span>
                    <span className="text-sm font-semibold text-accent-strong">
                      {formatMoney(module.price, proposal.currency)}
                    </span>
                  </span>
                  {hasText(module.description) ? (
                    <span className="mt-2 block text-sm leading-6 text-muted">
                      {module.description}
                    </span>
                  ) : null}
                  {dependency ? (
                    <span className="mt-2 block text-xs font-medium text-muted">
                      Зависит от: {dependency.name}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

        <div className="glass-card h-fit rounded-lg p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Выбрано модулей
          </p>
          <p className="mt-2 text-3xl font-semibold text-ink-strong">
            {selectedModules.length}
          </p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Сумма
          </p>
          <p className="mt-2 text-3xl font-semibold text-accent-strong">
            {formatMoney(total, proposal.currency)}
          </p>
          {selectedModules.length ? (
            <ul className="mt-5 space-y-2 text-sm leading-6 text-muted">
              {selectedModules.map((module) => (
                <li key={module.id}>{module.name}</li>
              ))}
            </ul>
          ) : null}
          {hasText(readString(block.props, "note")) ? (
            <p className="mt-5 border-t border-line-soft pt-4 text-sm leading-6 text-muted">
              {readString(block.props, "note")}
            </p>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function VariantPickerBlock({
  block,
  proposal,
  onVariantSelect,
}: {
  block: ProposalBlock;
  proposal: Proposal;
  onVariantSelect: (metadata: VariantSelectionSummary) => void;
}) {
  const variants = getVariantItems(block.props);
  const [selectedVariantId, setSelectedVariantId] = useState(
    variants.find((item) => item.isRecommended)?.id ?? variants[0]?.id ?? "",
  );

  if (variants.length < 2) {
    return null;
  }

  const selectedVariant =
    variants.find((item) => item.id === selectedVariantId) ?? variants[0];

  function selectVariant(variant: ProposalVariantItem) {
    setSelectedVariantId(variant.id);
    onVariantSelect({
      blockId: block.id,
      variantId: variant.id,
      variantName: variant.name,
      price: variant.price,
      duration: variant.duration,
    });
  }

  return (
    <Section
      id={`variant-${block.id}`}
      eyebrow="Выбор варианта"
      title="Выберите подходящую архитектуру"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {variants.map((variant) => {
          const selected = selectedVariant.id === variant.id;

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => selectVariant(variant)}
              className={`glass-card rounded-lg p-5 text-left transition ${
                selected ? "border-accent shadow-lg shadow-accent/15" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-ink-strong">
                  {variant.name}
                </h3>
                {variant.isRecommended ? (
                  <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
                    Рекомендовано
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                {variant.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-ink-strong">
                {variant.price ? (
                  <span>{formatMoney(variant.price, proposal.currency)}</span>
                ) : null}
                {hasText(variant.duration) ? <span>{variant.duration}</span> : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card rounded-lg p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Выбранный вариант
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-ink-strong">
            {selectedVariant.name}
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            {selectedVariant.summary}
          </p>
          {selectedVariant.tradeoffs.length ? (
            <ul className="mt-4 space-y-2 text-sm leading-6 text-ink-soft">
              {selectedVariant.tradeoffs.map((tradeoff) => (
                <li key={tradeoff} className="flex gap-2">
                  <ArrowRight
                    size={16}
                    className="mt-1 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <span>{tradeoff}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="glass-card overflow-x-auto rounded-lg">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-main-soft text-muted">
              <tr>
                <th className="px-4 py-3">Критерий</th>
                {variants.map((variant) => (
                  <th key={variant.id} className="px-4 py-3">
                    {variant.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              <VariantComparisonRow
                label="Бюджет"
                values={variants.map((variant) =>
                  variant.price
                    ? formatMoney(variant.price, proposal.currency)
                    : "По оценке",
                )}
              />
              <VariantComparisonRow
                label="Срок"
                values={variants.map((variant) =>
                  hasText(variant.duration) ? (variant.duration ?? "") : "По оценке",
                )}
              />
              <VariantComparisonRow
                label="Компромисс"
                values={variants.map((variant) => variant.tradeoffs[0] ?? "Не указан")}
              />
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

function MediaBlock({ block }: { block: ProposalBlock }) {
  const items = getMediaItems(block.props);
  const layout = readMediaLayout(block.props);
  const note = readOptionalString(block.props, "note");

  if (!items.length) {
    return null;
  }

  return (
    <Section
      id={`media-${block.id}`}
      eyebrow="Артефакты"
      title={layout === "showcase" && items.length > 1 ? "Материалы и скриншоты" : "Скриншот результата"}
    >
      {layout === "showcase" && items.length > 1 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <ScreenshotFigure key={item.id} item={item} compact />
          ))}
        </div>
      ) : (
        <ScreenshotFigure item={items[0]} />
      )}
      {hasText(note) ? (
        <p className="mt-5 max-w-3xl text-sm leading-6 text-muted">{note}</p>
      ) : null}
    </Section>
  );
}

function ScreenshotFigure({
  item,
  compact,
}: {
  item: ProposalMediaItem;
  compact?: boolean;
}) {
  return (
    <figure className="glass-card overflow-hidden rounded-lg">
      <div className="relative bg-main-soft">
        {/* Plain img keeps locally served and externally hosted proposal artifacts compatible. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.alt}
          className={`w-full object-cover ${
            compact ? "aspect-[4/3]" : "aspect-[16/9]"
          }`}
          loading="lazy"
        />
        {hasText(item.caption) || hasText(item.title) ? (
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-main via-main/75 to-transparent p-5 text-white">
            {hasText(item.title) ? (
              <p className="text-sm font-semibold">{item.title}</p>
            ) : null}
            {hasText(item.caption) ? (
              <p className="mt-1 text-sm leading-6 text-white/78">
                {item.caption}
              </p>
            ) : null}
          </figcaption>
        ) : null}
      </div>
    </figure>
  );
}

function AssumptionsBlock({ proposal }: { proposal: Proposal }) {
  if (!proposal.assumptions.some(hasText)) {
    return null;
  }

  return (
    <Section id="assumptions" eyebrow="Условия оценки" title="При каких условиях оценка актуальна">
      <ListGrid items={proposal.assumptions} />
    </Section>
  );
}

function OutOfScopeBlock({ proposal }: { proposal: Proposal }) {
  if (!proposal.outOfScope.some(hasText)) {
    return null;
  }

  return (
    <Section id="out-of-scope" eyebrow="Что не входит" title="За границами текущего предложения">
      <ListGrid items={proposal.outOfScope} />
    </Section>
  );
}

function TermsBlock({ proposal }: { proposal: Proposal }) {
  if (!hasText(proposal.paymentTerms) && !hasText(proposal.legalNotes)) {
    return null;
  }

  return (
    <Section id="terms" eyebrow="Коммерческие условия" title="Условия работы">
      <TwoColumnText
        leftTitle="Оплата"
        left={proposal.paymentTerms}
        rightTitle="Примечания"
        right={proposal.legalNotes}
      />
    </Section>
  );
}

function NextStepBlock({
  proposal,
  selectedPackage,
  showPrices,
  showTimeline,
  trustLine,
  selectedConfiguration,
  selectedVariant,
  onCta,
}: {
  proposal: Proposal;
  selectedPackage?: ProposalPackage;
  showPrices: boolean;
  showTimeline: boolean;
  trustLine: string;
  selectedConfiguration: ConfigurationSelectionSummary | null;
  selectedVariant: VariantSelectionSummary | null;
  onCta: (action: CtaAction) => void;
}) {
  const hasDynamicSelection = Boolean(
    selectedPackage || selectedConfiguration || selectedVariant,
  );

  if (!hasText(proposal.nextStepText) && !proposal.publicNotes && !hasDynamicSelection) {
    return null;
  }

  return (
    <Section id="next-step" eyebrow="Следующий шаг" title="Как продолжить">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {hasText(proposal.nextStepText) ? (
            <p className="text-lg leading-8 text-ink-soft">
              {proposal.nextStepText}
            </p>
          ) : null}
          {hasDynamicSelection ? (
            <p className="mt-4 text-base leading-7 text-ink-soft">
              Следующий шаг будет опираться на выбранный сейчас объём: пакет,
              конфигурацию модулей и архитектурный вариант ниже.
            </p>
          ) : null}
          {hasText(proposal.publicNotes) ? (
            <p className="glass-card mt-4 rounded-lg p-4 text-sm leading-6 text-muted">
              {proposal.publicNotes}
            </p>
          ) : null}
        </div>
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-lg font-semibold">Ваш выбранный объём</h3>
          <div className="mt-4 space-y-4">
            {selectedPackage ? (
              <SelectionSummaryItem
                label="Пакет"
                title={selectedPackage.name}
                details={[
                  showPrices
                    ? formatMoney(selectedPackage.price, proposal.currency)
                    : "",
                  showTimeline ? selectedPackage.duration : "",
                ]}
              />
            ) : null}
            {selectedConfiguration ? (
              <SelectionSummaryItem
                label="Конфигурация"
                title={`${selectedConfiguration.moduleNames.length} модулей`}
                details={[
                  showPrices
                    ? formatMoney(selectedConfiguration.total, proposal.currency)
                    : "",
                  selectedConfiguration.moduleNames.join(", "),
                ]}
              />
            ) : null}
            {selectedVariant ? (
              <SelectionSummaryItem
                label="Вариант"
                title={selectedVariant.variantName}
                details={[
                  showPrices && selectedVariant.price
                    ? formatMoney(selectedVariant.price, proposal.currency)
                    : "",
                  showTimeline ? selectedVariant.duration ?? "" : "",
                ]}
              />
            ) : null}
          </div>
          <div className="mt-5 grid gap-2">
            <Button onClick={() => onCta("approve")}>
              <CheckCircle2 size={16} aria-hidden="true" />
              {hasDynamicSelection ? "Согласовать выбранный объём" : "Согласовать"}
            </Button>
            <Button variant="secondary" onClick={() => onCta("discuss")}>
              <MessageCircle size={16} aria-hidden="true" />
              Обсудить КП
            </Button>
            <Button variant="secondary" onClick={() => onCta("request_contract")}>
              <FileSignature size={16} aria-hidden="true" />
              Запросить договор
            </Button>
          </div>
          <p className="mt-4 border-t border-line-soft pt-4 text-xs font-medium leading-5 text-muted">
            {trustLine}
          </p>
        </div>
      </div>
    </Section>
  );
}

function SelectionSummaryItem({
  label,
  title,
  details,
}: {
  label: string;
  title: string;
  details: string[];
}) {
  const visibleDetails = details.filter(hasText);

  return (
    <div className="border-b border-line-soft pb-4 last:border-0 last:pb-0">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-semibold text-ink-strong">{title}</p>
      {visibleDetails.length ? (
        <p className="mt-1 text-sm leading-6 text-muted">
          {visibleDetails.join(" · ")}
        </p>
      ) : null}
    </div>
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
  children: ReactNode;
}) {
  if (!children) {
    return null;
  }

  return (
    <section id={id} className="proposal-section border-b border-line-soft px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-ink-strong">
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
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#ecf0f1]/55">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[#ecf0f1]">{value}</div>
    </div>
  );
}

function Insight({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
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
  const columns = [
    { title: leftTitle, copy: left },
    { title: rightTitle, copy: right },
  ].filter((item) => hasText(item.copy));

  if (!columns.length) {
    return null;
  }

  return (
    <div className={`grid gap-5 ${columns.length > 1 ? "md:grid-cols-2" : ""}`}>
      {columns.map((column) => (
        <div key={column.title} className="glass-card rounded-lg p-5">
          <h3 className="text-lg font-semibold">{column.title}</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">
            {column.copy}
          </p>
        </div>
      ))}
    </div>
  );
}

function ListGrid({ items }: { items: string[] }) {
  const visibleItems = items.filter(hasText);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {visibleItems.map((item) => (
        <div
          key={item}
          className="glass-card flex gap-3 rounded-lg p-4 text-sm leading-6 text-ink-soft"
        >
          <ArrowRight size={16} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function NumberControl({
  label,
  value,
  min,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink-strong">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) =>
          onChange(Math.max(min, Number(event.target.value) || 0))
        }
        className="mt-2 h-11 w-full rounded-md border border-line-soft bg-white px-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
      />
    </label>
  );
}

function RoiResultCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`glass-card rounded-lg p-5 ${
        accent ? "border-accent/40 bg-accent-soft/60" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-ink-strong">{value}</p>
    </div>
  );
}

function getRoleItems(props: Record<string, unknown>): ProposalRoleItem[] {
  const items = Array.isArray(props.roles) ? props.roles : [];

  return items
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const role = readString(item, "role");
      const gets = readString(item, "gets");
      const responsibility = readString(item, "responsibility");
      const observability = readString(item, "observability");

      if (![role, gets, responsibility, observability].some(hasText)) {
        return null;
      }

      return {
        role,
        gets,
        responsibility,
        observability,
      };
    })
    .filter((item): item is ProposalRoleItem => Boolean(item));
}

function getProblemSplitItems(props: Record<string, unknown>): {
  asIsTitle: string;
  consequenceTitle: string;
  items: ProposalProblemSplitItem[];
} {
  const items = Array.isArray(props.items) ? props.items : [];
  const asIsTitle = readOptionalString(props, "asIsTitle") || "Как сейчас";
  const consequenceTitle =
    readOptionalString(props, "consequenceTitle") || "К чему приводит";

  return {
    asIsTitle,
    consequenceTitle,
    items: items
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }

        const asIs = readString(item, "asIs");
        const consequence = readString(item, "consequence");

        if (!hasText(asIs) || !hasText(consequence)) {
          return null;
        }

        return { asIs, consequence };
      })
      .filter((item): item is ProposalProblemSplitItem => Boolean(item)),
  };
}

const openQuestionStatuses: ProposalOpenQuestionStatus[] = [
  "fact",
  "assumption",
  "open",
];

const openQuestionStatusLabels: Record<ProposalOpenQuestionStatus, string> = {
  fact: "Факт",
  assumption: "Допущение",
  open: "Вопрос",
};

const openQuestionStatusTone: Record<ProposalOpenQuestionStatus, string> = {
  fact: "bg-accent-soft text-accent-strong",
  assumption: "bg-amber-50 text-amber-800",
  open: "bg-main-soft text-ink-strong",
};

function getOpenQuestionItems(
  props: Record<string, unknown>,
): ProposalOpenQuestionItem[] {
  const items = Array.isArray(props.items) ? props.items : [];
  const result: ProposalOpenQuestionItem[] = [];

  items.forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }

    const status = readOpenQuestionStatus(item);
    const question = readString(item, "question");
    const note = readString(item, "note");

    if (hasText(question)) {
      result.push({ status, question, note });
    }
  });

  return result;
}

function readOpenQuestionStatus(source: object): ProposalOpenQuestionStatus {
  const value = (source as Record<string, unknown>).status;
  return openQuestionStatuses.includes(value as ProposalOpenQuestionStatus)
    ? (value as ProposalOpenQuestionStatus)
    : "open";
}

function getRoiCalculatorConfig(
  props: Record<string, unknown>,
): ProposalRoiCalculatorBlockProps | null {
  const operationsPerMonth = readNumber(props, "operationsPerMonth");
  const manualCostPerOperation = readNumber(props, "manualCostPerOperation");
  const automationSharePercent = clampNumber(
    readNumber(props, "automationSharePercent"),
    0,
    100,
  );
  const implementationCost = readNumber(props, "implementationCost");
  const note = readString(props, "note");

  if (
    operationsPerMonth <= 0 ||
    manualCostPerOperation <= 0 ||
    automationSharePercent <= 0
  ) {
    return null;
  }

  return {
    operationsPerMonth,
    manualCostPerOperation,
    automationSharePercent,
    implementationCost: implementationCost > 0 ? implementationCost : undefined,
    note,
  };
}

function VariantComparisonRow({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <tr>
      <td className="px-4 py-4 font-semibold text-ink-strong">{label}</td>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="px-4 py-4 text-muted">
          {value}
        </td>
      ))}
    </tr>
  );
}

function getInitialConfigurationSelection(
  blocks: ProposalBlock[],
): ConfigurationSelectionSummary | null {
  const block = blocks.find((item) => item.type === "estimateConfigurator");

  if (!block) {
    return null;
  }

  const modules = getEstimateModules(block.props);
  const moduleIds = getDefaultEstimateModuleIds(modules);
  const selectedModules = modules.filter((item) => moduleIds.includes(item.id));

  if (!selectedModules.length) {
    return null;
  }

  return {
    blockId: block.id,
    moduleIds,
    moduleNames: selectedModules.map((item) => item.name),
    total: selectedModules.reduce((sum, item) => sum + item.price, 0),
  };
}

function getInitialVariantSelection(
  blocks: ProposalBlock[],
): VariantSelectionSummary | null {
  const block = blocks.find((item) => item.type === "variantPicker");

  if (!block) {
    return null;
  }

  const variants = getVariantItems(block.props);

  if (variants.length < 2) {
    return null;
  }

  const variant = variants.find((item) => item.isRecommended) ?? variants[0];

  return {
    blockId: block.id,
    variantId: variant.id,
    variantName: variant.name,
    price: variant.price,
    duration: variant.duration,
  };
}

function getClientSelectionSummary({
  selectedPackage,
  selectedConfiguration,
  selectedVariant,
  proposal,
  showPrices,
  showTimeline,
}: {
  selectedPackage?: ProposalPackage;
  selectedConfiguration: ConfigurationSelectionSummary | null;
  selectedVariant: VariantSelectionSummary | null;
  proposal: Proposal;
  showPrices: boolean;
  showTimeline: boolean;
}) {
  return {
    package: selectedPackage
      ? {
          id: selectedPackage.id,
          name: selectedPackage.name,
          price: showPrices ? selectedPackage.price : undefined,
          duration: showTimeline ? selectedPackage.duration : undefined,
        }
      : undefined,
    configuration: selectedConfiguration
      ? {
          ...selectedConfiguration,
          formattedTotal: showPrices
            ? formatMoney(selectedConfiguration.total, proposal.currency)
            : undefined,
        }
      : undefined,
    variant: selectedVariant
      ? {
          ...selectedVariant,
          formattedPrice:
            showPrices && selectedVariant.price
              ? formatMoney(selectedVariant.price, proposal.currency)
              : undefined,
          duration: showTimeline ? selectedVariant.duration : undefined,
        }
      : undefined,
  };
}

function getEstimateModules(
  props: Record<string, unknown>,
): ProposalEstimateModule[] {
  const items = Array.isArray(props.modules) ? props.modules : [];
  const usedIds = new Set<string>();
  const modules: ProposalEstimateModule[] = [];

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }

    const source = item as Record<string, unknown>;
    const name = readOptionalString(source, "name");

    if (!hasText(name)) {
      return;
    }

    const fallbackId = `module-${index + 1}`;
    const baseId = readOptionalString(source, "id") || fallbackId;
    const id = usedIds.has(baseId) ? `${baseId}-${index + 1}` : baseId;
    usedIds.add(id);

    modules.push({
      id,
      name,
      description: readOptionalString(source, "description"),
      price: readNumber(source, "price"),
      dependsOn: readOptionalString(source, "dependsOn") || undefined,
      default: source.default === true,
      defaultSelected: source.defaultSelected === true || source.default === true,
    });
  });

  const moduleIds = new Set(modules.map((module) => module.id));

  return modules.map((module) => ({
    ...module,
    dependsOn:
      module.dependsOn &&
      module.dependsOn !== module.id &&
      moduleIds.has(module.dependsOn)
        ? module.dependsOn
        : undefined,
  }));
}

function addModuleWithDependencies(
  moduleId: string,
  selectedIds: string[],
  modules: ProposalEstimateModule[],
) {
  const selected = new Set(selectedIds);
  const modulesById = new Map(modules.map((module) => [module.id, module]));

  function addWithDependency(id: string, seen = new Set<string>()) {
    if (seen.has(id)) {
      return;
    }

    seen.add(id);
    const estimateModule = modulesById.get(id);

    if (!estimateModule) {
      return;
    }

    if (estimateModule.dependsOn) {
      addWithDependency(estimateModule.dependsOn, seen);
    }

    selected.add(id);
  }

  addWithDependency(moduleId);

  return modules
    .filter((module) => selected.has(module.id))
    .map((module) => module.id);
}

function getDefaultEstimateModuleIds(modules: ProposalEstimateModule[]) {
  return modules.reduce<string[]>((selectedIds, module) => {
    if (!module.defaultSelected) {
      return selectedIds;
    }

    return addModuleWithDependencies(module.id, selectedIds, modules);
  }, []);
}

function removeModuleAndDependents(
  moduleId: string,
  selectedIds: string[],
  modules: ProposalEstimateModule[],
) {
  const removed = new Set([moduleId]);
  let changed = true;

  while (changed) {
    changed = false;

    modules.forEach((module) => {
      if (module.dependsOn && removed.has(module.dependsOn) && !removed.has(module.id)) {
        removed.add(module.id);
        changed = true;
      }
    });
  }

  return selectedIds.filter((id) => !removed.has(id));
}

function getVariantItems(props: Record<string, unknown>): ProposalVariantItem[] {
  const items = Array.isArray(props.variants) ? props.variants : [];
  const usedIds = new Set<string>();
  const variants: ProposalVariantItem[] = [];

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }

    const source = item as Record<string, unknown>;
    const name = readOptionalString(source, "name");
    const summary = readOptionalString(source, "summary");

    if (!hasText(name) || !hasText(summary)) {
      return;
    }

    const fallbackId = `variant-${index + 1}`;
    const baseId = readOptionalString(source, "id") || fallbackId;
    const id = usedIds.has(baseId) ? `${baseId}-${index + 1}` : baseId;
    const price = readNumber(source, "price");
    usedIds.add(id);

    variants.push({
      id,
      name,
      summary,
      price: price > 0 ? price : undefined,
      duration: readOptionalString(source, "duration"),
      tradeoffs: readStringList(source.tradeoffs),
      isRecommended: source.isRecommended === true,
    });
  });

  return variants.slice(0, 4);
}

function getMediaItems(props: Record<string, unknown>): ProposalMediaItem[] {
  const items = Array.isArray(props.items) ? props.items : [];
  const usedIds = new Set<string>();
  const result: ProposalMediaItem[] = [];

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }

    const source = item as Record<string, unknown>;
    const url = readOptionalString(source, "url");
    const alt = readOptionalString(source, "alt");

    if (!hasText(url) || !hasText(alt)) {
      return;
    }

    const fallbackId = `media-${index + 1}`;
    const baseId = readOptionalString(source, "id") || fallbackId;
    const id = usedIds.has(baseId) ? `${baseId}-${index + 1}` : baseId;
    usedIds.add(id);

    result.push({
      id,
      url,
      storageKey: readOptionalString(source, "storageKey") || undefined,
      storageProvider: readMediaStorageProvider(source),
      title: readOptionalString(source, "title"),
      caption: readOptionalString(source, "caption"),
      alt,
    });
  });

  return result;
}

function readMediaLayout(props: Record<string, unknown>) {
  return readOptionalString(props, "layout") === "showcase"
    ? "showcase"
    : "figure";
}

function readMediaStorageProvider(
  source: Record<string, unknown>,
): ProposalMediaItem["storageProvider"] {
  const value = readOptionalString(source, "storageProvider");

  return value === "local" || value === "supabase" || value === "external"
    ? value
    : undefined;
}

function readStringList(value: unknown) {
  const items =
    typeof value === "string"
      ? value.split(/\r?\n/)
      : Array.isArray(value)
        ? value
        : [];

  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(hasText);
}

function readNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readOptionalString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function readString(source: object, key: string) {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}
