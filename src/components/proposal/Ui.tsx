import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-800 focus:ring-zinc-200 disabled:bg-zinc-300",
    secondary:
      "border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 focus:ring-zinc-100",
    ghost: "text-zinc-700 hover:bg-zinc-100 focus:ring-zinc-100",
    danger:
      "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:ring-rose-200",
  };

  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  helper,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  helper?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
      />
      {helper ? <span className="mt-1 block text-xs text-zinc-500">{helper}</span> : null}
    </label>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  rows = 4,
  helper,
  placeholder,
}: {
  label: string;
  value: string;
  rows?: number;
  helper?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <textarea
        aria-label={label}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
      />
      {helper ? <span className="mt-1 block text-xs text-zinc-500">{helper}</span> : null}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  helper,
}: {
  label: string;
  checked: boolean;
  helper?: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span>
        <span className="block text-sm font-semibold text-zinc-900">{label}</span>
        {helper ? (
          <span className="mt-1 block text-xs leading-5 text-zinc-500">
            {helper}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function SectionCard({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-paper p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Toast({ message, tone }: { message: string; tone: string }) {
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
  };

  return (
    <div
      className={cn(
        "fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg no-print",
        tones[tone as keyof typeof tones] ?? tones.success,
      )}
    >
      {message}
    </div>
  );
}
