import { createHmac } from "crypto";
import type { Proposal } from "@/lib/types";

export function getProposalAccessCookieName(shareSlug: string) {
  return `offerist_access_${shareSlug}`;
}

export function createProposalAccessToken(proposal: Proposal) {
  const secret = process.env.PROPOSAL_ACCESS_SECRET || "offerist-dev-secret";
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
