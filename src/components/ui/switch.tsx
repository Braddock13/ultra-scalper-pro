import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border",
        "bg-surface-2 transition-colors duration-[var(--motion-quick)]",
        "data-[state=checked]:bg-accent data-[state=checked]:border-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-fg shadow-sm",
          "transition-transform duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)]",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5",
          "data-[state=checked]:bg-accent-fg",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
