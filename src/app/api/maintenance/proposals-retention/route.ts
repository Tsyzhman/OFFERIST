import { NextResponse } from "next/server";
import { runProposalRetention } from "@/lib/server/proposal-retention";

export const runtime = "nodejs";

type RetentionRequestBody = {
  dryRun?: boolean;
  limit?: number;
};

export async function POST(request: Request) {
  const configuredSecret =
    process.env.PROPOSAL_MAINTENANCE_SECRET ||
    process.env.PROPOSAL_ACCESS_SECRET;

  if (!configuredSecret) {
    return NextResponse.json(
      { error: "Maintenance secret is not configured" },
      { status: 503 },
    );
  }

  if (getRequestSecret(request) !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as RetentionRequestBody;

  try {
    const result = await runProposalRetention({
      dryRun: body.dryRun === true,
      limit: body.limit,
      origin: getArchiveOrigin(request),
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Retention maintenance failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getRequestSecret(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return request.headers.get("x-maintenance-secret")?.trim();
}

function getArchiveOrigin(request: Request) {
  const configuredOrigin = process.env.PROPOSAL_PUBLIC_ORIGIN?.trim();

  if (configuredOrigin) {
    return configuredOrigin;
  }

  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");

  if (host) {
    return `${forwardedProto || requestUrl.protocol.replace(":", "")}://${host}`;
  }

  return requestUrl.origin;
}
