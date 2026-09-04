import { useEffect, useState } from "react";
import { useEngineStore } from "@/lib/engine/store";
import { startRuntime, stopRuntime } from "@/lib/engine/runtime";

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = useEngineStore.persist.onFinishHydration(() => setReady(true));
    void useEngineStore.persist.rehydrate();
    if (useEngineStore.persist.hasHydrated()) setReady(true);
    startRuntime();
    return () => {
      unsub();
      stopRuntime();
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg text-fg">
        <p className="font-sans text-sm tracking-[0.22em] text-muted">ULTRA SCALPER PRO</p>
        <p className="mt-3 text-xs text-faint">Initialisation du terminal</p>
      </div>
    );
  }

  return <>{children}</>;
}
