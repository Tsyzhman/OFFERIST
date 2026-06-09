import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isProduction, requireProdSecret } from "@/lib/server/env";

export const ADMIN_COOKIE_NAME = "prisma_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const ADMIN_TOKEN_VERSION = "v1";

export function createAdminToken(now = Date.now()) {
  const expiresAt = now + ADMIN_SESSION_TTL_SECONDS * 1000;
  const nonce = randomBytes(16).toString("hex");
  const payload = `${ADMIN_TOKEN_VERSION}.${expiresAt}.${nonce}`;

  return `${payload}.${signAdminPayload(payload)}`;
}

export function isValidAdminToken(value?: string) {
  if (!value) {
    return false;
  }

  const parts = value.split(".");

  if (parts.length !== 4 || parts[0] !== ADMIN_TOKEN_VERSION) {
    return false;
  }

  const expiresAt = Number(parts[1]);

  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const payload = parts.slice(0, 3).join(".");
  const signature = parts[3];

  return timingSafeStringEqual(signature, signAdminPayload(payload));
}

export function isValidAdminSecret(value?: string) {
  return timingSafeStringEqual(value?.trim() ?? "", getAdminSecret());
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction(),
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/",
  };
}

function getAdminSecret() {
  return requireProdSecret("PROPOSAL_ADMIN_SECRET");
}

function signAdminPayload(payload: string) {
  return createHmac("sha256", getAdminSecret()).update(payload).digest("hex");
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
