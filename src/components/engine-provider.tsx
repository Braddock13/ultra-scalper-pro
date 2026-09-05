import { useEffect } from "react";
import { useEngineStore } from "@/lib/engine/store";
import { startRuntime, stopRuntime } from "@/lib/engine/runtime";

export function EngineProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useEngineStore.persist.rehydrate();
    startRuntime();
    return () => stopRuntime();
  }, []);

  return <>{children}</>;
}
