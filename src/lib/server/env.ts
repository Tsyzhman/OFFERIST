const DEFAULT_DEV_SECRET = "prisma-dev-secret";

export function requireProdSecret(name: string, devFallback = DEFAULT_DEV_SECRET) {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }

  return devFallback;
}

export function assertRequiredProductionSecrets(names: string[]) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  for (const name of names) {
    requireProdSecret(name);
  }
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
