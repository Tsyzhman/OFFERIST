import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminToken,
  getAdminCookieOptions,
  isValidAdminSecret,
} from "@/lib/server/admin-auth";

export const runtime = "nodejs";

type SessionBody = {
  secret?: string;
  next?: string;
};

export async function POST(request: Request) {
  const input = await readSessionInput(request);
  const nextPath = normalizeNextPath(input.next);
  const wantsHtml = isHtmlFormPost(request);

  if (!isValidAdminSecret(input.secret)) {
    if (wantsHtml) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "1");
      loginUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(loginUrl, { status: 303 });
    }

    return NextResponse.json({ error: "Invalid admin secret" }, { status: 401 });
  }

  const response = wantsHtml
    ? NextResponse.redirect(new URL(nextPath, request.url), { status: 303 })
    : NextResponse.json({ ok: true });

  response.cookies.set(
    ADMIN_COOKIE_NAME,
    createAdminToken(),
    getAdminCookieOptions(),
  );

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  });
  return response;
}

async function readSessionInput(request: Request): Promise<SessionBody> {
  if (isHtmlFormPost(request)) {
    const formData = await request.formData();
    return {
      secret: asString(formData.get("secret")),
      next: asString(formData.get("next")),
    };
  }

  return (await request.json().catch(() => ({}))) as SessionBody;
}

function isHtmlFormPost(request: Request) {
  return request.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("application/x-www-form-urlencoded");
}

function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith("/login")) {
    return "/";
  }

  return value;
}

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}
