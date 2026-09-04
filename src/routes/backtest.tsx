import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { BacktestView } from "@/components/backtest-view";

export const Route = createFileRoute("/backtest")({ component: BacktestPage });

function BacktestPage() {
  return (
    <Shell>
      <BacktestView />
    </Shell>
  );
}
