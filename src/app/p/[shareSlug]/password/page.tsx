import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordGate } from "@/components/proposal/PasswordGate";
import { PublicState } from "@/components/proposal/PublicState";
import { isDateExpired } from "@/lib/proposal";
import { getProposalByShareSlug } from "@/lib/server/proposal-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Пароль для КП",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{ shareSlug: string }>;
};

export default async function PasswordPage({ params }: PageProps) {
  const { shareSlug } = await params;
  const proposal = await getProposalByShareSlug(shareSlug);

  if (!proposal) {
    return (
      <PublicState
        title="КП недоступно"
        copy="Возможно, ссылка была отключена или предложение ещё не опубликовано."
      />
    );
  }

  if (isDateExpired(proposal.expiresAt) || proposal.status === "expired") {
    return (
      <PublicState
        title="Срок действия КП истёк"
        copy="Свяжитесь с отправителем, чтобы получить обновлённую версию."
      />
    );
  }

  if (proposal.status !== "published" || !proposal.shareSettings.isPublished) {
    return (
      <PublicState
        title="КП недоступно"
        copy="Возможно, ссылка была отключена или предложение ещё не опубликовано."
      />
    );
  }

  if (!proposal.isPasswordProtected) {
    redirect(`/p/${shareSlug}`);
  }

  return <PasswordGate shareSlug={shareSlug} proposalTitle={proposal.title} />;
}
