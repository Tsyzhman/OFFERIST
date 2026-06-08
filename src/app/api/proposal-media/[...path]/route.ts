import { NextResponse } from "next/server";
import { readLocalProposalMediaFile } from "@/lib/server/proposal-store";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, context: Context) {
  const { path } = await context.params;
  const file = await readLocalProposalMediaFile(path).catch(() => null);

  if (!file) {
    return NextResponse.json({ error: "Медиа не найдено" }, { status: 404 });
  }

  return new Response(file.bytes, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
