import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { basePath } from "./scripts/base-path.ts";

// Old browsers are not supported: the floor is what Tailwind CSS 4 needs.
const TARGET = ["safari16.4", "chrome111", "firefox128"];

export default defineConfig(({ isSsrBuild }) => ({
  base: basePath(),
  plugins: [tailwindcss(), reactRouter()],
  resolve: { alias: { "~": new URL("./app", import.meta.url).pathname } },
  build: { emptyOutDir: false, target: isSsrBuild ? "node24" : TARGET },
  server: { fs: { allow: ["."] } },
}));
