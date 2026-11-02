import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { assetVersion } from "./scripts/asset-version.ts";
import { basePath } from "./scripts/base-path.ts";

// Old browsers are not supported: the floor is what Tailwind CSS 4 needs.
const TARGET = ["safari16.4", "chrome111", "firefox128"];

export default defineConfig(({ isSsrBuild }) => ({
  base: basePath(),
  // ?v=<hash of the file> for the files in public/ that other sites or browsers cache (see app/root.tsx)
  define: { __ASSET_V__: JSON.stringify(Object.fromEntries(["og-image.png", "favicon.png", "apple-touch-icon.png"].map((n) => [n, assetVersion(n)]))) },
  plugins: [tailwindcss(), reactRouter()],
  resolve: { alias: { "~": new URL("./app", import.meta.url).pathname } },
  build: { emptyOutDir: false, target: isSsrBuild ? "node24" : TARGET },
  server: { fs: { allow: ["."] } },
}));
