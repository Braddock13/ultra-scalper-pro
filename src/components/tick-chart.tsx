import { useEffect, useRef } from "react";
import { SYMBOL_MAP } from "@/lib/engine/symbols";
import { useEngineStore } from "@/lib/engine/store";

export function TickChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ticks = useEngineStore((s) => s.ticks);
  const symbol = useEngineStore((s) => s.engine.selectedSymbol);
  const positions = useEngineStore((s) => s.positions);
  const quote = useEngineStore((s) => s.quotes[s.engine.selectedSymbol]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue("--color-surface").trim() || "#111316";
    const grid = styles.getPropertyValue("--color-border").trim() || "#262a32";
    const fg = styles.getPropertyValue("--color-fg").trim() || "#ececec";
    const muted = styles.getPropertyValue("--color-muted").trim() || "#8b919c";
    const profit = styles.getPropertyValue("--color-profit").trim() || "#3c9d73";
    const loss = styles.getPropertyValue("--color-loss").trim() || "#d05656";

    const w = rect.width;
    const h = rect.height;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (ticks.length < 2) {
      ctx.fillStyle = muted;
      ctx.font = "12px 'IBM Plex Mono', monospace";
      ctx.fillText("En attente du flux ticks…", 16, h / 2);
      return;
    }

    const mids = ticks.map((t) => t.mid);
    let min = Math.min(...mids);
    let max = Math.max(...mids);
    const pad = (max - min) * 0.18 || SYMBOL_MAP[symbol].pip * 4;
    min -= pad;
    max += pad;
    const span = max - min || 1;

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const xAt = (i: number) => (i / (ticks.length - 1)) * w;
    const yAt = (v: number) => h - ((v - min) / span) * h;

    ctx.beginPath();
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.4;
    ticks.forEach((t, i) => {
      const x = xAt(i);
      const y = yAt(t.mid);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const last = ticks[ticks.length - 1];
    if (last) {
      const y = yAt(last.mid);
      ctx.strokeStyle = muted;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = fg;
      ctx.font = "11px 'IBM Plex Mono', monospace";
      const label = last.mid.toFixed(SYMBOL_MAP[symbol].digits);
      const tw = ctx.measureText(label).width;
      ctx.fillRect(w - tw - 14, y - 9, tw + 10, 16);
      ctx.fillStyle = bg;
      ctx.fillText(label, w - tw - 9, y + 3);
    }

    for (const p of positions) {
      if (p.symbol !== symbol) continue;
      const y = yAt(p.openPrice);
      ctx.strokeStyle = p.side === "buy" ? profit : loss;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }, [ticks, symbol, positions, quote]);

  return (
    <canvas
      ref={canvasRef}
      className="h-48 w-full rounded-sm md:h-64"
      role="img"
      aria-label={`Graphique ticks ${symbol}`}
    />
  );
}
