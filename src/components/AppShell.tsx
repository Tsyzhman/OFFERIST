"use client";

import { Eye, Hammer, Save } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChangeItemForm } from "./ChangeItemForm";
import { ChangeItemList } from "./ChangeItemList";
import { ImportExportControls } from "./ImportExportControls";
import { ProjectSettingsForm } from "./ProjectSettingsForm";
import { ProposalPreview } from "./ProposalPreview";
import { SummaryCard } from "./SummaryCard";
import {
  createDemoProposalData,
  createEmptyChangeItem,
  createId,
  decodeProposalFromShare,
  encodeProposalForShare,
  normalizeProposalData,
  SHARE_HASH_PREFIX,
  STORAGE_KEY,
} from "@/lib/proposal";
import type {
  ChangeItem,
  ProjectSettings,
  ProposalData,
  ProposalMode,
} from "@/lib/types";

export function AppShell() {
  const [data, setData] = useState<ProposalData>(() => createDemoProposalData());
  const [mode, setMode] = useState<ProposalMode>("builder");
  const [hydrated, setHydrated] = useState(false);
  const [editingItem, setEditingItem] = useState<ChangeItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("Загружены демо-данные");

  useEffect(() => {
    let nextData: ProposalData | null = null;
    let nextNotice = "Загружены демо-данные";
    let nextMode: ProposalMode = "builder";

    try {
      const hashValue = window.location.hash.replace(/^#/, "");
      const sharedData = hashValue.startsWith(SHARE_HASH_PREFIX)
        ? decodeProposalFromShare(hashValue)
        : null;
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (sharedData) {
        nextData = sharedData;
        nextNotice = "Открыта клиентская ссылка";
        nextMode = "preview";
      } else if (stored) {
        const parsed = normalizeProposalData(JSON.parse(stored));
        if (parsed) {
          nextData = parsed;
          nextNotice = "Загружено из localStorage";
        }
      }
    } catch {
      nextNotice = "Загружены демо-данные";
    }

    const timer = window.setTimeout(() => {
      if (nextData) {
        setData(nextData);
      }
      setNotice(nextNotice);
      setMode(nextMode);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const activeId = editingId ?? editingItem?.id ?? null;

  const sortedItems = useMemo(
    () =>
      [...data.items].sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }

        return a.title.localeCompare(b.title);
      }),
    [data.items],
  );

  function updateProject(patch: Partial<ProjectSettings>) {
    setData((current) => ({
      ...current,
      project: {
        ...current.project,
        ...patch,
      },
    }));
    setNotice("Сохранено локально");
  }

  function startAddItem() {
    setEditingId(null);
    setEditingItem(createEmptyChangeItem());
  }

  function startEditItem(item: ChangeItem) {
    setEditingId(item.id);
    setEditingItem({
      ...item,
      deliverables: [...item.deliverables],
      outOfScope: [...item.outOfScope],
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingItem(null);
  }

  function saveItem(item: ChangeItem) {
    const normalized = normalizeItem(item);

    if (!normalized.title.trim()) {
      return;
    }

    setData((current) => ({
      ...current,
      items: editingId
        ? current.items.map((existing) =>
            existing.id === editingId ? normalized : existing,
          )
        : [...current.items, normalized],
    }));
    setNotice("Сохранено локально");
    cancelEdit();
  }

  function duplicateItem(id: string) {
    setData((current) => {
      const index = current.items.findIndex((item) => item.id === id);
      if (index === -1) {
        return current;
      }

      const copy: ChangeItem = {
        ...current.items[index],
        id: createId(),
        title: `${current.items[index].title} (копия)`,
      };
      const nextItems = [...current.items];
      nextItems.splice(index + 1, 0, copy);

      return { ...current, items: nextItems };
    });
    setNotice("Сохранено локально");
  }

  function deleteItem(id: string) {
    setData((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
    setNotice("Сохранено локально");

    if (editingId === id || editingItem?.id === id) {
      cancelEdit();
    }
  }

  function toggleItemType(id: string, type: "required" | "optional") {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id
          ? {
              ...item,
              required: type === "required",
              optional: type === "optional",
              selected: type === "required" ? true : item.selected,
            }
          : item,
      ),
    }));
    setNotice("Сохранено локально");
  }

  function toggleOptionalSelected(id: string, selected: boolean) {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id && item.optional ? { ...item, selected } : item,
      ),
    }));
    setNotice("Сохранено локально");
  }

  function importData(value: unknown) {
    const parsed = normalizeProposalData(value);

    if (!parsed) {
      alert("Не удалось импортировать JSON. Структура proposal не распознана.");
      return;
    }

    setData(parsed);
    cancelEdit();
    setNotice("JSON импортирован");
  }

  async function copyShareLink() {
    const url = new URL(window.location.href);
    url.hash = `${SHARE_HASH_PREFIX}${encodeProposalForShare(data)}`;

    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("Клиентская ссылка скопирована");
    } catch {
      window.prompt("Скопируйте клиентскую ссылку", url.toString());
      setNotice("Ссылка подготовлена");
    }
  }

  function resetDemoData() {
    setData(createDemoProposalData());
    cancelEdit();
    setNotice("Демо-данные восстановлены");
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="top-controls sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold tracking-[0.18em] text-zinc-950">
                PRISMA
              </div>
              <div className="mt-1 max-w-2xl text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                Digital Offer & Proposal List for Interactive Scope Tracking
              </div>
            </div>
          </div>
          <div className="flex flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-end">
            <div className="grid w-full flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
              <HeaderField
                label="Проект"
                value={data.project.projectTitle}
                onChange={(projectTitle) => updateProject({ projectTitle })}
              />
              <HeaderField
                label="Клиент"
                value={data.project.clientName}
                onChange={(clientName) => updateProject({ clientName })}
              />
              <HeaderField
                label="Дата"
                type="date"
                value={data.project.proposalDate}
                onChange={(proposalDate) => updateProject({ proposalDate })}
              />
              <HeaderField
                label="Версия"
                value={data.project.version}
                onChange={(version) => updateProject({ version })}
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="grid h-10 w-full grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1 sm:w-auto">
                <ModeButton
                  active={mode === "builder"}
                  onClick={() => setMode("builder")}
                  icon={<Hammer size={16} aria-hidden="true" />}
                >
                  Редактор
                </ModeButton>
                <ModeButton
                  active={mode === "preview"}
                  onClick={() => setMode("preview")}
                  icon={<Eye size={16} aria-hidden="true" />}
                >
                  Презентация
                </ModeButton>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ImportExportControls
              data={data}
              onImport={importData}
              onCopyShareLink={copyShareLink}
              onReset={resetDemoData}
            />
            <div className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
              <Save size={14} aria-hidden="true" />
              {hydrated ? notice : "Готовим localStorage"}
            </div>
          </div>
        </div>
      </header>

      {mode === "builder" ? (
        <main className="builder-grid mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 py-6 xl:grid-cols-[minmax(0,760px)_minmax(520px,1fr)]">
          <div className="builder-panel space-y-5">
            <ProjectSettingsForm value={data.project} onChange={updateProject} />
            <ChangeItemForm
              item={editingItem}
              isNew={!editingId}
              onAdd={startAddItem}
              onChange={setEditingItem}
              onSave={saveItem}
              onCancel={cancelEdit}
            />
            <ChangeItemList
              items={sortedItems}
              currency={data.project.currency}
              activeId={activeId}
              onEdit={startEditItem}
              onDuplicate={duplicateItem}
              onDelete={deleteItem}
              onToggleType={toggleItemType}
              onToggleSelected={toggleOptionalSelected}
            />
          </div>

          <div className="space-y-4">
            <SummaryCard data={data} />
            <ProposalPreview
              data={data}
              onToggleOptional={toggleOptionalSelected}
            />
          </div>
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 py-6">
          <ProposalPreview data={data} onToggleOptional={toggleOptionalSelected} />
        </main>
      )}
    </div>
  );
}

function normalizeItem(item: ChangeItem): ChangeItem {
  const required = item.required || !item.optional;

  return {
    ...item,
    title: item.title.trim(),
    price: Math.max(0, Number(item.price) || 0),
    quantity: Math.max(1, Number(item.quantity) || 1),
    estimatedDays: Math.max(0, Number(item.estimatedDays) || 0),
    required,
    optional: !required,
    selected: required ? true : item.selected,
  };
}

function HeaderField({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

function ModeButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition ${
        active
          ? "bg-white text-zinc-950 shadow-sm"
          : "text-zinc-500 hover:text-zinc-900"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
