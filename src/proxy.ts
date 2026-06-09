import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminToken } from "@/lib/server/admin-auth";

const PUBLIC_PREFIXES = [
  "/_next/",
  "/p/",
  "/api/public/",
  "/api/proposal-media/",
  "/api/maintenance/",
];

const PUBLIC_PATHS = new Set([
  "/api/admin/session",
  "/api/health",
  "/api/public-events",
  "/favicon.ico",
  "/login",
]);

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminToken(token)) {
    return unauthorizedResponse(request);
  }

  if (isProtectedMutatingApi(request) && !isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-origin mutation is not allowed" },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function unauthorizedResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

function isProtectedMutatingApi(request: NextRequest) {
  return (
    request.nextUrl.pathname.startsWith("/api/") &&
    MUTATING_METHODS.has(request.method.toUpperCase())
  );
}

function isSameOriginMutation(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return false;
  }

  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  return true;
}
