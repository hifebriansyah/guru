import type { Config } from "@react-router/dev/config";
import { basePath } from "./scripts/base-path.ts";

// A single-page app: build/client/index.html is the shell, and the browser draws every address (the home page and a question's
// address like /apa-surga-itu-ada). GitHub Pages serves the same shell as 404.html for an address that has no file (scripts/postbuild.ts).
export default {
  ssr: false,
  basename: basePath(),
} satisfies Config;
