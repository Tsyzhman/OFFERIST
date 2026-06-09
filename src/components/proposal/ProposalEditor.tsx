"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileUp,
  GripVertical,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  applyProposalArchetype,
  checkProposalReadiness,
  createId,
  DEFAULT_TRUST_LINE,
  defaultProposalArchetypeId,
  formatMoney,
  getEffectiveStatus,
  getPublicUrl,
  proposalBlockTypes,
  proposalArchetypePresets,
  proposalStatusLabels,
  proposalStatusTone,
  toList,
  fromList,
  type ProposalArchetypeId,
} from "@/lib/proposal";
import {
  createProposalAiExample,
  importProposalJson,
  ProposalAiValidationError,
} from "@/lib/proposal-ai";
import type {
  ProcessStep,
  ProofItem,
  Proposal,
  ProposalBlock,
  ProposalBlockType,
  ProposalDeliverable,
  ProposalEstimateConfiguratorBlockProps,
  ProposalEstimateModule,
  ProposalMediaBlockProps,
  ProposalMediaItem,
  ProposalOpenQuestionItem,
  ProposalOpenQuestionStatus,
  ProposalPackage,
  ProposalProblemSplitItem,
  ProposalReadinessWarning,
  ProposalRoiCalculatorBlockProps,
  ProposalRoleItem,
  ProposalStatus,
  ProposalVariantItem,
  ProposalVariantPickerBlockProps,
  ToastState,
} from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge, Button, SectionCard, TextInput, Textarea, Toast, Toggle } from "./Ui";

type ProposalEditorProps = {
  initialProposal: Proposal;
  mode: "new" | "edit";
};

const blockMeta: Record<
  ProposalBlockType,
  { label: string; hint: string; editor: string }
> = {
  hero: {
    label: "Hero",
    hint: "Первый экран: клиент, версия, срок действия, рекомендуемый пакет и главный тезис.",
    editor: "Основные параметры",
  },
  summary: {
    label: "Краткое резюме",
    hint: "Три быстрых ответа: задача, цель и предлагаемое решение.",
    editor: "Контекст и решение",
  },
  context: {
    label: "Контекст клиента",
    hint: "Исходная ситуация и проблема, из которой рождается предложение.",
    editor: "Контекст и решение",
  },
  solution: {
    label: "Решение",
    hint: "Логика подхода и причина, почему он подходит именно этому клиенту.",
    editor: "Контекст и решение",
  },
  deliverables: {
    label: "Состав работ",
    hint: "Конкретные результаты и ценность каждого результата для клиента.",
    editor: "Состав работ",
  },
  packages: {
    label: "Пакеты",
    hint: "Коммерческие варианты, цены, сроки и состав каждого пакета.",
    editor: "Пакеты и стоимость",
  },
  comparison: {
    label: "Сравнение пакетов",
    hint: "Помогает клиенту увидеть компромиссы между вариантами.",
    editor: "Пакеты и настройки публикации",
  },
  timeline: {
    label: "Сроки и этапы",
    hint: "Показывает процесс, контрольные точки и ожидаемый ритм работы.",
    editor: "Сроки и этапы",
  },
  whyUs: {
    label: "Почему это подходит",
    hint: "Усиливает выбор подхода через аргументы доверия и релевантности.",
    editor: "Контекст и решение",
  },
  proof: {
    label: "Доказательства",
    hint: "Кейсы, результаты и опорные аргументы доверия.",
    editor: "Кейсы / доверие",
  },
  assumptions: {
    label: "Допущения",
    hint: "Честно фиксирует условия, при которых оценка актуальна.",
    editor: "Условия оценки",
  },
  outOfScope: {
    label: "За границами",
    hint: "Снимает риск ложных ожиданий и показывает, что не входит в объём.",
    editor: "Условия оценки",
  },
  terms: {
    label: "Условия",
    hint: "Оплата, юридические примечания и коммерческие ограничения.",
    editor: "Коммерческие условия",
  },
  nextStep: {
    label: "Следующий шаг",
    hint: "Финальный CTA, выбранный пакет, публичная заметка и микро-доверие.",
    editor: "Коммерческие условия / публикация",
  },
  roles: {
    label: "Роли",
    hint: "Матрица ответственности: кто что получает, делает и наблюдает.",
    editor: "Будущий блок PT05",
  },
  problemSplit: {
    label: "Проблема / последствия",
    hint: "Две колонки: как сейчас устроен процесс и к чему это приводит.",
    editor: "Будущий блок PT06",
  },
  openQuestions: {
    label: "Открытые вопросы",
    hint: "Честная зона неизвестности: факты, допущения и вопросы.",
    editor: "Будущий блок PT07",
  },
  roiCalculator: {
    label: "Калькулятор экономики",
    hint: "Сравнение текущих затрат и ожидаемого эффекта после внедрения.",
    editor: "Будущий блок PT08",
  },
  estimateConfigurator: {
    label: "Конфигуратор сметы",
    hint: "Модули, зависимости и пересчёт выбранного объёма работ.",
    editor: "Будущий блок PT09",
  },
  variantPicker: {
    label: "Выбор варианта",
    hint: "2-4 архитектурных варианта с компромиссами и сравнением.",
    editor: "Будущий блок PT09",
  },
  media: {
    label: "Медиа",
    hint: "Скриншоты, схемы и визуальные артефакты как доказательство.",
    editor: "Будущий блок PT10",
  },
};

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

export function ProposalEditor({ initialProposal, mode }: ProposalEditorProps) {
  const router = useRouter();
  const [proposal, setProposal] = useState(initialProposal);
  const [selectedArchetypeId, setSelectedArchetypeId] =
    useState<ProposalArchetypeId>(defaultProposalArchetypeId);
  const [currentId, setCurrentId] = useState(mode === "edit" ? initialProposal.id : null);
  const [hasStoredPassword, setHasStoredPassword] = useState(
    initialProposal.isPasswordProtected,
  );
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [origin, setOrigin] = useState("");
  const status = getEffectiveStatus(proposal);
  const readinessWarnings = useMemo(
    () => checkProposalReadiness(proposal),
    [proposal],
  );
  const publicUrl = useMemo(() => {
    if (!origin) {
      return "";
    }

    return getPublicUrl(origin, proposal.shareSlug);
  }, [origin, proposal.shareSlug]);

  const isExpired = status === "expired";

  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOrigin(window.location.origin);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function update(patch: Partial<Proposal>) {
    setProposal((current) => ({
      ...current,
      ...patch,
      shareSettings: {
        ...current.shareSettings,
        ...(patch.shareSettings ?? {}),
      },
    }));
  }

  function selectArchetype(archetypeId: ProposalArchetypeId) {
    setSelectedArchetypeId(archetypeId);
    setProposal((current) => applyProposalArchetype(current, archetypeId));
  }

  function downloadExampleJson() {
    const example = createProposalAiExample();
    const blob = new Blob([JSON.stringify(example, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prisma-example.json";
    link.click();
    URL.revokeObjectURL(url);
    showToast("success", "Пример JSON скачан — отдайте коллеге заполнить с AI");
  }

  async function importFromJsonFile(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      setProposal((current) => importProposalJson(parsed, current));

      showToast("success", "JSON импортирован — проверьте поля и сохраните");
    } catch (error) {
      const details =
        error instanceof ProposalAiValidationError
          ? ` ${error.issues.slice(0, 3).join("; ")}`
          : "";
      showToast("error", `Не удалось разобрать файл. Проверьте структуру JSON.${details}`);
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  async function persist(
    nextProposal = proposal,
    nextPassword = password,
    options: { notify?: boolean } = {},
  ) {
    const notify = options.notify ?? true;

    if (
      nextProposal.isPasswordProtected &&
      !nextPassword.trim() &&
      !hasStoredPassword
    ) {
      showToast("warning", "Укажите пароль для защищённой клиентской ссылки.");
      return null;
    }

    setSaving(true);
    const endpoint = currentId ? `/api/proposals/${currentId}` : "/api/proposals";
    const method = currentId ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposal: nextProposal, password: nextPassword.trim() || undefined }),
    });
    const result = (await response.json()) as { proposal?: Proposal; error?: string };
    setSaving(false);

    if (!response.ok || !result.proposal) {
      showToast("error", result.error || "Не удалось сохранить КП");
      return null;
    }

    setProposal(result.proposal);
    setCurrentId(result.proposal.id);
    setHasStoredPassword(
      result.proposal.isPasswordProtected &&
        (hasStoredPassword || Boolean(nextPassword.trim())),
    );
    setPassword("");
    if (notify) {
      showToast("success", "КП сохранено");
    }

    if (!currentId) {
      router.replace(`/proposal/${result.proposal.id}/edit`);
    }

    return result.proposal;
  }

  async function runShareAction(
    action: "publish" | "unpublish" | "regenerate",
    draftProposal = proposal,
  ) {
    const savedProposal = await persist(draftProposal, password, {
      notify: false,
    });

    if (!savedProposal) {
      return null;
    }

    setSaving(true);
    const response = await fetch(`/api/proposals/${savedProposal.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = (await response.json()) as {
      proposal?: Proposal;
      error?: string;
    };
    setSaving(false);

    if (!response.ok || !result.proposal) {
      showToast("error", result.error || "Не удалось обновить клиентскую ссылку");
      return null;
    }

    setProposal(result.proposal);
    setCurrentId(result.proposal.id);
    setPassword("");
    return result.proposal;
  }

  async function publish() {
    if (readinessWarnings.length) {
      const confirmed = window.confirm(
        [
          "Перед публикацией есть предупреждения по контенту:",
          ...readinessWarnings.map((warning) => `- ${warning.title}`),
          "Опубликовать всё равно?",
        ].join("\n"),
      );

      if (!confirmed) {
        showToast("warning", "Публикация отменена. Черновик можно сохранить.");
        return;
      }
    }

    const next = {
      ...proposal,
      status: "published" as ProposalStatus,
      publishedAt: proposal.publishedAt || new Date().toISOString(),
      shareSettings: {
        ...proposal.shareSettings,
        isPublished: true,
      },
    };
    update(next);
    const saved = await runShareAction("publish", next);

    if (saved) {
      showToast("success", "КП опубликовано");
    }
  }

  async function unpublish() {
    const next = {
      ...proposal,
      status: "hidden" as ProposalStatus,
      shareSettings: {
        ...proposal.shareSettings,
        isPublished: false,
      },
    };
    update(next);
    const saved = await runShareAction("unpublish", next);

    if (saved) {
      showToast("success", "КП снято с публикации");
    }
  }

  async function regenerateLink() {
    const confirmed = window.confirm("Старая ссылка перестанет открываться. Продолжить?");
    if (!confirmed) {
      return;
    }

    const saved = await runShareAction("regenerate");

    if (saved) {
      showToast("success", "Клиентская ссылка обновлена");
    }
  }

  async function copyLink() {
    if (getEffectiveStatus(proposal) !== "published") {
      showToast("warning", "Сначала опубликуйте КП, чтобы скопировать клиентскую ссылку.");
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast("success", "Ссылка скопирована");
    } catch {
      window.prompt("Скопируйте клиентскую ссылку", publicUrl);
      showToast("success", "Клиентская ссылка готова");
    }
  }

  function openPublicLink() {
    if (getEffectiveStatus(proposal) !== "published") {
      showToast("warning", "Сначала опубликуйте КП, чтобы открыть клиентскую версию.");
      return;
    }

    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }

  function showToast(tone: NonNullable<ToastState>["tone"], message: string) {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 2400);
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur no-print">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Назад к списку КП"
              title="Назад к списку КП"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={proposalStatusTone[status]}>
                  {proposalStatusLabels[status]}
                </Badge>
                <span className="text-sm text-zinc-500">Версия {proposal.version}</span>
              </div>
              <h1 className="mt-1 text-xl font-semibold text-zinc-950">
                {mode === "new" ? "Новое КП" : "Редактировать КП"}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={downloadExampleJson}
              title="Скачать пример структуры — отдайте коллеге, чтобы заполнил с AI"
            >
              <Sparkles size={16} aria-hidden="true" />
              Пример JSON
            </Button>
            <Button
              variant="ghost"
              onClick={() => importInputRef.current?.click()}
              title="Импортировать заполненный JSON"
            >
              <FileUp size={16} aria-hidden="true" />
              Импорт
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                void importFromJsonFile(event.target.files?.[0]);
              }}
            />
            {currentId ? (
              <Link href={`/proposal/${currentId}/preview`}>
                <Button variant="secondary">
                  <Eye size={16} aria-hidden="true" />
                  Предпросмотр
                </Button>
              </Link>
            ) : null}
            <Button variant="secondary" onClick={() => persist()} disabled={saving}>
              <Save size={16} aria-hidden="true" />
              {saving ? "Сохраняем" : "Сохранить"}
            </Button>
            <Button onClick={publish} disabled={saving}>
              <Send size={16} aria-hidden="true" />
              Опубликовать
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 py-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {isExpired ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
              Срок действия предложения истёк. Обновите дату или снимите КП с публикации.
            </div>
          ) : null}

          <ReadinessWarningsPanel warnings={readinessWarnings} />

          {mode === "new" ? (
            <ArchetypeSelector
              selectedId={selectedArchetypeId}
              onSelect={selectArchetype}
            />
          ) : null}

          <SectionCard title="Основные параметры" eyebrow="Настройки КП">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextInput label="Название КП" value={proposal.title} onChange={(title) => update({ title })} />
              <TextInput label="Клиент" value={proposal.clientName} onChange={(clientName) => update({ clientName })} />
              <TextInput label="Компания" value={proposal.clientCompany} onChange={(clientCompany) => update({ clientCompany })} />
              <TextInput label="Подготовил" value={proposal.preparedBy} onChange={(preparedBy) => update({ preparedBy })} />
              <TextInput label="Роль отправителя" value={proposal.preparedByRole} onChange={(preparedByRole) => update({ preparedByRole })} />
              <TextInput label="Дата КП" type="date" value={proposal.proposalDate} onChange={(proposalDate) => update({ proposalDate })} />
              <TextInput label="Действительно до" type="date" value={proposal.validUntil} onChange={(validUntil) => update({ validUntil, expiresAt: proposal.expiresAt || validUntil })} />
              <TextInput label="Версия" value={proposal.version} onChange={(version) => update({ version })} />
              <TextInput label="Язык" value={proposal.language} onChange={() => update({ language: "ru" })} helper="MVP использует русский язык." />
              <TextInput label="Валюта" value={proposal.currency} onChange={() => update({ currency: "RUB" })} helper="Денежные значения форматируются в RUB." />
            </div>
            <div className="mt-4">
              <Textarea label="Краткое вступление" rows={4} value={proposal.shortIntro} onChange={(shortIntro) => update({ shortIntro })} />
            </div>
          </SectionCard>

          <BlockManager
            proposal={proposal}
            proposalId={proposal.id}
            canUploadMedia={Boolean(currentId)}
            blocks={proposal.blocks}
            onChange={(blocks) => update({ blocks })}
            onProposalChange={update}
          />

          <SectionCard title="Контекст и решение" eyebrow="Содержание КП">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Textarea label="Контекст клиента" rows={5} value={proposal.clientContext} onChange={(clientContext) => update({ clientContext })} />
              <Textarea label="Проблема клиента" rows={5} value={proposal.clientProblem} onChange={(clientProblem) => update({ clientProblem })} />
              <Textarea label="Бизнес-цель" rows={4} value={proposal.businessGoal} onChange={(businessGoal) => update({ businessGoal })} />
              <Textarea label="Предлагаемое решение" rows={4} value={proposal.proposedSolutionSummary} onChange={(proposedSolutionSummary) => update({ proposedSolutionSummary })} />
            </div>
            <div className="mt-4">
              <Textarea label="Почему это решение подходит" rows={4} value={proposal.whyUs} onChange={(whyUs) => update({ whyUs })} />
            </div>
          </SectionCard>

          <DeliverablesEditor
            items={proposal.deliverables}
            onChange={(deliverables) => update({ deliverables })}
          />

          <PackagesEditor
            items={proposal.packages}
            selectedPackageId={proposal.selectedPackageId}
            onSelectedPackageChange={(selectedPackageId) => update({ selectedPackageId })}
            onChange={(packages) => update({ packages })}
          />

          <ProcessStepsEditor
            items={proposal.processSteps}
            onChange={(processSteps) => update({ processSteps })}
          />

          <ProofItemsEditor
            items={proposal.proofItems}
            onChange={(proofItems) => update({ proofItems })}
          />

          <SectionCard title="Условия оценки" eyebrow="Допущения">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Textarea
                label="Допущения"
                rows={6}
                value={fromList(proposal.assumptions)}
                helper="Каждый пункт с новой строки."
                onChange={(value) => update({ assumptions: toList(value) })}
              />
              <Textarea
                label="Что не входит"
                rows={6}
                value={fromList(proposal.outOfScope)}
                helper="Каждый пункт с новой строки."
                onChange={(value) => update({ outOfScope: toList(value) })}
              />
            </div>
          </SectionCard>

          <SectionCard title="Коммерческие условия" eyebrow="Условия">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Textarea label="Условия оплаты" rows={5} value={proposal.paymentTerms} onChange={(paymentTerms) => update({ paymentTerms })} />
              <Textarea label="Юридические примечания" rows={5} value={proposal.legalNotes} onChange={(legalNotes) => update({ legalNotes })} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Textarea label="Следующий шаг" rows={4} value={proposal.nextStepText} onChange={(nextStepText) => update({ nextStepText })} />
              <Textarea label="Публичная заметка" rows={4} value={proposal.publicNotes ?? ""} onChange={(publicNotes) => update({ publicNotes })} />
            </div>
            <div className="mt-4">
              <Textarea label="Внутренние заметки" rows={4} value={proposal.internalNotes ?? ""} helper="Не выводится на клиентской странице." onChange={(internalNotes) => update({ internalNotes })} />
            </div>
          </SectionCard>

          <SharingSettings
            proposal={proposal}
            password={password}
            hasStoredPassword={hasStoredPassword}
            publicUrl={publicUrl}
            onPasswordChange={setPassword}
            onChange={update}
            onSave={() => persist()}
            onCopy={copyLink}
            onOpen={openPublicLink}
            onRegenerate={regenerateLink}
            onUnpublish={unpublish}
            saving={saving}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start no-print">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Публикация
                </p>
                <h2 className="mt-1 text-lg font-semibold">Клиентская ссылка</h2>
              </div>
              <Badge className={proposalStatusTone[status]}>
                {proposalStatusLabels[status]}
              </Badge>
            </div>

            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
              {getEffectiveStatus(proposal) === "published" ? publicUrl : "Ссылка появится после публикации КП."}
            </div>

            <div className="mt-4 grid gap-2">
              <Button onClick={publish} disabled={saving}>
                <Send size={16} aria-hidden="true" />
                Опубликовать
              </Button>
              <Button variant="secondary" onClick={copyLink}>
                <Copy size={16} aria-hidden="true" />
                Скопировать ссылку
              </Button>
              <Button variant="secondary" onClick={openPublicLink}>
                <ExternalLink size={16} aria-hidden="true" />
                Открыть клиентскую версию
              </Button>
              <Button variant="secondary" onClick={regenerateLink} disabled={saving}>
                <RefreshCw size={16} aria-hidden="true" />
                Перегенерировать ссылку
              </Button>
              <Button variant="danger" onClick={unpublish} disabled={saving}>
                <XCircle size={16} aria-hidden="true" />
                Снять с публикации
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm">
            <h2 className="text-lg font-semibold">Сводка</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <SummaryRow label="Пакетов" value={String(proposal.packages.length)} />
              <SummaryRow label="Состав работ" value={String(proposal.deliverables.length)} />
              <SummaryRow
                label="Блоки"
                value={`${proposal.blocks.filter((block) => block.visible).length}/${proposal.blocks.length}`}
              />
              <SummaryRow label="Просмотры" value={String(proposal.viewsCount)} />
              <SummaryRow
                label="Рекомендовано"
                value={formatMoney(
                  proposal.packages.find((item) => item.id === proposal.selectedPackageId || item.isRecommended)?.price ?? 0,
                  proposal.currency,
                )}
              />
            </div>
          </section>
        </aside>
      </div>
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </main>
  );
}

function ArchetypeSelector({
  selectedId,
  onSelect,
}: {
  selectedId: ProposalArchetypeId;
  onSelect: (id: ProposalArchetypeId) => void;
}) {
  return (
    <SectionCard title="Архетип КП" eyebrow="Стартовая структура">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {proposalArchetypePresets.map((preset) => {
          const selected = selectedId === preset.id;
          const visibleBlockLabels = preset.blockTypes
            .slice(0, 6)
            .map((type) => blockMeta[type].label)
            .join(" · ");

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              className={`rounded-lg border p-4 text-left transition ${
                selected
                  ? "border-accent bg-accent-soft/60 shadow-sm"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-zinc-950">
                    {preset.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {preset.description}
                  </p>
                </div>
                <Badge
                  className={
                    selected
                      ? "bg-white text-accent-strong ring-accent/30"
                      : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                  }
                >
                  {preset.blockTypes.length}
                </Badge>
              </div>
              <p className="mt-3 text-xs font-medium leading-5 text-zinc-500">
                {visibleBlockLabels}
                {preset.blockTypes.length > 6 ? " · ..." : ""}
              </p>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

function ReadinessWarningsPanel({
  warnings,
}: {
  warnings: ProposalReadinessWarning[];
}) {
  if (!warnings.length) {
    return (
      <div className="rounded-lg border border-accent-soft bg-accent-soft/40 p-4 text-sm font-medium text-accent-strong">
        Контентные проверки пройдены: явных предупреждений перед публикацией нет.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex items-start gap-3">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h3 className="font-semibold">Предупреждения перед публикацией</h3>
          <p className="mt-1 leading-6 text-amber-900">
            Это мягкие guardrails: они не мешают сохранить черновик, но перед
            публикацией стоит проверить тон, границы и следующий шаг.
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {warnings.map((warning) => (
          <li key={warning.id} className="rounded-md bg-white/70 p-3">
            <div className="font-semibold">{warning.title}</div>
            <div className="mt-1 leading-6 text-amber-900">
              {warning.message}
            </div>
            {warning.reference ? (
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                {warning.reference}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlockManager({
  proposal,
  proposalId,
  canUploadMedia,
  blocks,
  onChange,
  onProposalChange,
}: {
  proposal: Proposal;
  proposalId: string;
  canUploadMedia: boolean;
  blocks: ProposalBlock[];
  onChange: (blocks: ProposalBlock[]) => void;
  onProposalChange: (patch: Partial<Proposal>) => void;
}) {
  const [selectedType, setSelectedType] =
    useState<ProposalBlockType>("summary");
  const orderedBlocks = orderProposalBlocks(blocks);
  const selectedMeta = blockMeta[selectedType];

  function commit(nextBlocks: ProposalBlock[]) {
    onChange(reindexBlocks(nextBlocks));
  }

  function addBlock() {
    commit([
      ...orderedBlocks,
      {
        id: createId(),
        type: selectedType,
        order: orderedBlocks.length,
        visible: true,
        props: createDefaultBlockProps(selectedType),
      },
    ]);
  }

  function updateBlock(id: string, patch: Partial<ProposalBlock>) {
    commit(
      orderedBlocks.map((block) =>
        block.id === id ? { ...block, ...patch } : block,
      ),
    );
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = orderedBlocks.findIndex((block) => block.id === id);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= orderedBlocks.length) {
      return;
    }

    const nextBlocks = [...orderedBlocks];
    [nextBlocks[index], nextBlocks[targetIndex]] = [
      nextBlocks[targetIndex],
      nextBlocks[index],
    ];
    commit(nextBlocks);
  }

  function duplicateBlock(block: ProposalBlock) {
    const index = orderedBlocks.findIndex((item) => item.id === block.id);
    const nextBlocks = [...orderedBlocks];
    nextBlocks.splice(index + 1, 0, {
      ...block,
      id: createId(),
      order: index + 1,
      props: cloneBlockProps(block.props),
    });
    commit(nextBlocks);
  }

  function removeBlock(id: string) {
    commit(orderedBlocks.filter((block) => block.id !== id));
  }

  return (
    <SectionCard
      title="Блоки КП"
      eyebrow="Структура страницы"
      action={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-96 sm:flex-row">
          <label className="sr-only" htmlFor="proposal-block-type">
            Тип блока
          </label>
          <select
            id="proposal-block-type"
            value={selectedType}
            onChange={(event) =>
              setSelectedType(event.target.value as ProposalBlockType)
            }
            className="h-10 min-w-0 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
          >
            {proposalBlockTypes.map((type) => (
              <option key={type} value={type}>
                {blockMeta[type].label}
              </option>
            ))}
          </select>
          <Button onClick={addBlock}>
            <Plus size={16} aria-hidden="true" />
            Добавить блок
          </Button>
        </div>
      }
    >
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
        <span className="font-semibold text-zinc-950">
          {selectedMeta.label}.
        </span>{" "}
        {selectedMeta.hint}
      </div>

      <div className="mt-4 space-y-3">
        {orderedBlocks.length ? (
          orderedBlocks.map((block, index) => {
            const meta = blockMeta[block.type];

            return (
              <div
                key={block.id}
                data-block-type={block.type}
                className={`rounded-lg border p-4 transition ${
                  block.visible
                    ? "border-zinc-200 bg-white"
                    : "border-zinc-200 bg-zinc-50 opacity-75"
                }`}
              >
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="flex min-w-0 gap-3">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                      <GripVertical size={16} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-zinc-950">
                          {index + 1}. {meta.label}
                        </h3>
                        <Badge
                          className={
                            block.visible
                              ? "bg-accent-soft text-accent-strong ring-accent/20"
                              : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                          }
                        >
                          {block.visible ? "Виден" : "Скрыт"}
                        </Badge>
                        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500">
                          {block.type}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {meta.hint}
                      </p>
                      <p className="mt-1 text-xs font-medium text-zinc-500">
                        Редактор: {meta.editor}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      variant="secondary"
                      className="w-10 px-0"
                      title="Поднять блок"
                      aria-label="Поднять блок"
                      disabled={index === 0}
                      onClick={() => moveBlock(block.id, -1)}
                    >
                      <ArrowUp size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-10 px-0"
                      title="Опустить блок"
                      aria-label="Опустить блок"
                      disabled={index === orderedBlocks.length - 1}
                      onClick={() => moveBlock(block.id, 1)}
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      variant={block.visible ? "secondary" : "ghost"}
                      title={block.visible ? "Скрыть блок" : "Показать блок"}
                      aria-pressed={block.visible}
                      onClick={() =>
                        updateBlock(block.id, { visible: !block.visible })
                      }
                    >
                      {block.visible ? (
                        <Eye size={16} aria-hidden="true" />
                      ) : (
                        <EyeOff size={16} aria-hidden="true" />
                      )}
                      {block.visible ? "Виден" : "Скрыт"}
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-10 px-0"
                      title="Дублировать блок"
                      aria-label="Дублировать блок"
                      onClick={() => duplicateBlock(block)}
                    >
                      <Copy size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="danger"
                      className="w-10 px-0"
                      title="Удалить блок"
                      aria-label="Удалить блок"
                      onClick={() => removeBlock(block.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <NativeProposalBlockEditor
                  block={block}
                  proposal={proposal}
                  onChange={onProposalChange}
                />

                {block.type === "roles" ? (
                  <RolesBlockEditor
                    block={block}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                ) : null}

                {block.type === "problemSplit" ? (
                  <ProblemSplitBlockEditor
                    block={block}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                ) : null}

                {block.type === "openQuestions" ? (
                  <OpenQuestionsBlockEditor
                    block={block}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                ) : null}

                {block.type === "roiCalculator" ? (
                  <RoiCalculatorBlockEditor
                    block={block}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                ) : null}

                {block.type === "estimateConfigurator" ? (
                  <EstimateConfiguratorBlockEditor
                    block={block}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                ) : null}

                {block.type === "variantPicker" ? (
                  <VariantPickerBlockEditor
                    block={block}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                ) : null}

                {block.type === "media" ? (
                  <MediaBlockEditor
                    block={block}
                    proposalId={proposalId}
                    canUpload={canUploadMedia}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
            Добавьте первый блок, чтобы собрать структуру КП.
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function NativeProposalBlockEditor({
  block,
  proposal,
  onChange,
}: {
  block: ProposalBlock;
  proposal: Proposal;
  onChange: (patch: Partial<Proposal>) => void;
}) {
  function updateShare(patch: Partial<Proposal["shareSettings"]>) {
    onChange({
      shareSettings: {
        ...proposal.shareSettings,
        ...patch,
      },
    });
  }

  switch (block.type) {
    case "hero":
      return (
        <NativeEditorShell
          title="Первый экран"
          copy="Эти поля формируют верхний экран клиентской страницы."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextInput
              label="Название КП"
              value={proposal.title}
              onChange={(title) => onChange({ title })}
            />
            <TextInput
              label="Клиент"
              value={proposal.clientName}
              onChange={(clientName) => onChange({ clientName })}
            />
            <TextInput
              label="Компания"
              value={proposal.clientCompany}
              onChange={(clientCompany) => onChange({ clientCompany })}
            />
            <TextInput
              label="Подготовил"
              value={proposal.preparedBy}
              onChange={(preparedBy) => onChange({ preparedBy })}
            />
            <TextInput
              label="Роль отправителя"
              value={proposal.preparedByRole}
              onChange={(preparedByRole) => onChange({ preparedByRole })}
            />
            <TextInput
              label="Дата КП"
              type="date"
              value={proposal.proposalDate}
              onChange={(proposalDate) => onChange({ proposalDate })}
            />
            <TextInput
              label="Действительно до"
              type="date"
              value={proposal.validUntil}
              onChange={(validUntil) =>
                onChange({
                  validUntil,
                  expiresAt: proposal.expiresAt || validUntil,
                })
              }
            />
            <TextInput
              label="Версия"
              value={proposal.version}
              onChange={(version) => onChange({ version })}
            />
          </div>
          <div className="mt-3">
            <Textarea
              label="Краткое вступление"
              rows={4}
              value={proposal.shortIntro}
              onChange={(shortIntro) => onChange({ shortIntro })}
            />
          </div>
        </NativeEditorShell>
      );

    case "summary":
      return (
        <NativeEditorShell
          title="Краткое резюме"
          copy="Три тезиса, которые клиент увидит сразу после первого экрана."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Textarea
              label="Проблема клиента"
              rows={4}
              value={proposal.clientProblem}
              onChange={(clientProblem) => onChange({ clientProblem })}
            />
            <Textarea
              label="Бизнес-цель"
              rows={4}
              value={proposal.businessGoal}
              onChange={(businessGoal) => onChange({ businessGoal })}
            />
            <Textarea
              label="Предлагаемое решение"
              rows={4}
              value={proposal.proposedSolutionSummary}
              onChange={(proposedSolutionSummary) =>
                onChange({ proposedSolutionSummary })
              }
            />
          </div>
        </NativeEditorShell>
      );

    case "context":
      return (
        <NativeEditorShell
          title="Контекст клиента"
          copy="Исходная ситуация и проблема, из которой рождается предложение."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Textarea
              label="Контекст клиента"
              rows={5}
              value={proposal.clientContext}
              onChange={(clientContext) => onChange({ clientContext })}
            />
            <Textarea
              label="Проблема клиента"
              rows={5}
              value={proposal.clientProblem}
              onChange={(clientProblem) => onChange({ clientProblem })}
            />
          </div>
        </NativeEditorShell>
      );

    case "solution":
      return (
        <NativeEditorShell
          title="Решение"
          copy="Описание подхода и причина, почему он подходит именно этому клиенту."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Textarea
              label="Предлагаемое решение"
              rows={5}
              value={proposal.proposedSolutionSummary}
              onChange={(proposedSolutionSummary) =>
                onChange({ proposedSolutionSummary })
              }
            />
            <Textarea
              label="Почему это решение подходит"
              rows={5}
              value={proposal.whyUs}
              onChange={(whyUs) => onChange({ whyUs })}
            />
          </div>
        </NativeEditorShell>
      );

    case "deliverables":
      return (
        <NativeDeliverablesBlockEditor
          items={proposal.deliverables}
          onChange={(deliverables) => onChange({ deliverables })}
        />
      );

    case "packages":
      return (
        <NativePackagesBlockEditor proposal={proposal} onChange={onChange} />
      );

    case "comparison":
      return (
        <NativePackagesBlockEditor
          proposal={proposal}
          onChange={onChange}
          comparison
        />
      );

    case "timeline":
      return (
        <NativeProcessStepsBlockEditor
          items={proposal.processSteps}
          onChange={(processSteps) => onChange({ processSteps })}
        />
      );

    case "whyUs":
      return (
        <NativeEditorShell
          title="Почему мы"
          copy="Аргументы доверия и релевантности команды."
        >
          <Textarea
            label="Почему это решение подходит"
            rows={5}
            value={proposal.whyUs}
            onChange={(whyUs) => onChange({ whyUs })}
          />
        </NativeEditorShell>
      );

    case "proof":
      return (
        <NativeProofItemsBlockEditor
          items={proposal.proofItems}
          onChange={(proofItems) => onChange({ proofItems })}
        />
      );

    case "assumptions":
      return (
        <NativeEditorShell
          title="Допущения"
          copy="Что считается верным при оценке объёма и стоимости."
        >
          <Textarea
            label="Допущения"
            rows={6}
            helper="Каждый пункт с новой строки."
            value={fromList(proposal.assumptions)}
            onChange={(value) => onChange({ assumptions: toList(value) })}
          />
        </NativeEditorShell>
      );

    case "outOfScope":
      return (
        <NativeEditorShell
          title="Что не входит"
          copy="Границы предложения, чтобы не оставлять серых зон."
        >
          <Textarea
            label="Что не входит"
            rows={6}
            helper="Каждый пункт с новой строки."
            value={fromList(proposal.outOfScope)}
            onChange={(value) => onChange({ outOfScope: toList(value) })}
          />
        </NativeEditorShell>
      );

    case "terms":
      return (
        <NativeEditorShell
          title="Коммерческие условия"
          copy="Оплата, юридические примечания и ограничения."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Textarea
              label="Условия оплаты"
              rows={5}
              value={proposal.paymentTerms}
              onChange={(paymentTerms) => onChange({ paymentTerms })}
            />
            <Textarea
              label="Юридические примечания"
              rows={5}
              value={proposal.legalNotes}
              onChange={(legalNotes) => onChange({ legalNotes })}
            />
          </div>
        </NativeEditorShell>
      );

    case "nextStep":
      return (
        <NativeEditorShell
          title="Следующий шаг"
          copy="CTA-блок, публичная заметка и ссылки для кнопок."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Textarea
              label="Следующий шаг"
              rows={4}
              value={proposal.nextStepText}
              onChange={(nextStepText) => onChange({ nextStepText })}
            />
            <Textarea
              label="Публичная заметка"
              rows={4}
              value={proposal.publicNotes ?? ""}
              onChange={(publicNotes) => onChange({ publicNotes })}
            />
            <TextInput
              label="Строка микро-доверия"
              value={proposal.trustLine ?? ""}
              placeholder={DEFAULT_TRUST_LINE}
              onChange={(trustLine) => onChange({ trustLine })}
            />
            <TextInput
              label="Ссылка для «Согласовать»"
              type="url"
              value={proposal.shareSettings.approveUrl}
              onChange={(approveUrl) => updateShare({ approveUrl })}
            />
            <TextInput
              label="Ссылка для «Обсудить»"
              type="url"
              value={proposal.shareSettings.discussUrl}
              onChange={(discussUrl) => updateShare({ discussUrl })}
            />
            <Toggle
              label="Разрешить комментарий клиента"
              checked={proposal.shareSettings.allowClientComment}
              onChange={(allowClientComment) =>
                updateShare({ allowClientComment })
              }
            />
          </div>
        </NativeEditorShell>
      );

    default:
      return null;
  }
}

function NativeEditorShell({
  title,
  copy,
  action,
  children,
}: {
  title: string;
  copy?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950">{title}</h4>
          {copy ? (
            <p className="mt-1 text-xs leading-5 text-zinc-500">{copy}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function NativeEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
      {children}
    </div>
  );
}

function NativeDeliverablesBlockEditor({
  items,
  onChange,
}: {
  items: ProposalDeliverable[];
  onChange: (items: ProposalDeliverable[]) => void;
}) {
  function updateItem(id: string, patch: Partial<ProposalDeliverable>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    onChange([
      ...items,
      {
        id: createId(),
        title: "Новый результат",
        description: "",
        clientValue: "",
        sortOrder: items.length,
      },
    ]);
  }

  return (
    <NativeEditorShell
      title="Состав работ"
      copy="Конкретные результаты и ценность каждого результата для клиента."
      action={
        <Button variant="secondary" onClick={addItem}>
          <Plus size={16} aria-hidden="true" />
          Добавить
        </Button>
      }
    >
      {items.length ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextInput
                  label="Название"
                  value={item.title}
                  onChange={(title) =>
                    updateItem(item.id, { title, sortOrder: index })
                  }
                />
                <TextInput
                  label="Порядок"
                  type="number"
                  value={String(item.sortOrder)}
                  onChange={(sortOrder) =>
                    updateItem(item.id, {
                      sortOrder: normalizeNumberInput(sortOrder),
                    })
                  }
                />
                <Textarea
                  label="Описание"
                  rows={3}
                  value={item.description}
                  onChange={(description) =>
                    updateItem(item.id, { description })
                  }
                />
                <Textarea
                  label="Ценность для клиента"
                  rows={3}
                  value={item.clientValue}
                  onChange={(clientValue) =>
                    updateItem(item.id, { clientValue })
                  }
                />
              </div>
              <RemoveButton
                onClick={() =>
                  onChange(items.filter((current) => current.id !== item.id))
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <NativeEmptyState>
          Добавьте результат, чтобы блок появился на публичной странице.
        </NativeEmptyState>
      )}
    </NativeEditorShell>
  );
}

function NativePackagesBlockEditor({
  proposal,
  onChange,
  comparison,
}: {
  proposal: Proposal;
  onChange: (patch: Partial<Proposal>) => void;
  comparison?: boolean;
}) {
  function updateShare(patch: Partial<Proposal["shareSettings"]>) {
    onChange({
      shareSettings: {
        ...proposal.shareSettings,
        ...patch,
      },
    });
  }

  function updateItem(id: string, patch: Partial<ProposalPackage>) {
    onChange({
      packages: proposal.packages.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  function setRecommended(id: string) {
    onChange({
      packages: proposal.packages.map((item) => ({
        ...item,
        isRecommended: item.id === id,
      })),
      selectedPackageId: id,
    });
  }

  function addItem() {
    const id = createId();

    onChange({
      packages: [
        ...proposal.packages,
        {
          id,
          name: "Новый пакет",
          description: "",
          price: 0,
          duration: "",
          isRecommended: false,
          features: [],
          sortOrder: proposal.packages.length,
        },
      ],
      selectedPackageId: proposal.selectedPackageId ?? id,
    });
  }

  function removeItem(id: string) {
    const nextPackages = proposal.packages.filter((item) => item.id !== id);
    const selectedPackageId =
      proposal.selectedPackageId === id
        ? nextPackages.find((item) => item.isRecommended)?.id ??
          nextPackages[0]?.id
        : proposal.selectedPackageId;

    onChange({
      packages: nextPackages,
      selectedPackageId,
    });
  }

  return (
    <NativeEditorShell
      title={comparison ? "Сравнение пакетов" : "Пакеты и стоимость"}
      copy={
        comparison
          ? "Те же пакеты используются для таблицы сравнения и выбора клиентом."
          : "Коммерческие варианты, цены, сроки и состав каждого пакета."
      }
      action={
        <Button variant="secondary" onClick={addItem}>
          <Plus size={16} aria-hidden="true" />
          Добавить пакет
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Toggle
          label="Показывать цены"
          checked={proposal.shareSettings.showPrices}
          onChange={(showPrices) => updateShare({ showPrices })}
        />
        <Toggle
          label="Показывать сроки"
          checked={proposal.shareSettings.showTimeline}
          onChange={(showTimeline) => updateShare({ showTimeline })}
        />
        <Toggle
          label="Разрешить выбор пакета"
          checked={proposal.shareSettings.allowPackageSelection}
          onChange={(allowPackageSelection) =>
            updateShare({ allowPackageSelection })
          }
        />
        <Toggle
          label="Показывать сравнение пакетов"
          checked={proposal.shareSettings.showComparisonTable}
          onChange={(showComparisonTable) =>
            updateShare({ showComparisonTable })
          }
        />
      </div>

      {proposal.packages.length ? (
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
          {proposal.packages.map((item, index) => (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setRecommended(item.id)}
                  className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold ${
                    item.isRecommended ||
                    proposal.selectedPackageId === item.id
                      ? "bg-accent-soft text-accent-strong"
                      : "bg-white text-zinc-600"
                  }`}
                >
                  <Check size={14} aria-hidden="true" />
                  Рекомендованный пакет
                </button>
                <RemoveButton compact onClick={() => removeItem(item.id)} />
              </div>

              <div className="mt-4 space-y-3">
                <TextInput
                  label="Название"
                  value={item.name}
                  onChange={(name) =>
                    updateItem(item.id, { name, sortOrder: index })
                  }
                />
                <Textarea
                  label="Описание"
                  rows={3}
                  value={item.description}
                  onChange={(description) =>
                    updateItem(item.id, { description })
                  }
                />
                <TextInput
                  label="Стоимость"
                  type="number"
                  value={String(item.price)}
                  onChange={(price) =>
                    updateItem(item.id, { price: normalizeNumberInput(price) })
                  }
                />
                <TextInput
                  label="Срок"
                  value={item.duration}
                  onChange={(duration) => updateItem(item.id, { duration })}
                />
                <Textarea
                  label="Что входит"
                  rows={6}
                  helper="Каждый пункт с новой строки."
                  value={fromList(item.features)}
                  onChange={(value) =>
                    updateItem(item.id, { features: toList(value) })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <NativeEmptyState>
            Добавьте пакет, чтобы блок появился на публичной странице.
          </NativeEmptyState>
        </div>
      )}
    </NativeEditorShell>
  );
}

function NativeProcessStepsBlockEditor({
  items,
  onChange,
}: {
  items: ProcessStep[];
  onChange: (items: ProcessStep[]) => void;
}) {
  function updateItem(id: string, patch: Partial<ProcessStep>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    onChange([
      ...items,
      {
        id: createId(),
        title: "Новый этап",
        description: "",
        duration: "",
        sortOrder: items.length,
      },
    ]);
  }

  return (
    <NativeEditorShell
      title="Сроки и этапы"
      copy="Процесс, контрольные точки и ожидаемый ритм работ."
      action={
        <Button variant="secondary" onClick={addItem}>
          <Plus size={16} aria-hidden="true" />
          Добавить этап
        </Button>
      }
    >
      {items.length ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[1fr_180px]"
            >
              <div className="space-y-3">
                <TextInput
                  label="Этап"
                  value={item.title}
                  onChange={(title) =>
                    updateItem(item.id, { title, sortOrder: index })
                  }
                />
                <Textarea
                  label="Описание"
                  rows={3}
                  value={item.description}
                  onChange={(description) =>
                    updateItem(item.id, { description })
                  }
                />
              </div>
              <div className="space-y-3">
                <TextInput
                  label="Срок"
                  value={item.duration}
                  onChange={(duration) => updateItem(item.id, { duration })}
                />
                <RemoveButton
                  onClick={() =>
                    onChange(
                      items.filter((current) => current.id !== item.id),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <NativeEmptyState>
          Добавьте этап, чтобы блок появился на публичной странице.
        </NativeEmptyState>
      )}
    </NativeEditorShell>
  );
}

function NativeProofItemsBlockEditor({
  items,
  onChange,
}: {
  items: ProofItem[];
  onChange: (items: ProofItem[]) => void;
}) {
  function updateItem(id: string, patch: Partial<ProofItem>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    onChange([
      ...items,
      {
        id: createId(),
        title: "Новый аргумент",
        description: "",
        result: "",
        sortOrder: items.length,
      },
    ]);
  }

  return (
    <NativeEditorShell
      title="Кейсы и доверие"
      copy="Подтверждения, результаты и сильные аргументы."
      action={
        <Button variant="secondary" onClick={addItem}>
          <Plus size={16} aria-hidden="true" />
          Добавить
        </Button>
      }
    >
      {items.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="space-y-3">
                <TextInput
                  label="Заголовок"
                  value={item.title}
                  onChange={(title) =>
                    updateItem(item.id, { title, sortOrder: index })
                  }
                />
                <Textarea
                  label="Описание"
                  rows={3}
                  value={item.description}
                  onChange={(description) =>
                    updateItem(item.id, { description })
                  }
                />
                <Textarea
                  label="Результат"
                  rows={3}
                  value={item.result}
                  onChange={(result) => updateItem(item.id, { result })}
                />
              </div>
              <RemoveButton
                onClick={() =>
                  onChange(items.filter((current) => current.id !== item.id))
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <NativeEmptyState>
          Добавьте кейс или аргумент, чтобы блок появился на публичной странице.
        </NativeEmptyState>
      )}
    </NativeEditorShell>
  );
}

function RolesBlockEditor({
  block,
  onChange,
}: {
  block: ProposalBlock;
  onChange: (patch: Partial<ProposalBlock>) => void;
}) {
  const roles = getRolesFromProps(block.props);

  function commit(nextRoles: ProposalRoleItem[]) {
    onChange({
      props: {
        ...block.props,
        roles: nextRoles,
      },
    });
  }

  function updateRole(index: number, patch: Partial<ProposalRoleItem>) {
    commit(
      roles.map((role, currentIndex) =>
        currentIndex === index ? { ...role, ...patch } : role,
      ),
    );
  }

  function addRole() {
    commit([
      ...roles,
      {
        role: "",
        gets: "",
        responsibility: "",
        observability: "",
      },
    ]);
  }

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950">
            Матрица ролей
          </h4>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Показывает, что получает каждая сторона и где виден прогресс.
          </p>
        </div>
        <Button variant="secondary" onClick={addRole}>
          <Plus size={16} aria-hidden="true" />
          Добавить роль
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {roles.length ? (
          roles.map((role, index) => (
            <div
              key={index}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextInput
                  label="Роль"
                  value={role.role}
                  onChange={(value) => updateRole(index, { role: value })}
                />
                <Textarea
                  label="Что получает"
                  rows={3}
                  value={role.gets}
                  onChange={(value) => updateRole(index, { gets: value })}
                />
                <Textarea
                  label="Ответственность"
                  rows={3}
                  value={role.responsibility}
                  onChange={(value) =>
                    updateRole(index, { responsibility: value })
                  }
                />
                <Textarea
                  label="Наблюдаемость"
                  rows={3}
                  value={role.observability}
                  onChange={(value) =>
                    updateRole(index, { observability: value })
                  }
                />
              </div>
              <RemoveButton
                onClick={() =>
                  commit(roles.filter((_, currentIndex) => currentIndex !== index))
                }
              />
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            Добавьте роль, чтобы блок появился на публичной странице.
          </div>
        )}
      </div>
    </div>
  );
}

function ProblemSplitBlockEditor({
  block,
  onChange,
}: {
  block: ProposalBlock;
  onChange: (patch: Partial<ProposalBlock>) => void;
}) {
  const props = getProblemSplitFromProps(block.props);

  function commit(
    patch: Partial<{
      asIsTitle: string;
      consequenceTitle: string;
      items: ProposalProblemSplitItem[];
    }>,
  ) {
    onChange({
      props: {
        ...block.props,
        ...patch,
      },
    });
  }

  function updateItem(index: number, patch: Partial<ProposalProblemSplitItem>) {
    commit({
      items: props.items.map((item, currentIndex) =>
        currentIndex === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function addItem() {
    commit({
      items: [...props.items, { asIs: "", consequence: "" }],
    });
  }

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950">
            Как сейчас / последствия
          </h4>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Усиливает боль через пары текущего процесса и его эффекта.
          </p>
        </div>
        <Button variant="secondary" onClick={addItem}>
          <Plus size={16} aria-hidden="true" />
          Добавить пару
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextInput
          label="Заголовок левой колонки"
          value={props.asIsTitle}
          onChange={(asIsTitle) => commit({ asIsTitle })}
        />
        <TextInput
          label="Заголовок правой колонки"
          value={props.consequenceTitle}
          onChange={(consequenceTitle) => commit({ consequenceTitle })}
        />
      </div>

      <div className="mt-4 space-y-3">
        {props.items.length ? (
          props.items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Textarea
                  label="Как сейчас"
                  rows={3}
                  value={item.asIs}
                  onChange={(asIs) => updateItem(index, { asIs })}
                />
                <Textarea
                  label="К чему приводит"
                  rows={3}
                  value={item.consequence}
                  onChange={(consequence) =>
                    updateItem(index, { consequence })
                  }
                />
              </div>
              <RemoveButton
                onClick={() =>
                  commit({
                    items: props.items.filter(
                      (_, currentIndex) => currentIndex !== index,
                    ),
                  })
                }
              />
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            Добавьте пару, чтобы блок появился на публичной странице.
          </div>
        )}
      </div>
    </div>
  );
}

function OpenQuestionsBlockEditor({
  block,
  onChange,
}: {
  block: ProposalBlock;
  onChange: (patch: Partial<ProposalBlock>) => void;
}) {
  const items = getOpenQuestionsFromProps(block.props);

  function commit(nextItems: ProposalOpenQuestionItem[]) {
    onChange({
      props: {
        ...block.props,
        items: nextItems,
      },
    });
  }

  function updateItem(
    index: number,
    patch: Partial<ProposalOpenQuestionItem>,
  ) {
    commit(
      items.map((item, currentIndex) =>
        currentIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function addItem(status: ProposalOpenQuestionStatus = "open") {
    commit([...items, { status, question: "", note: "" }]);
  }

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950">
            Факты, допущения и вопросы
          </h4>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Помогает не маскировать неизвестность под уверенные факты.
          </p>
        </div>
        <Button variant="secondary" onClick={() => addItem()}>
          <Plus size={16} aria-hidden="true" />
          Добавить пункт
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
                <label className="block min-w-0">
                  <span className="text-sm font-medium text-zinc-700">
                    Статус
                  </span>
                  <select
                    value={item.status}
                    onChange={(event) =>
                      updateItem(index, {
                        status: event.target.value as ProposalOpenQuestionStatus,
                      })
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
                  >
                    {openQuestionStatuses.map((status) => (
                      <option key={status} value={status}>
                        {openQuestionStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <TextInput
                  label="Текст"
                  value={item.question}
                  onChange={(question) => updateItem(index, { question })}
                />
              </div>
              <div className="mt-3">
                <Textarea
                  label="Заметка"
                  rows={3}
                  value={item.note ?? ""}
                  onChange={(note) => updateItem(index, { note })}
                />
              </div>
              <RemoveButton
                onClick={() =>
                  commit(items.filter((_, currentIndex) => currentIndex !== index))
                }
              />
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            Добавьте факт, допущение или вопрос, чтобы блок появился на публичной странице.
          </div>
        )}
      </div>
    </div>
  );
}

function RoiCalculatorBlockEditor({
  block,
  onChange,
}: {
  block: ProposalBlock;
  onChange: (patch: Partial<ProposalBlock>) => void;
}) {
  const props = getRoiCalculatorFromProps(block.props);

  function commit(patch: Partial<ProposalRoiCalculatorBlockProps>) {
    onChange({
      props: {
        ...block.props,
        ...patch,
      },
    });
  }

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <div>
        <h4 className="text-sm font-semibold text-zinc-950">
          Калькулятор экономики
        </h4>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          Клиент сможет менять эти значения на публичной странице и видеть пересчёт.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextInput
          label="Операций в месяц"
          type="number"
          value={String(props.operationsPerMonth)}
          onChange={(value) =>
            commit({ operationsPerMonth: normalizeNumberInput(value) })
          }
        />
        <TextInput
          label="Стоимость операции вручную"
          type="number"
          value={String(props.manualCostPerOperation)}
          onChange={(value) =>
            commit({ manualCostPerOperation: normalizeNumberInput(value) })
          }
        />
        <TextInput
          label="Доля автоматизации, %"
          type="number"
          value={String(props.automationSharePercent)}
          onChange={(value) =>
            commit({
              automationSharePercent: Math.min(
                100,
                normalizeNumberInput(value),
              ),
            })
          }
        />
        <TextInput
          label="Стоимость внедрения"
          type="number"
          value={String(props.implementationCost ?? 0)}
          onChange={(value) =>
            commit({ implementationCost: normalizeNumberInput(value) })
          }
        />
      </div>
      <div className="mt-3">
        <Textarea
          label="Заметка к расчёту"
          rows={3}
          value={props.note ?? ""}
          onChange={(note) => commit({ note })}
        />
      </div>
    </div>
  );
}

function EstimateConfiguratorBlockEditor({
  block,
  onChange,
}: {
  block: ProposalBlock;
  onChange: (patch: Partial<ProposalBlock>) => void;
}) {
  const props = getEstimateConfiguratorFromProps(block.props);

  function commit(patch: Partial<ProposalEstimateConfiguratorBlockProps>) {
    onChange({
      props: {
        ...block.props,
        ...patch,
      },
    });
  }

  function updateModule(index: number, patch: Partial<ProposalEstimateModule>) {
    commit({
      modules: props.modules.map((module, currentIndex) =>
        currentIndex === index ? { ...module, ...patch } : module,
      ),
    });
  }

  function addModule() {
    commit({
      modules: [
        ...props.modules,
        {
          id: createId(),
          name: "",
          description: "",
          price: 0,
          dependsOn: undefined,
          default: false,
          defaultSelected: false,
        },
      ],
    });
  }

  function removeModule(index: number) {
    const removed = props.modules[index];
    commit({
      modules: props.modules
        .filter((_, currentIndex) => currentIndex !== index)
        .map((module) =>
          module.dependsOn === removed?.id
            ? { ...module, dependsOn: undefined }
            : module,
        ),
    });
  }

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950">
            Конфигуратор сметы
          </h4>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Клиент выбирает модули, а публичная страница пересчитывает сумму и
            подтягивает зависимости.
          </p>
        </div>
        <Button variant="secondary" onClick={addModule}>
          <Plus size={16} aria-hidden="true" />
          Добавить модуль
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {props.modules.length ? (
          props.modules.map((module, index) => (
            <div
              key={module.id || index}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextInput
                  label="Название модуля"
                  value={module.name}
                  onChange={(name) => updateModule(index, { name })}
                />
                <TextInput
                  label="Стоимость"
                  type="number"
                  value={String(module.price)}
                  onChange={(price) =>
                    updateModule(index, { price: normalizeNumberInput(price) })
                  }
                />
                <Textarea
                  label="Описание"
                  rows={3}
                  value={module.description ?? ""}
                  onChange={(description) =>
                    updateModule(index, { description })
                  }
                />
                <label className="block min-w-0">
                  <span className="text-sm font-medium text-zinc-700">
                    Зависит от
                  </span>
                  <select
                    value={module.dependsOn ?? ""}
                    onChange={(event) =>
                      updateModule(index, {
                        dependsOn: event.target.value || undefined,
                      })
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
                  >
                    <option value="">Нет зависимости</option>
                    {props.modules
                      .filter((item, currentIndex) => currentIndex !== index)
                      .map((item, optionIndex) => (
                        <option key={item.id || optionIndex} value={item.id}>
                          {item.name.trim() || `Модуль ${optionIndex + 1}`}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="mt-3">
                <Toggle
                  label="Выбран по умолчанию"
                  checked={Boolean(module.defaultSelected || module.default)}
                  helper="Модуль будет включён в стартовую сумму на публичной странице."
                  onChange={(selected) =>
                    updateModule(index, {
                      default: selected,
                      defaultSelected: selected,
                    })
                  }
                />
              </div>
              <RemoveButton onClick={() => removeModule(index)} />
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            Добавьте хотя бы один модуль, чтобы блок появился на публичной
            странице.
          </div>
        )}
      </div>

      <div className="mt-3">
        <Textarea
          label="Заметка к конфигуратору"
          rows={3}
          value={props.note ?? ""}
          onChange={(note) => commit({ note })}
        />
      </div>
    </div>
  );
}

function VariantPickerBlockEditor({
  block,
  onChange,
}: {
  block: ProposalBlock;
  onChange: (patch: Partial<ProposalBlock>) => void;
}) {
  const props = getVariantPickerFromProps(block.props);
  const canAddVariant = props.variants.length < 4;

  function commit(patch: Partial<ProposalVariantPickerBlockProps>) {
    onChange({
      props: {
        ...block.props,
        ...patch,
      },
    });
  }

  function updateVariant(index: number, patch: Partial<ProposalVariantItem>) {
    commit({
      variants: props.variants.map((variant, currentIndex) =>
        currentIndex === index ? { ...variant, ...patch } : variant,
      ),
    });
  }

  function addVariant() {
    if (!canAddVariant) {
      return;
    }

    commit({
      variants: [
        ...props.variants,
        {
          id: createId(),
          name: "",
          summary: "",
          price: 0,
          duration: "",
          tradeoffs: [],
          isRecommended: props.variants.length === 0,
        },
      ],
    });
  }

  function setRecommended(index: number, selected: boolean) {
    commit({
      variants: props.variants.map((variant, currentIndex) => ({
        ...variant,
        isRecommended:
          currentIndex === index ? selected : selected ? false : variant.isRecommended,
      })),
    });
  }

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950">
            Выбор архитектурного варианта
          </h4>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Добавьте от двух до четырёх вариантов, чтобы клиент мог сравнить
            цену, срок и компромиссы.
          </p>
        </div>
        <Button variant="secondary" onClick={addVariant} disabled={!canAddVariant}>
          <Plus size={16} aria-hidden="true" />
          Добавить вариант
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {props.variants.length ? (
          props.variants.map((variant, index) => (
            <div
              key={variant.id || index}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextInput
                  label="Название варианта"
                  value={variant.name}
                  onChange={(name) => updateVariant(index, { name })}
                />
                <TextInput
                  label="Срок"
                  value={variant.duration ?? ""}
                  onChange={(duration) => updateVariant(index, { duration })}
                />
                <TextInput
                  label="Бюджет"
                  type="number"
                  value={String(variant.price ?? 0)}
                  onChange={(price) =>
                    updateVariant(index, { price: normalizeNumberInput(price) })
                  }
                />
                <Textarea
                  label="Краткое описание"
                  rows={3}
                  value={variant.summary}
                  onChange={(summary) => updateVariant(index, { summary })}
                />
              </div>
              <div className="mt-3">
                <Textarea
                  label="Компромиссы"
                  rows={4}
                  helper="Каждый пункт с новой строки."
                  value={fromList(variant.tradeoffs)}
                  onChange={(value) =>
                    updateVariant(index, { tradeoffs: toList(value) })
                  }
                />
              </div>
              <div className="mt-3">
                <Toggle
                  label="Рекомендованный вариант"
                  checked={Boolean(variant.isRecommended)}
                  helper="На публичной странице этот вариант будет выбран первым."
                  onChange={(selected) => setRecommended(index, selected)}
                />
              </div>
              <RemoveButton
                onClick={() =>
                  commit({
                    variants: props.variants.filter(
                      (_, currentIndex) => currentIndex !== index,
                    ),
                  })
                }
              />
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            Добавьте минимум два варианта, чтобы блок появился на публичной
            странице.
          </div>
        )}
      </div>

      <div className="mt-3">
        <Textarea
          label="Заметка к вариантам"
          rows={3}
          value={props.note ?? ""}
          onChange={(note) => commit({ note })}
        />
      </div>
    </div>
  );
}

function MediaBlockEditor({
  block,
  proposalId,
  canUpload,
  onChange,
}: {
  block: ProposalBlock;
  proposalId: string;
  canUpload: boolean;
  onChange: (patch: Partial<ProposalBlock>) => void;
}) {
  const props = getMediaBlockFromProps(block.props);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function commit(patch: Partial<ProposalMediaBlockProps>) {
    onChange({
      props: {
        ...block.props,
        ...patch,
      },
    });
  }

  function updateItem(index: number, patch: Partial<ProposalMediaItem>) {
    commit({
      items: props.items.map((item, currentIndex) =>
        currentIndex === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function addExternalItem() {
    commit({
      items: [
        ...props.items,
        {
          id: createId(),
          url: "",
          storageProvider: "external",
          title: "",
          caption: "",
          alt: "",
        },
      ],
    });
  }

  async function uploadFile(file: File) {
    if (!canUpload) {
      setError("Сначала сохраните КП, затем загрузите файл.");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/proposals/${proposalId}/media`, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        media?: ProposalMediaItem;
        error?: string;
      };

      if (!response.ok || !result.media) {
        throw new Error(result.error || "Не удалось загрузить файл");
      }

      commit({
        items: [
          ...props.items,
          {
            ...result.media,
            title: "",
            caption: "",
            alt: result.media.alt || file.name,
          },
        ],
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить файл",
      );
    } finally {
      setUploading(false);
    }
  }

  async function removeItem(index: number) {
    const item = props.items[index];

    if (item?.storageKey && item.storageProvider !== "external") {
      await fetch(`/api/proposals/${proposalId}/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey: item.storageKey,
          storageProvider: item.storageProvider,
        }),
      }).catch(() => undefined);
    }

    commit({
      items: props.items.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950">
            Медиа и скриншоты
          </h4>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Добавляйте только артефакты, которые помогают объяснить решение:
            скриншоты, схемы, wireframe или визуальное доказательство.
          </p>
        </div>
        <Button variant="secondary" onClick={addExternalItem}>
          <Plus size={16} aria-hidden="true" />
          Добавить URL
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
        <label className="block min-w-0">
          <span className="text-sm font-medium text-zinc-700">Режим</span>
          <select
            value={props.layout}
            onChange={(event) =>
              commit({
                layout:
                  event.target.value === "showcase" ? "showcase" : "figure",
              })
            }
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
          >
            <option value="figure">Один скриншот</option>
            <option value="showcase">Галерея</option>
          </select>
        </label>

        <label className="block min-w-0">
          <span className="text-sm font-medium text-zinc-700">
            Загрузить изображение
          </span>
          <input
            type="file"
            accept="image/*"
            disabled={!canUpload || uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";

              if (file) {
                void uploadFile(file);
              }
            }}
            className="mt-1 block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            {canUpload
              ? "PNG/JPG/WebP/GIF до 10 МБ."
              : "Сначала сохраните КП, затем загрузите файл."}
          </span>
        </label>
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {props.items.length ? (
          props.items.map((item, index) => (
            <div
              key={item.id || index}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextInput
                  label="URL изображения"
                  value={item.url}
                  helper={
                    item.storageProvider === "external"
                      ? "Можно указать внешний HTTPS URL."
                      : "Файл загружен в хранилище КП."
                  }
                  onChange={(url) => updateItem(index, { url })}
                />
                <TextInput
                  label="Alt"
                  value={item.alt}
                  helper="Обязательно: что изображено и зачем это важно."
                  onChange={(alt) => updateItem(index, { alt })}
                />
                <TextInput
                  label="Заголовок"
                  value={item.title ?? ""}
                  onChange={(title) => updateItem(index, { title })}
                />
                <Textarea
                  label="Подпись"
                  rows={3}
                  value={item.caption ?? ""}
                  onChange={(caption) => updateItem(index, { caption })}
                />
              </div>
              <RemoveButton onClick={() => void removeItem(index)} />
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
            Добавьте изображение и заполните alt, чтобы блок появился на
            публичной странице.
          </div>
        )}
      </div>

      <div className="mt-3">
        <Textarea
          label="Заметка к медиа"
          rows={3}
          value={props.note ?? ""}
          onChange={(note) => commit({ note })}
        />
      </div>
    </div>
  );
}

function orderProposalBlocks(blocks: ProposalBlock[]) {
  return blocks
    .map((block, index) => ({ block, index }))
    .sort((left, right) => left.block.order - right.block.order || left.index - right.index)
    .map(({ block }) => block);
}

function reindexBlocks(blocks: ProposalBlock[]) {
  return blocks.map((block, index) => ({ ...block, order: index }));
}

function createDefaultBlockProps(type: ProposalBlockType) {
  if (type === "roles") {
    return { roles: [] };
  }

  if (type === "problemSplit") {
    return {
      asIsTitle: "Как сейчас",
      consequenceTitle: "К чему приводит",
      items: [],
    };
  }

  if (type === "openQuestions") {
    return { items: [] };
  }

  if (type === "roiCalculator") {
    return {
      operationsPerMonth: 0,
      manualCostPerOperation: 0,
      automationSharePercent: 0,
      implementationCost: 0,
      note: "",
    };
  }

  if (type === "estimateConfigurator") {
    return {
      modules: [],
      note: "",
    };
  }

  if (type === "variantPicker") {
    return {
      variants: [],
      note: "",
    };
  }

  if (type === "media") {
    return {
      layout: "figure",
      items: [],
      note: "",
    };
  }

  return {};
}

function cloneBlockProps(props: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(props)) as Record<string, unknown>;
}

function getRolesFromProps(props: Record<string, unknown>): ProposalRoleItem[] {
  const roles = Array.isArray(props.roles) ? props.roles : [];

  return roles.map((role) => {
    if (!role || typeof role !== "object" || Array.isArray(role)) {
      return {
        role: "",
        gets: "",
        responsibility: "",
        observability: "",
      };
    }

    return {
      role: readPropString(role, "role"),
      gets: readPropString(role, "gets"),
      responsibility: readPropString(role, "responsibility"),
      observability: readPropString(role, "observability"),
    };
  });
}

function readPropString(source: object, key: keyof ProposalRoleItem) {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getProblemSplitFromProps(props: Record<string, unknown>): {
  asIsTitle: string;
  consequenceTitle: string;
  items: ProposalProblemSplitItem[];
} {
  const items = Array.isArray(props.items) ? props.items : [];

  return {
    asIsTitle: readStringProp(props, "asIsTitle") || "Как сейчас",
    consequenceTitle:
      readStringProp(props, "consequenceTitle") || "К чему приводит",
    items: items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { asIs: "", consequence: "" };
      }

      return {
        asIs: readStringProp(item, "asIs"),
        consequence: readStringProp(item, "consequence"),
      };
    }),
  };
}

function readStringProp(source: object, key: string) {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getOpenQuestionsFromProps(
  props: Record<string, unknown>,
): ProposalOpenQuestionItem[] {
  const items = Array.isArray(props.items) ? props.items : [];

  return items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { status: "open", question: "", note: "" };
    }

    return {
      status: readOpenQuestionStatus(item),
      question: readStringProp(item, "question"),
      note: readStringProp(item, "note"),
    };
  });
}

function readOpenQuestionStatus(source: object): ProposalOpenQuestionStatus {
  const value = (source as Record<string, unknown>).status;
  return openQuestionStatuses.includes(value as ProposalOpenQuestionStatus)
    ? (value as ProposalOpenQuestionStatus)
    : "open";
}

function getRoiCalculatorFromProps(
  props: Record<string, unknown>,
): ProposalRoiCalculatorBlockProps {
  return {
    operationsPerMonth: readNumberProp(props, "operationsPerMonth"),
    manualCostPerOperation: readNumberProp(props, "manualCostPerOperation"),
    automationSharePercent: Math.min(
      100,
      readNumberProp(props, "automationSharePercent"),
    ),
    implementationCost: readNumberProp(props, "implementationCost"),
    note: readStringProp(props, "note"),
  };
}

function getEstimateConfiguratorFromProps(
  props: Record<string, unknown>,
): ProposalEstimateConfiguratorBlockProps {
  const modules = Array.isArray(props.modules) ? props.modules : [];

  return {
    modules: modules.map((module, index) => {
      if (!module || typeof module !== "object" || Array.isArray(module)) {
        return {
          id: `module-${index + 1}`,
          name: "",
          description: "",
          price: 0,
          dependsOn: undefined,
          default: false,
          defaultSelected: false,
        };
      }

      const defaultSelected =
        readBooleanProp(module, "defaultSelected") ||
        readBooleanProp(module, "default");

      return {
        id: readStringProp(module, "id") || `module-${index + 1}`,
        name: readStringProp(module, "name"),
        description: readStringProp(module, "description"),
        price: readNumberProp(module, "price"),
        dependsOn: readStringProp(module, "dependsOn") || undefined,
        default: defaultSelected,
        defaultSelected,
      };
    }),
    note: readStringProp(props, "note"),
  };
}

function getVariantPickerFromProps(
  props: Record<string, unknown>,
): ProposalVariantPickerBlockProps {
  const variants = Array.isArray(props.variants) ? props.variants : [];

  return {
    variants: variants.map((variant, index) => {
      if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
        return {
          id: `variant-${index + 1}`,
          name: "",
          summary: "",
          price: 0,
          duration: "",
          tradeoffs: [],
          isRecommended: false,
        };
      }

      return {
        id: readStringProp(variant, "id") || `variant-${index + 1}`,
        name: readStringProp(variant, "name"),
        summary: readStringProp(variant, "summary"),
        price: readNumberProp(variant, "price"),
        duration: readStringProp(variant, "duration"),
        tradeoffs: readStringArrayProp(
          (variant as Record<string, unknown>).tradeoffs,
        ),
        isRecommended: readBooleanProp(variant, "isRecommended"),
      };
    }),
    note: readStringProp(props, "note"),
  };
}

function getMediaBlockFromProps(
  props: Record<string, unknown>,
): ProposalMediaBlockProps {
  const items = Array.isArray(props.items) ? props.items : [];

  return {
    layout: readStringProp(props, "layout") === "showcase" ? "showcase" : "figure",
    items: items.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return {
          id: `media-${index + 1}`,
          url: "",
          storageProvider: "external",
          title: "",
          caption: "",
          alt: "",
        };
      }

      return {
        id: readStringProp(item, "id") || `media-${index + 1}`,
        url: readStringProp(item, "url"),
        storageKey: readStringProp(item, "storageKey") || undefined,
        storageProvider: readMediaStorageProviderProp(item),
        title: readStringProp(item, "title"),
        caption: readStringProp(item, "caption"),
        alt: readStringProp(item, "alt"),
      };
    }),
    note: readStringProp(props, "note"),
  };
}

function normalizeNumberInput(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function readNumberProp(source: object, key: string) {
  const value = (source as Record<string, unknown>)[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function readBooleanProp(source: object, key: string) {
  return (source as Record<string, unknown>)[key] === true;
}

function readMediaStorageProviderProp(source: object) {
  const value = readStringProp(source, "storageProvider");

  return value === "local" || value === "supabase" || value === "external"
    ? value
    : "external";
}

function readStringArrayProp(value: unknown) {
  const items =
    typeof value === "string"
      ? value.split(/\r?\n/)
      : Array.isArray(value)
        ? value
        : [];

  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function SharingSettings({
  proposal,
  password,
  hasStoredPassword,
  publicUrl,
  saving,
  onPasswordChange,
  onChange,
  onSave,
  onCopy,
  onOpen,
  onRegenerate,
  onUnpublish,
}: {
  proposal: Proposal;
  password: string;
  hasStoredPassword: boolean;
  publicUrl: string;
  saving: boolean;
  onPasswordChange: (value: string) => void;
  onChange: (patch: Partial<Proposal>) => void;
  onSave: () => void;
  onCopy: () => void;
  onOpen: () => void;
  onRegenerate: () => void;
  onUnpublish: () => void;
}) {
  function updateShare(patch: Partial<Proposal["shareSettings"]>) {
    onChange({
      shareSettings: {
        ...proposal.shareSettings,
        ...patch,
      },
    });
  }

  return (
    <section id="sharing">
      <SectionCard title="Настройки публикации" eyebrow="Клиентская ссылка">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Toggle
            label="Опубликовано"
            checked={proposal.status === "published"}
            onChange={(checked) =>
              onChange({
                status: checked ? "published" : "hidden",
                publishedAt: checked ? proposal.publishedAt || new Date().toISOString() : proposal.publishedAt,
                shareSettings: {
                  ...proposal.shareSettings,
                  isPublished: checked,
                },
              })
            }
          />
          <Toggle
            label="Защита паролем"
            checked={proposal.isPasswordProtected}
            onChange={(checked) =>
              onChange({
                isPasswordProtected: checked,
                shareSettings: {
                  ...proposal.shareSettings,
                  accessMode: checked ? "password" : "public_link",
                },
              })
            }
          />
          <TextInput label="Публичная ссылка" value={publicUrl} onChange={() => undefined} />
          <TextInput
            label="Slug"
            value={proposal.shareSlug}
            helper="Slug генерируется безопасно. Используйте только латиницу, цифры, дефис и подчёркивание."
            onChange={(shareSlug) => {
              const normalized = shareSlug.replace(/[^a-zA-Z0-9_-]/g, "");
              onChange({
                shareSlug: normalized,
                shareSettings: { ...proposal.shareSettings, shareSlug: normalized },
              });
            }}
          />
          <TextInput label="Срок действия ссылки" type="date" value={proposal.expiresAt} onChange={(expiresAt) => onChange({ expiresAt, shareSettings: { ...proposal.shareSettings, expiresAt } })} />
          <TextInput label="Пароль" type="password" value={password} helper={hasStoredPassword ? "Оставьте пустым, чтобы сохранить текущий пароль." : "Пароль будет сохранён только как hash."} onChange={onPasswordChange} />
          <TextInput
            label="Строка микро-доверия"
            value={proposal.trustLine ?? ""}
            placeholder={DEFAULT_TRUST_LINE}
            helper="Показывается под CTA на публичной странице."
            onChange={(trustLine) => onChange({ trustLine })}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextInput
            label="Ссылка для кнопки «Согласовать»"
            type="url"
            value={proposal.shareSettings.approveUrl}
            placeholder="https://calendly.com/your-team/30min"
            helper="Примеры: https://calendly.com/…, https://t.me/your_team, https://wa.me/79991234567, mailto:hello@isty.ist, tel:+74951234567. Пусто — только фиксируем клик."
            onChange={(approveUrl) => updateShare({ approveUrl })}
          />
          <TextInput
            label="Ссылка для кнопки «Обсудить»"
            type="url"
            value={proposal.shareSettings.discussUrl}
            placeholder="https://t.me/your_team"
            helper="Поддерживаются http(s), mailto, tel. Удобно вести в Telegram, на встречу или в чат поддержки."
            onChange={(discussUrl) => updateShare({ discussUrl })}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Toggle label="Показывать цены" checked={proposal.shareSettings.showPrices} onChange={(showPrices) => updateShare({ showPrices })} />
          <Toggle label="Показывать сроки" checked={proposal.shareSettings.showTimeline} onChange={(showTimeline) => updateShare({ showTimeline })} />
          <Toggle label="Разрешить выбор пакета" checked={proposal.shareSettings.allowPackageSelection} onChange={(allowPackageSelection) => updateShare({ allowPackageSelection })} />
          <Toggle label="Разрешить комментарий клиента" checked={proposal.shareSettings.allowClientComment} onChange={(allowClientComment) => updateShare({ allowClientComment })} />
          <Toggle label="Показывать сравнение пакетов" checked={proposal.shareSettings.showComparisonTable} onChange={(showComparisonTable) => updateShare({ showComparisonTable })} />
          <Toggle label="Скрыть от поисковиков" checked={proposal.shareSettings.noIndex} onChange={(noIndex) => updateShare({ noIndex })} />
        </div>

        {proposal.isPasswordProtected && !password && !hasStoredPassword ? (
          <div className="mt-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            Для включения защиты задайте пароль и сохраните настройки.
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={saving}>
            <Save size={16} aria-hidden="true" />
            Сохранить настройки
          </Button>
          <Button variant="secondary" onClick={onCopy}>
            <Copy size={16} aria-hidden="true" />
            Скопировать ссылку
          </Button>
          <Button variant="secondary" onClick={onOpen}>
            <ExternalLink size={16} aria-hidden="true" />
            Открыть ссылку
          </Button>
          <Button variant="secondary" onClick={onRegenerate}>
            <RefreshCw size={16} aria-hidden="true" />
            Перегенерировать ссылку
          </Button>
          <Button variant="danger" onClick={onUnpublish}>
            <XCircle size={16} aria-hidden="true" />
            Снять с публикации
          </Button>
        </div>
      </SectionCard>
    </section>
  );
}

function DeliverablesEditor({
  items,
  onChange,
}: {
  items: ProposalDeliverable[];
  onChange: (items: ProposalDeliverable[]) => void;
}) {
  function updateItem(id: string, patch: Partial<ProposalDeliverable>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onChange([
      ...items,
      {
        id: createId(),
        title: "Новый результат",
        description: "",
        clientValue: "",
        sortOrder: items.length,
      },
    ]);
  }

  return (
    <SectionCard title="Состав работ" eyebrow="Результаты" action={<Button variant="secondary" onClick={addItem}>Добавить</Button>}>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextInput label="Название" value={item.title} onChange={(title) => updateItem(item.id, { title, sortOrder: index })} />
              <TextInput label="Порядок" type="number" value={String(item.sortOrder)} onChange={(sortOrder) => updateItem(item.id, { sortOrder: Number(sortOrder) || 0 })} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Textarea label="Описание" value={item.description} onChange={(description) => updateItem(item.id, { description })} />
              <Textarea label="Ценность для клиента" value={item.clientValue} onChange={(clientValue) => updateItem(item.id, { clientValue })} />
            </div>
            <RemoveButton onClick={() => onChange(items.filter((current) => current.id !== item.id))} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function PackagesEditor({
  items,
  selectedPackageId,
  onSelectedPackageChange,
  onChange,
}: {
  items: ProposalPackage[];
  selectedPackageId?: string;
  onSelectedPackageChange: (id: string) => void;
  onChange: (items: ProposalPackage[]) => void;
}) {
  function updateItem(id: string, patch: Partial<ProposalPackage>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function setRecommended(id: string) {
    onChange(items.map((item) => ({ ...item, isRecommended: item.id === id })));
    onSelectedPackageChange(id);
  }

  function addItem() {
    onChange([
      ...items,
      {
        id: createId(),
        name: "Новый пакет",
        description: "",
        price: 0,
        duration: "",
        isRecommended: false,
        features: [],
        sortOrder: items.length,
      },
    ]);
  }

  return (
    <SectionCard title="Пакеты и стоимость" eyebrow="Пакеты" action={<Button variant="secondary" onClick={addItem}>Добавить пакет</Button>}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setRecommended(item.id)}
                className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold ${
                  item.isRecommended || selectedPackageId === item.id
                    ? "bg-accent-soft text-accent-strong"
                    : "bg-white text-zinc-600"
                }`}
              >
                <Check size={14} aria-hidden="true" />
                Рекомендованный пакет
              </button>
              <RemoveButton compact onClick={() => onChange(items.filter((current) => current.id !== item.id))} />
            </div>
            <div className="mt-4 space-y-3">
              <TextInput label="Название" value={item.name} onChange={(name) => updateItem(item.id, { name, sortOrder: index })} />
              <Textarea label="Описание" rows={3} value={item.description} onChange={(description) => updateItem(item.id, { description })} />
              <TextInput label="Стоимость" type="number" value={String(item.price)} onChange={(price) => updateItem(item.id, { price: Number(price) || 0 })} />
              <TextInput label="Срок" value={item.duration} onChange={(duration) => updateItem(item.id, { duration })} />
              <Textarea label="Что входит" rows={6} helper="Каждый пункт с новой строки." value={fromList(item.features)} onChange={(value) => updateItem(item.id, { features: toList(value) })} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function ProcessStepsEditor({
  items,
  onChange,
}: {
  items: ProcessStep[];
  onChange: (items: ProcessStep[]) => void;
}) {
  function updateItem(id: string, patch: Partial<ProcessStep>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <SectionCard
      title="Сроки и этапы"
      eyebrow="Сроки"
      action={
        <Button
          variant="secondary"
          onClick={() =>
            onChange([
              ...items,
              { id: createId(), title: "Новый этап", description: "", duration: "", sortOrder: items.length },
            ])
          }
        >
          Добавить этап
        </Button>
      }
    >
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[1fr_180px]">
            <div className="space-y-3">
              <TextInput label="Этап" value={item.title} onChange={(title) => updateItem(item.id, { title, sortOrder: index })} />
              <Textarea label="Описание" rows={3} value={item.description} onChange={(description) => updateItem(item.id, { description })} />
            </div>
            <div className="space-y-3">
              <TextInput label="Срок" value={item.duration} onChange={(duration) => updateItem(item.id, { duration })} />
              <RemoveButton onClick={() => onChange(items.filter((current) => current.id !== item.id))} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function ProofItemsEditor({
  items,
  onChange,
}: {
  items: ProofItem[];
  onChange: (items: ProofItem[]) => void;
}) {
  function updateItem(id: string, patch: Partial<ProofItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <SectionCard
      title="Кейсы / доверие"
      eyebrow="Доверие"
      action={
        <Button
          variant="secondary"
          onClick={() =>
            onChange([
              ...items,
              { id: createId(), title: "Новый аргумент", description: "", result: "", sortOrder: items.length },
            ])
          }
        >
          Добавить
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="space-y-3">
              <TextInput label="Заголовок" value={item.title} onChange={(title) => updateItem(item.id, { title, sortOrder: index })} />
              <Textarea label="Описание" rows={3} value={item.description} onChange={(description) => updateItem(item.id, { description })} />
              <Textarea label="Результат" rows={3} value={item.result} onChange={(result) => updateItem(item.id, { result })} />
            </div>
            <RemoveButton onClick={() => onChange(items.filter((current) => current.id !== item.id))} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function RemoveButton({
  onClick,
  compact,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 ${
        compact ? "mt-0 px-2 py-1" : "px-3 py-2"
      }`}
    >
      <XCircle size={16} aria-hidden="true" />
      {compact ? "" : "Удалить"}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
      <span>{label}</span>
      <span className="font-semibold text-zinc-950">{value}</span>
    </div>
  );
}
