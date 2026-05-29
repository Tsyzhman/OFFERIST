"use client";

import { Download, FileUp, Link2, Printer, RotateCcw } from "lucide-react";
import { useRef } from "react";
import type { ProposalData } from "@/lib/types";

type ImportExportControlsProps = {
  data: ProposalData;
  onImport: (data: unknown) => void;
  onCopyShareLink: () => void;
  onReset: () => void;
};

export function ImportExportControls({
  data,
  onImport,
  onCopyShareLink,
  onReset,
}: ImportExportControlsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle =
      data.project.projectTitle
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/gi, "-")
        .replace(/^-|-$/g, "") || "change-proposal";

    link.href = url;
    link.download = `${safeTitle}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File | undefined) {
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = JSON.parse(text);
    onImport(parsed);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="top-controls flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={exportJson}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
      >
        <Download size={16} aria-hidden="true" />
        Экспорт JSON
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
      >
        <FileUp size={16} aria-hidden="true" />
        Импорт JSON
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          importJson(event.target.files?.[0]).catch(() => {
            alert("Не удалось импортировать JSON. Проверьте структуру файла.");
          });
        }}
      />
      <button
        type="button"
        onClick={onCopyShareLink}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-900 shadow-sm transition hover:bg-emerald-100"
      >
        <Link2 size={16} aria-hidden="true" />
        Копировать ссылку
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
      >
        <Printer size={16} aria-hidden="true" />
        Печать / PDF
      </button>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-800 transition hover:bg-rose-100"
      >
        <RotateCcw size={16} aria-hidden="true" />
        Сбросить демо
      </button>
    </div>
  );
}
