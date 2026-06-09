import { assertRequiredProductionSecrets } from "@/lib/server/env";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertRequiredProductionSecrets([
      "PROPOSAL_ACCESS_SECRET",
      "PROPOSAL_ADMIN_SECRET",
    ]);

    if (
      process.env.NODE_ENV === "production" &&
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_KEY
    ) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required in production when SUPABASE_URL is configured",
      );
    }
  }
}
