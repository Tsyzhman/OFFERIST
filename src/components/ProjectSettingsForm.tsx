import { ClipboardList, FileText } from "lucide-react";
import type { ProjectSettings } from "@/lib/types";

type ProjectSettingsFormProps = {
  value: ProjectSettings;
  onChange: (patch: Partial<ProjectSettings>) => void;
};

export function ProjectSettingsForm({
  value,
  onChange,
}: ProjectSettingsFormProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Настройки проекта
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">
            Основные параметры
          </h2>
        </div>
        <div className="rounded-md bg-zinc-100 p-2 text-zinc-700">
          <ClipboardList size={20} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput
          label="Название проекта"
          value={value.projectTitle}
          onChange={(projectTitle) => onChange({ projectTitle })}
        />
        <TextInput
          label="Клиент"
          value={value.clientName}
          onChange={(clientName) => onChange({ clientName })}
        />
        <TextInput
          label="Подготовил"
          value={value.preparedBy}
          onChange={(preparedBy) => onChange({ preparedBy })}
        />
        <TextInput
          label="Дата proposal"
          type="date"
          value={value.proposalDate}
          onChange={(proposalDate) => onChange({ proposalDate })}
        />
        <TextInput
          label="Версия"
          value={value.version}
          onChange={(version) => onChange({ version })}
        />
        <TextInput
          label="Валюта"
          value={value.currency}
          onChange={(currency) => onChange({ currency: currency.toUpperCase() })}
        />
      </div>

      <div className="mt-4 space-y-4">
        <Textarea
          label="Краткое резюме"
          value={value.introSummary}
          rows={4}
          onChange={(introSummary) => onChange({ introSummary })}
        />
        <Textarea
          label="Условия оплаты"
          value={value.paymentTerms}
          rows={3}
          onChange={(paymentTerms) => onChange({ paymentTerms })}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Textarea
            label="Допущения"
            value={value.assumptions}
            rows={5}
            helper="Каждое условие с новой строки."
            onChange={(assumptions) => onChange({ assumptions })}
          />
          <Textarea
            label="Не входит в объем"
            value={value.outOfScope}
            rows={5}
            helper="Каждый пункт с новой строки."
            onChange={(outOfScope) => onChange({ outOfScope })}
          />
        </div>
        <Textarea
          label="Заметки"
          value={value.notes}
          rows={3}
          helper="Внутреннее поле редактора, в клиентской презентации не выводится."
          onChange={(notes) => onChange({ notes })}
        />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <FileText size={16} aria-hidden="true" />
        Все изменения сохраняются в localStorage этого браузера.
      </div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows,
  helper,
}: {
  label: string;
  value: string;
  rows: number;
  helper?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <textarea
        aria-label={label}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
      {helper ? <span className="mt-1 block text-xs text-zinc-500">{helper}</span> : null}
    </label>
  );
}
