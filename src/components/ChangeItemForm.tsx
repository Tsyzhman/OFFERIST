"use client";

import { Check, Plus, Save, X } from "lucide-react";
import {
  categories,
  categoryLabels,
  fromList,
  priorities,
  priorityLabels,
  statuses,
  statusLabels,
  toList,
  unitLabels,
  units,
} from "@/lib/proposal";
import type { Category, ChangeItem, Priority, Status, Unit } from "@/lib/types";

type ChangeItemFormProps = {
  item: ChangeItem | null;
  isNew: boolean;
  onChange: (item: ChangeItem) => void;
  onSave: (item: ChangeItem) => void;
  onCancel: () => void;
  onAdd: () => void;
};

export function ChangeItemForm({
  item,
  isNew,
  onChange,
  onSave,
  onCancel,
  onAdd,
}: ChangeItemFormProps) {
  if (!item) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-5 text-center">
        <h2 className="text-lg font-semibold text-zinc-950">
          Добавьте корректировку
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
          Создайте новую позицию, затем заполните описание, стоимость, сроки и
          клиентскую ценность. Презентация обновится сразу после сохранения.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          <Plus size={16} aria-hidden="true" />
          Добавить корректировку
        </button>
      </section>
    );
  }

  const errors = {
    title: item.title.trim() ? "" : "Название обязательно.",
    price: item.price >= 0 ? "" : "Стоимость не может быть меньше 0.",
    quantity: item.quantity >= 1 ? "" : "Количество минимум 1.",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function update(patch: Partial<ChangeItem>) {
    if (!item) {
      return;
    }

    onChange({ ...item, ...patch });
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {isNew ? "Новая корректировка" : "Редактирование"}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">
            {isNew ? "Новая корректировка" : item.title || "Без названия"}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <X size={16} aria-hidden="true" />
            Отмена
          </button>
          <button
            type="button"
            disabled={hasErrors}
            onClick={() => onSave(item)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <Save size={16} aria-hidden="true" />
            Сохранить
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput
          label="Название"
          value={item.title}
          error={errors.title}
          onChange={(title) => update({ title })}
        />
        <SelectInput
          label="Категория"
          value={item.category}
          options={categories}
          getLabel={(category) => categoryLabels[category as Category]}
          onChange={(category) => update({ category: category as Category })}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <Textarea
          label="Описание"
          rows={3}
          value={item.description}
          onChange={(description) => update({ description })}
        />
        <Textarea
          label="Ценность для клиента"
          rows={3}
          value={item.clientValue}
          onChange={(clientValue) => update({ clientValue })}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Textarea
          label="Что входит"
          rows={5}
          helper="Каждый пункт с новой строки."
          value={fromList(item.deliverables)}
          onChange={(deliverables) => update({ deliverables: toList(deliverables) })}
        />
        <Textarea
          label="Не входит в эту корректировку"
          rows={5}
          helper="Каждый пункт с новой строки."
          value={fromList(item.outOfScope)}
          onChange={(outOfScope) => update({ outOfScope: toList(outOfScope) })}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <NumberInput
          label="Стоимость"
          value={item.price}
          min={0}
          error={errors.price}
          onChange={(price) => update({ price })}
        />
        <NumberInput
          label="Количество"
          value={item.quantity}
          min={1}
          error={errors.quantity}
          onChange={(quantity) => update({ quantity })}
        />
        <SelectInput
          label="Единица"
          value={item.unit}
          options={units}
          getLabel={(unit) => unitLabels[unit as Unit]}
          onChange={(unit) => update({ unit: unit as Unit })}
        />
        <NumberInput
          label="Оценка, дней"
          value={item.estimatedDays}
          min={0}
          step={0.5}
          onChange={(estimatedDays) => update({ estimatedDays })}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SelectInput
          label="Приоритет"
          value={item.priority}
          options={priorities}
          getLabel={(priority) => priorityLabels[priority as Priority]}
          onChange={(priority) => update({ priority: priority as Priority })}
        />
        <SelectInput
          label="Статус"
          value={item.status}
          options={statuses}
          getLabel={(status) => statusLabels[status as Status]}
          onChange={(status) => update({ status: status as Status })}
        />
        <div>
          <span className="text-sm font-medium text-zinc-700">Тип</span>
          <div className="mt-1 grid h-10 grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1">
            <button
              type="button"
              onClick={() =>
                update({ required: true, optional: false, selected: true })
              }
              className={`inline-flex items-center justify-center gap-1 rounded px-2 text-sm font-medium transition ${
                item.required
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {item.required ? <Check size={14} aria-hidden="true" /> : null}
              Обязательная
            </button>
            <button
              type="button"
              onClick={() =>
                update({ required: false, optional: true, selected: item.selected })
              }
              className={`inline-flex items-center justify-center gap-1 rounded px-2 text-sm font-medium transition ${
                item.optional
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {item.optional ? <Check size={14} aria-hidden="true" /> : null}
              Опция
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex min-h-10 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={item.optional ? item.selected : true}
            disabled={!item.optional}
            onChange={(event) => update({ selected: event.target.checked })}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500"
          />
          Выбрана, если это опция
        </label>
        <TextInput
          label="Зависимости"
          value={item.dependencyNote}
          onChange={(dependencyNote) => update({ dependencyNote })}
        />
      </div>

      <div className="mt-4">
        <Textarea
          label="Внутренняя заметка"
          rows={3}
          helper="Показывается только в режиме редактирования."
          value={item.internalNote}
          onChange={(internalNote) => update({ internalNote })}
        />
      </div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm text-zinc-950 outline-none transition focus:ring-4 ${
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-100"
        }`}
      />
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  step = 1,
  error,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step?: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        aria-label={label}
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm text-zinc-950 outline-none transition focus:ring-4 ${
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-100"
        }`}
      />
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  getLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  getLabel?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getLabel ? getLabel(option) : option}
          </option>
        ))}
      </select>
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
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
      {helper ? <span className="mt-1 block text-xs text-zinc-500">{helper}</span> : null}
    </label>
  );
}
