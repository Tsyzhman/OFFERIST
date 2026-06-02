import { NextResponse } from "next/server";
import {
  createProposal,
  duplicateProposal,
  listProposals,
} from "@/lib/server/proposal-store";
import type { ProposalSavePayload } from "@/lib/types";

export async function GET() {
  const { items, total } = await listProposals({ limit: 500 });
  return NextResponse.json({ proposals: items, total });
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

    return NextResponse.json({ proposal });
  }

  const proposal = await createProposal(body as Partial<ProposalSavePayload>);
  return NextResponse.json({ proposal }, { status: 201 });
}
