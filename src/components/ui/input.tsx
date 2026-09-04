import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg num",
        "placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
