import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Mt5View } from "@/components/mt5-view";

export const Route = createFileRoute("/mt5")({ component: Mt5Page });

function Mt5Page() {
  return (
    <Shell>
      <Mt5View />
    </Shell>
  );
}
