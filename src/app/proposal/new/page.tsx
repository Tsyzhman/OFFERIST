import { ProposalEditor } from "@/components/proposal/ProposalEditor";
import { createBlankProposal } from "@/lib/proposal";

export default function NewProposalPage() {
  return <ProposalEditor initialProposal={createBlankProposal()} mode="new" />;
}
