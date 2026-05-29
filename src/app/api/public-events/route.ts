import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getProposalByShareSlug,
  recordEventByShareSlug,
} from "@/lib/server/proposal-store";
import type { ProposalEventType } from "@/lib/types";

type PublicEventBody = {
  shareSlug?: string;
  eventType?: ProposalEventType;
  packageId?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PublicEventBody;

  if (!body.shareSlug || !body.eventType) {
    return NextResponse.json(
      { error: "Не хватает данных для события" },
      { status: 400 },
    );
  }

  const proposal = await getProposalByShareSlug(body.shareSlug);

  if (!proposal || proposal.status !== "published") {
    return NextResponse.json({ error: "КП недоступно" }, { status: 404 });
  }

  if (
    body.eventType === "package_selected" &&
    !proposal.shareSettings.allowPackageSelection
  ) {
    return NextResponse.json(
      { error: "Выбор пакета отключён" },
      { status: 403 },
    );
  }

  const headersList = await headers();
  const event = await recordEventByShareSlug(body.shareSlug, body.eventType, {
    packageId: body.packageId,
    metadata: body.metadata,
    userAgent: headersList.get("user-agent") ?? undefined,
    referrer: headersList.get("referer") ?? undefined,
  });

  return NextResponse.json({ event });
}
