import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { useEngineStore } from "@/lib/engine/store";

export function EquitySpark() {
  const history = useEngineStore((s) => s.equityHistory);
  const data = useMemo(
    () => history.map((p, i) => ({ i, equity: p.equity })),
    [history],
  );
  const up =
    (history[history.length - 1]?.equity ?? 0) >= (history[0]?.equity ?? 0);

  if (data.length < 2) {
    return <div className="h-24 rounded-sm bg-surface-2" />;
  }

  const color = up ? "var(--color-profit)" : "var(--color-loss)";

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={color}
            fill={color}
            fillOpacity={0.12}
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
