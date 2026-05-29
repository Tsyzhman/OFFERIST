import { DashboardClient } from "@/components/admin/DashboardClient";
import { listProposals } from "@/lib/server/proposal-store";

export default async function Home() {
  const proposals = await listProposals();
  return <DashboardClient proposals={proposals} />;
}
