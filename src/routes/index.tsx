import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { DashboardView } from "@/components/dashboard-view";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Shell>
      <DashboardView />
    </Shell>
  );
}
