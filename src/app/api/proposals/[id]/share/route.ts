import { NextResponse } from "next/server";
import {
  publishProposal,
  regenerateProposalShareSlug,
  unpublishProposal,
} from "@/lib/server/proposal-store";

type Context = {
  params: Promise<{ id: string }>;
};

type ShareAction = "publish" | "unpublish" | "regenerate";

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: ShareAction;
  };

  const proposal =
    body.action === "publish"
      ? await publishProposal(id)
      : body.action === "unpublish"
        ? await unpublishProposal(id)
        : body.action === "regenerate"
          ? await regenerateProposalShareSlug(id)
          : null;

  if (!body.action) {
    return NextResponse.json(
      { error: "Укажите действие для клиентской ссылки" },
      { status: 400 },
    );
  }

  if (!proposal) {
    return NextResponse.json(
      { error: "КП не найдено или действие не поддерживается" },
      { status: 404 },
    );
  }

  return NextResponse.json({ proposal });
}
