import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-surface p-4", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className={cn("text-xs font-medium tracking-wide text-muted uppercase", className)}>
      {children}
    </h2>
  );
}
