// Runs after `react-router build` (npm run build). Finishes build/client/ so it can be uploaded as it is:
//   abism/                 the Kitab texts (kitab.md, kutipan.md, kisah.md): the Worker reads them from <site>/abism/
//   404.html               the same page as index.html: GitHub Pages serves it for an address that has no file, such as the
//                          address of a question (/apa-surga-itu-ada), and the page then opens that question
//   robots.txt, sitemap.xml
//   storybook/             a copy of build/storybook/ when `npm run build-storybook` ran first (not in the precache)
//   sw.js                  the service worker (app/features/pwa/sw.template.js) with Workbox's precache list
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { getManifest } from "workbox-build";
import { basePath } from "./base-path.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "build", "client");
const BASE = basePath();
const SITE = "https://guru.situs.id";
const write = (rel: string, text: string) => writeFileSync(join(OUT, rel), text, "utf8");

if (!existsSync(OUT)) throw new Error("postbuild: build/client is missing; run `react-router build` first");

// When BASE_PATH !== "/", React Router nests the HTML under build/client/<BASE_PATH>/ while assets stay at build/client/assets/.
// Flatten it back into build/client/ so the folder can be served directly at BASE_PATH.
if (BASE !== "/") {
  const nested = join(OUT, BASE);
  if (existsSync(nested)) {
    cpSync(nested, OUT, { recursive: true });
    const topSeg = BASE.split("/").filter(Boolean)[0];
    if (topSeg) rmSync(join(OUT, topSeg), { recursive: true, force: true });
  }
}

// ---- the Kitab for Abi ----
rmSync(join(OUT, "abism"), { recursive: true, force: true });
cpSync(join(ROOT, "abism"), join(OUT, "abism"), { recursive: true });

// ---- 404.html: the same shell as index.html ----
const shell = join(OUT, "index.html");
if (!existsSync(shell)) throw new Error("postbuild: build/client/index.html is missing");
cpSync(shell, join(OUT, "404.html"));

// ---- robots.txt and sitemap.xml ----
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/</loc></url>\n</urlset>\n`);

// ---- Storybook at /storybook/ ----
rmSync(join(OUT, "storybook"), { recursive: true, force: true });
if (existsSync(join(ROOT, "build", "storybook"))) cpSync(join(ROOT, "build", "storybook"), join(OUT, "storybook"), { recursive: true });

// ---- service worker ----
const { manifestEntries, warnings } = await getManifest({
  globDirectory: OUT,
  globPatterns: ["**/*.{js,css,html,webmanifest}", "{icon-192,icon-512,icon-maskable-512}.png", "assets/*.png"],
  globIgnores: ["storybook/**", "abism/**", "sw.js", "404.html", "assets/og-image-*.png"], // the share image is for other sites, not for the page
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
});
for (const w of warnings) console.warn(`postbuild: ${w}`);
// the page is cached by its folder address, which is what a visitor navigates to
const precache = (manifestEntries || []).map((e) => (e.url === "index.html" ? "./" : e.url));
const version = createHash("sha256").update(JSON.stringify(manifestEntries)).digest("hex").slice(0, 10);
const sw = readFileSync(join(ROOT, "app", "features", "pwa", "sw.template.js"), "utf8").replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(precache));
write("sw.js", sw);

console.log(`postbuild: sw.js with ${precache.length} files (v ${version}), 404.html, abism/, base ${BASE}`);
