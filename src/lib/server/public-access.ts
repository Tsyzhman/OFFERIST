import { createHmac } from "crypto";
import type { Proposal } from "@/lib/types";
import { requireProdSecret } from "@/lib/server/env";

export function getProposalAccessCookieName(shareSlug: string) {
  return `prisma_access_${shareSlug}`;
}

export function createProposalAccessToken(proposal: Proposal) {
  const secret = requireProdSecret("PROPOSAL_ACCESS_SECRET");
  const hashBasis = proposal.passwordHash || "no-password";

  return createHmac("sha256", secret)
    .update(`${proposal.shareSlug}:${hashBasis}`)
    .digest("hex");
}

export function hasProposalAccess(proposal: Proposal, cookieValue?: string) {
  if (!proposal.isPasswordProtected) {
    return true;
  }

  return cookieValue === createProposalAccessToken(proposal);
}
