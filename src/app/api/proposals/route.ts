import { NextResponse } from "next/server";
import {
  createProposal,
  duplicateProposal,
  listProposals,
} from "@/lib/server/proposal-store";
import { stripServerSecrets } from "@/lib/proposal";
import { ProposalAiValidationError } from "@/lib/proposal-ai";
import type { ProposalSavePayload } from "@/lib/types";

export async function GET() {
  const { items, total } = await listProposals({ limit: 500 });
  return NextResponse.json({
    proposals: items.map(stripServerSecrets),
    total,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as
    | Partial<ProposalSavePayload>
    | { duplicateFromId?: string };

  if ("duplicateFromId" in body && body.duplicateFromId) {
    const proposal = await duplicateProposal(body.duplicateFromId);

    if (!proposal) {
      return NextResponse.json(
        { error: "КП не найдено для дублирования" },
        { status: 404 },
      );
    }

    return NextResponse.json({ proposal: stripServerSecrets(proposal) });
  }

  try {
    const proposal = await createProposal(body as Partial<ProposalSavePayload>);
    return NextResponse.json(
      { proposal: stripServerSecrets(proposal) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ProposalAiValidationError) {
      return NextResponse.json(
        { error: error.message, issues: error.issues },
        { status: 400 },
      );
    }

    throw error;
  }
}
