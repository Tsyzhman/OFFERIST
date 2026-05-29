import Link from "next/link";
import { ProposalEditor } from "@/components/proposal/ProposalEditor";
import { getProposalById } from "@/lib/server/proposal-store";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProposalPage({ params }: PageProps) {
  const { id } = await params;
  const proposal = await getProposalById(id);

  if (!proposal) {
    return (
      <main className="bg-noise flex min-h-screen items-center justify-center bg-main px-4 text-center">
        <div className="relative z-10 max-w-md rounded-lg border border-white/10 bg-paper p-8 shadow-xl shadow-black/25">
          <h1 className="text-2xl font-semibold text-zinc-950">КП не найдено</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Возможно, предложение было удалено или ссылка в админке устарела.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Вернуться к списку КП
          </Link>
        </div>
      </main>
    );
  }

  return <ProposalEditor initialProposal={proposal} mode="edit" />;
}
