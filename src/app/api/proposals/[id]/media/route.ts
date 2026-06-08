import { NextResponse } from "next/server";
import {
  deleteProposalMediaFile,
  getProposalById,
  saveProposalMediaFile,
} from "@/lib/server/proposal-store";
import type { ProposalMediaStorageProvider } from "@/lib/types";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

type DeleteMediaBody = {
  storageKey?: string;
  storageProvider?: ProposalMediaStorageProvider;
};

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const proposal = await getProposalById(id);

  if (!proposal) {
    return NextResponse.json({ error: "КП не найдено" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!isFileLike(file)) {
    return NextResponse.json(
      { error: "Не найден файл для загрузки" },
      { status: 400 },
    );
  }

  try {
    const media = await saveProposalMediaFile({
      proposalId: id,
      fileName: file.name || "proposal-media",
      contentType: file.type || "application/octet-stream",
      bytes: new Uint8Array(await file.arrayBuffer()),
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось загрузить медиа",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  const proposal = await getProposalById(id);

  if (!proposal) {
    return NextResponse.json({ error: "КП не найдено" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as DeleteMediaBody;
  await deleteProposalMediaFile({
    storageKey: body.storageKey,
    storageProvider: body.storageProvider,
  });

  return NextResponse.json({ ok: true });
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      "name" in value &&
      "type" in value,
  );
}
