import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PublicProposalView } from "@/components/proposal/PublicProposalView";
import { PublicState } from "@/components/proposal/PublicState";
import { isDateExpired, sanitizePublicProposal } from "@/lib/proposal";
import {
  getProposalByShareSlug,
  recordProposalEvent,
} from "@/lib/server/proposal-store";
import {
  getProposalAccessCookieName,
  hasProposalAccess,
} from "@/lib/server/public-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Коммерческое предложение",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{ shareSlug: string }>;
};

export default async function PublicProposalPage({ params }: PageProps) {
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

  if (proposal.isPasswordProtected) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(getProposalAccessCookieName(shareSlug))?.value;

    if (!hasProposalAccess(proposal, cookieValue)) {
      redirect(`/p/${shareSlug}/password`);
    }
  }

  const headersList = await headers();
  await recordProposalEvent({
    proposalId: proposal.id,
    eventType: "view",
    userAgent: headersList.get("user-agent") ?? undefined,
    referrer: headersList.get("referer") ?? undefined,
  });

  return <PublicProposalView proposal={sanitizePublicProposal(proposal)} />;
}
