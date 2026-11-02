# Guru

Ask Gurus Their Perspectives. A React page (the same stack as Omon Omon) and a Cloudflare Worker
that asks Gemini.

- **Page:** React 19, React Router 7 (single-page app), Vite, TypeScript, Tailwind CSS 4, Storybook, and a PWA (manifest, icons,
  service worker). Needs Node 24 (`.nvmrc`).
- **Worker:** `worker/guru.js`, deployed with `python3 tools/deploy_worker.py` (see `worker/guru.jsonc`). The teachers are the
  prompts in `agents/*.md`; Abi reads the Kitab in `abism/*.md`.

```bash
npm install
npm run dev              # http://localhost:5173
npm run lint && npm run typecheck
npm run storybook        # the components, http://localhost:6006
npm run build-storybook && npm run build   # build/client: the site, 404.html, abism/, sw.js, storybook/
npm run build:local      # Storybook, then the site with BASE_PATH=/for-fun/guru/ (see below)
```

- Local Apache: `npm run build:local` builds Storybook and the site with `BASE_PATH=/for-fun/guru/`; `.htaccess` then serves
  `build/client/` at http://localhost/for-fun/guru/ (Storybook at `/storybook/`), like `../abimisme`. Rebuild after every change.
  Plain `npm run build` is for GitHub Pages (base `/`).

Pushing to `main` builds and publishes `build/client` to GitHub Pages (`.github/workflows/pages.yml`).

## Pages

- `/` the home page; `/<slug>` (for example `/apa-surga-itu-ada`) is the same page with that question opened. GitHub Pages has no file
  for a slug, so it serves `404.html` (a copy of `index.html`) and the page opens the question from the Worker (`GET /answer/<slug>`).
- Language, theme and which teachers are on are saved in the browser (`app/lib/storage.ts`); the language is only for the page, the
  teachers answer in the language of the question.

## Logo and icons

One version of the logo. `python3 tools/make_icons.py` (needs Pillow) draws `logo.png`, the app icons in `public/` and the share
image `public/og-image.png`; `app/components/Logo.tsx` draws the same shapes.
