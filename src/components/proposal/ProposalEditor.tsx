"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Eye,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  createId,
  formatMoney,
  getEffectiveStatus,
  getPublicUrl,
  proposalStatusLabels,
  proposalStatusTone,
  toList,
  fromList,
} from "@/lib/proposal";
import type {
  ProcessStep,
  ProofItem,
  Proposal,
  ProposalDeliverable,
  ProposalPackage,
  ProposalStatus,
  ToastState,
} from "@/lib/types";
import { Badge, Button, SectionCard, TextInput, Textarea, Toast, Toggle } from "./Ui";

type ProposalEditorProps = {
  initialProposal: Proposal;
  mode: "new" | "edit";
};

export function ProposalEditor({ initialProposal, mode }: ProposalEditorProps) {
  const router = useRouter();
  const [proposal, setProposal] = useState(initialProposal);
  const [currentId, setCurrentId] = useState(mode === "edit" ? initialProposal.id : null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const status = getEffectiveStatus(proposal);
  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return getPublicUrl(window.location.origin, proposal.shareSlug);
  }, [proposal.shareSlug]);

  const isExpired = status === "expired";

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

  async function persist(
    nextProposal = proposal,
    nextPassword = password,
    options: { notify?: boolean } = {},
  ) {
    const notify = options.notify ?? true;

    if (nextProposal.isPasswordProtected && !nextPassword.trim() && !nextProposal.passwordHash) {
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
    <main className="bg-noise min-h-screen bg-main text-paper">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-main/90 backdrop-blur no-print">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-paper hover:bg-white/10"
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
                <span className="text-sm text-paper/60">Версия {proposal.version}</span>
              </div>
              <h1 className="mt-1 text-xl font-semibold">
                {mode === "new" ? "Новое КП" : "Редактировать КП"}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
          <section className="rounded-lg border border-white/10 bg-paper p-4 text-zinc-950 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
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

          <section className="rounded-lg border border-white/10 bg-paper p-4 text-zinc-950 shadow-xl shadow-black/20">
            <h2 className="text-lg font-semibold">Сводка</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <SummaryRow label="Пакетов" value={String(proposal.packages.length)} />
              <SummaryRow label="Состав работ" value={String(proposal.deliverables.length)} />
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

function SharingSettings({
  proposal,
  password,
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
          <TextInput label="Пароль" type="password" value={password} helper={proposal.passwordHash ? "Оставьте пустым, чтобы сохранить текущий пароль." : "Пароль будет сохранён только как hash."} onChange={onPasswordChange} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Toggle label="Показывать цены" checked={proposal.shareSettings.showPrices} onChange={(showPrices) => updateShare({ showPrices })} />
          <Toggle label="Показывать сроки" checked={proposal.shareSettings.showTimeline} onChange={(showTimeline) => updateShare({ showTimeline })} />
          <Toggle label="Разрешить выбор пакета" checked={proposal.shareSettings.allowPackageSelection} onChange={(allowPackageSelection) => updateShare({ allowPackageSelection })} />
          <Toggle label="Разрешить комментарий клиента" checked={proposal.shareSettings.allowClientComment} onChange={(allowClientComment) => updateShare({ allowClientComment })} />
          <Toggle label="Показывать сравнение пакетов" checked={proposal.shareSettings.showComparisonTable} onChange={(showComparisonTable) => updateShare({ showComparisonTable })} />
          <Toggle label="Скрыть от поисковиков" checked={proposal.shareSettings.noIndex} onChange={(noIndex) => updateShare({ noIndex })} />
        </div>

        {proposal.isPasswordProtected && !password && !proposal.passwordHash ? (
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
                    ? "bg-emerald-100 text-emerald-800"
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
