import { NextResponse } from "next/server";
import {
  deleteProposal,
  getProposalById,
  saveProposal,
} from "@/lib/server/proposal-store";
import { stripServerSecrets } from "@/lib/proposal";
import { ProposalAiValidationError } from "@/lib/proposal-ai";
import type { ProposalSavePayload } from "@/lib/types";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const proposal = await getProposalById(id);

  if (!proposal) {
    return NextResponse.json({ error: "КП не найдено" }, { status: 404 });
  }

  return NextResponse.json({ proposal: stripServerSecrets(proposal) });
}

export async function PUT(request: Request, context: Context) {
  const { id } = await context.params;
  const payload = (await request.json()) as ProposalSavePayload;

  if (payload.proposal && payload.proposal.id !== id) {
    return NextResponse.json(
      { error: "Идентификатор КП не совпадает с маршрутом" },
      { status: 400 },
    );
  }

  try {
    const proposal = await saveProposal(payload, false, id);
    return NextResponse.json({ proposal: stripServerSecrets(proposal) });
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

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  await deleteProposal(id);
  return NextResponse.json({ ok: true });
}
