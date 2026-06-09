import { DashboardClient } from "@/components/admin/DashboardClient";
import { stripServerSecrets } from "@/lib/proposal";
import { listProposals } from "@/lib/server/proposal-store";

type HomeProps = {
  searchParams: Promise<{
    page?: string | string[];
    limit?: string | string[];
  }>;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const limit = clampNumber(query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const page = clampNumber(query.page, 1, Number.MAX_SAFE_INTEGER);
  const offset = (page - 1) * limit;
  const { items, total } = await listProposals({ limit, offset });

  return (
    <DashboardClient
      key={`${offset}:${limit}:${items.map((item) => item.id).join(",")}`}
      proposals={items.map(stripServerSecrets)}
      total={total}
      limit={limit}
      offset={offset}
    />
  );
}

function clampNumber(
  value: string | string[] | undefined,
  fallback: number,
  max: number,
) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.floor(parsed)));
}
