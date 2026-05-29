import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { verifyProposalPassword } from "@/lib/server/proposal-store";
import {
  createProposalAccessToken,
  getProposalAccessCookieName,
} from "@/lib/server/public-access";

type Context = {
  params: Promise<{ shareSlug: string }>;
};

export async function POST(request: Request, context: Context) {
  const { shareSlug } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const headersList = await headers();
  const proposal = await verifyProposalPassword(
    shareSlug,
    body.password ?? "",
    headersList.get("user-agent") ?? undefined,
    headersList.get("referer") ?? undefined,
  );

  if (!proposal) {
    return NextResponse.json(
      { error: "Неверный пароль. Проверьте ввод и попробуйте ещё раз." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getProposalAccessCookieName(shareSlug),
    value: createProposalAccessToken(proposal),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/p/${shareSlug}`,
    maxAge: 60 * 60 * 12,
  });

  return response;
}
