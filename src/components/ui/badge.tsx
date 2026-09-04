import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "profit" | "loss" | "warn" | "accent";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-border text-muted",
    profit: "border-profit/30 text-profit",
    loss: "border-loss/30 text-loss",
    warn: "border-warn/30 text-warn",
    accent: "border-accent/30 text-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
