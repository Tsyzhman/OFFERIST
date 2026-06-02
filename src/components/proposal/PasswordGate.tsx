"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, TextInput, Toast } from "./Ui";
import type { ToastState } from "@/lib/types";

export function PasswordGate({
  shareSlug,
  proposalTitle,
}: {
  shareSlug: string;
  proposalTitle: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const response = await fetch(`/api/public/${shareSlug}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!response.ok) {
      setToast({
        tone: "error",
        message: "Неверный пароль. Проверьте ввод и попробуйте ещё раз.",
      });
      window.setTimeout(() => setToast(null), 2400);
      return;
    }

    router.replace(`/p/${shareSlug}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-950">
      <ThemeToggle className="fixed right-4 top-4 z-10 no-print" />
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent text-white">
          <LockKeyhole size={22} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Защита паролем
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          Введите пароль для доступа к КП
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{proposalTitle}</p>
        <div className="mt-6">
          <TextInput
            label="Пароль"
            type="password"
            value={password}
            onChange={setPassword}
          />
        </div>
        <Button className="mt-5 w-full" disabled={loading || !password.trim()}>
          {loading ? "Проверяем" : "Открыть КП"}
        </Button>
      </form>
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </main>
  );
}
