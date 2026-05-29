import Link from "next/link";
import { ArrowLeft, FilePenLine } from "lucide-react";
import { PublicProposalView } from "@/components/proposal/PublicProposalView";
import { PublicState } from "@/components/proposal/PublicState";
import { sanitizePublicProposal } from "@/lib/proposal";
import { getProposalById } from "@/lib/server/proposal-store";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProposalPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const proposal = await getProposalById(id);

  if (!proposal) {
    return (
      <PublicState
        title="КП не найдено"
        copy="Возможно, предложение было удалено или ссылка устарела."
        showDashboardLink
      />
    );
  }

  return (
    <main>
      <div className="sticky top-0 z-50 border-b border-white/10 bg-main/90 px-4 py-3 text-paper backdrop-blur no-print">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Внутренний preview
            </p>
            <p className="text-sm text-paper/70">
              Так КП будет выглядеть для клиента без админских полей.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 text-sm font-semibold text-paper hover:bg-white/10"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              К списку КП
            </Link>
            <Link
              href={`/proposal/${proposal.id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              <FilePenLine size={16} aria-hidden="true" />
              Редактировать КП
            </Link>
          </div>
        </div>
      </div>
      <PublicProposalView proposal={sanitizePublicProposal(proposal)} previewMode />
    </main>
  );
}
