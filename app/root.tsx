import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { I18nextProvider } from "react-i18next";
import type { Route } from "./+types/root";
import { Logo } from "./components/Logo";
import { UpdatePrompt } from "./features/pwa/UpdatePrompt";
import { i18n } from "./i18n";
import "./styles/app.css";

const BASE = import.meta.env.BASE_URL;
const SITE = "https://guru.situs.id";
const DESCRIPTION = "Ask one question and hear how different religions answer it.";
// The title on a shared link (Open Graph and Twitter), with no description of its own; the browser tab keeps "Guru".
// Cache busting: the file names never change (other sites link to them), a ?v=<hash of the file> does (scripts/asset-version.ts, set in
// vite.config.ts): a new picture is a new address for Cloudflare and the chat apps, and the old address keeps working.
const versioned = (name: string): string => `${name}?v=${__ASSET_V__[name]}`;
const OG_IMAGE = `${SITE}/${versioned("og-image.png")}`;
const SHARE_TITLE = "Ask Gurus for their perspectives";

// Dark unless the visitor chose light; set before the first paint, so there is no flash.
const THEME_SCRIPT = `try{document.documentElement.dataset.theme=localStorage.getItem("guru-theme")==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export const meta: Route.MetaFunction = () => [
  { title: "Guru" },
  { name: "description", content: DESCRIPTION },
  { property: "og:type", content: "website" },
  { property: "og:site_name", content: "Guru" },
  { property: "og:title", content: SHARE_TITLE },
  { property: "og:url", content: `${SITE}/` },
  { property: "og:image", content: OG_IMAGE },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { property: "og:image:alt", content: "Guru: Ask Gurus for their perspectives." },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: SHARE_TITLE },
  { name: "twitter:image", content: OG_IMAGE },
];

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: `${BASE}${versioned("favicon.png")}`, type: "image/png" },
  { rel: "apple-touch-icon", href: `${BASE}${versioned("apple-touch-icon.png")}` },
  { rel: "manifest", href: `${BASE}manifest.webmanifest` },
  { rel: "canonical", href: `${SITE}/` },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a1b22" />
        <meta name="apple-mobile-web-app-title" content="Guru" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Outlet />
      <UpdatePrompt />
    </I18nextProvider>
  );
}

/** Shown while the page starts: the logo in the middle (this is also what build/client/index.html holds). */
export function HydrateFallback() {
  return (
    <main className="guru">
      <Logo />
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : "Error";
  return (
    <main className="guru">
      <Logo />
      <p className="note">{message}</p>
    </main>
  );
}
