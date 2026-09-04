import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { EngineProvider } from "@/components/engine-provider";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "ULTRA SCALPER PRO";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#08090b" },
      {
        name: "description",
        content:
          "Terminal self-hosted ULTRA SCALPER PRO — scalping MT5 sous M1, lots multiples, exécution de précision.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="fr" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <EngineProvider>
            <Outlet />
          </EngineProvider>
        </AuthProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: "bg-surface text-fg border-border",
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
